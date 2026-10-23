"""Run with python -m unittest -v; actual CPU tensors and CLI subprocesses."""
from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import torch
from torch import nn
from model import Config, TinyGPT, generate
from efficient import (LoRALinear, Int8Linear, add_lora, lora_state, load_lora_state,
                       merge_lora, quantize_int8, storage_report)
from benchmark import benchmark_cache, decode_path
from tiny_gpt import (ROOT, prepare, batch, save_checkpoint, load_checkpoint,
                      save_inference, apply_adapter, atomic_save, checkpoint_hash, require_distinct)

torch.set_num_threads(1)


class EfficiencyTests(unittest.TestCase):
    def setUp(self):
        torch.manual_seed(2026)
        self.model = TinyGPT(Config(13, context=12, width=12, heads=3, layers=2)).eval()
        self.ids = torch.randint(13, (2, 12))

    def test_cache_matches_every_full_prefix(self):
        cache = None
        for t in range(12):
            full = self.model(self.ids[:, :t+1])[0][:, -1:]
            incremental, cache = self.model.forward_cached(self.ids[:, t:t+1], cache)
            torch.testing.assert_close(full, incremental, rtol=1e-5, atol=1e-6)
            for k, v in cache:
                self.assertEqual(k.shape, (2, 3, t+1, 4))
                self.assertEqual(v.shape, k.shape)
                self.assertFalse(k.requires_grad)

    def test_chunk_prefill_uses_offset_mask_and_positions(self):
        initial, cache = self.model.forward_cached(self.ids[:, :5])
        second, cache = self.model.forward_cached(self.ids[:, 5:9], cache)
        full = self.model(self.ids[:, :9])[0]
        torch.testing.assert_close(initial, full[:, :5], atol=1e-6, rtol=1e-5)
        torch.testing.assert_close(second, full[:, 5:], atol=1e-6, rtol=1e-5)
        self.assertEqual(cache[0][0].shape[2], 9)

    def test_cache_does_not_mutate_previous_prefix(self):
        _, cache = self.model.forward_cached(self.ids[:, :4])
        saved = tuple(tuple(z.clone() for z in pair) for pair in cache)
        _, updated = self.model.forward_cached(self.ids[:, 4:5], cache)
        self.assertEqual(updated[0][0].shape[2], 5)
        for old, snapshot in zip(cache, saved):
            for a, b in zip(old, snapshot):
                torch.testing.assert_close(a, b, rtol=0, atol=0)

    def test_invalid_cache_and_training_are_rejected(self):
        _, cache = self.model.forward_cached(self.ids[:, :5])
        cases = [cache[:1], ((cache[0][0][:1], cache[0][1][:1]), cache[1]),
                 (cache[0], (cache[1][0][:, :, :3], cache[1][1][:, :, :3])),
                 ((cache[0][0].double(), cache[0][1].double()), cache[1])]
        for bad in cases:
            with self.subTest(cache=tuple(x[0].shape for x in bad)):
                with self.assertRaises(ValueError):
                    self.model.forward_cached(self.ids[:, 5:6], bad)
        with self.assertRaises(ValueError):
            self.model.forward_cached(self.ids[:, :8], cache)
        self.model.train()
        with self.assertRaises(ValueError):
            self.model.forward_cached(self.ids[:, :1])

    def test_generation_matches_across_rollover_and_long_prompts(self):
        for prompt in ([2, 3, 4], list(range(13))):
            a, plain = generate(self.model, prompt, 25, seed=19)
            b, cached = generate(self.model, prompt, 25, seed=19, use_cache=True)
            self.assertEqual(a, b)
            self.assertTrue(any(t["cache_rebuilt"] for t in cached[1:]))
            for x, y in zip(plain, cached):
                self.assertAlmostEqual(x["probability"], y["probability"], places=5)

    def test_cached_path_really_projects_only_new_positions(self):
        counts = []
        hook = self.model.blocks[0].attn.qkv.register_forward_pre_hook(lambda m, args: counts.append(args[0].shape[1]))
        try:
            generate(self.model, [1, 2, 3], 5, use_cache=True)
        finally:
            hook.remove()
        self.assertEqual(counts, [3, 1, 1, 1, 1])
        report = benchmark_cache(self.model, [1, 2, 3], steps=16, repeats=1)
        self.assertTrue(report["logits_close"])
        self.assertGreater(report["cached"]["cache_rebuilds"], 1)
        self.assertLess(report["cached"]["projected_token_positions"], report["full"]["projected_token_positions"])
        self.assertGreater(report["cached"]["final_cache_bytes"], 0)

    def test_int8_zero_rows_outliers_and_error_bound(self):
        source = nn.Linear(4, 3)
        with torch.no_grad():
            source.weight.copy_(torch.tensor([[0., 0., 0., 0.], [1., -.7, .3, -.1], [200., -150., .01, -.02]]))
        compressed = Int8Linear(source)
        self.assertEqual(compressed.qweight.dtype, torch.int8)
        self.assertTrue(torch.equal(compressed.qweight[0], torch.zeros(4, dtype=torch.int8)))
        restored = compressed.qweight.float() * compressed.scale
        self.assertTrue(((restored - source.weight).abs() <= compressed.scale / 2 + 1e-5).all())
        x = torch.tensor([[1., 2., -1., 3.]])
        torch.testing.assert_close(compressed(x), x @ restored.T + source.bias)
        with torch.no_grad():
            source.weight[0, 0] = float("nan")
        with self.assertRaises(ValueError):
            Int8Linear(source)
        subnormal = nn.Linear(2, 1, bias=False)
        with torch.no_grad():
            subnormal.weight.fill_(torch.finfo(torch.float32).smallest_normal / 1000)
        self.assertTrue(torch.isfinite(Int8Linear(subnormal)(torch.ones(1, 2))).all())

    def test_quantization_changes_real_storage_without_mutating_base(self):
        before = deepcopy(self.model.state_dict())
        compressed = quantize_int8(self.model)
        report = storage_report(compressed)
        self.assertEqual(report["quantized_linears"], 9)
        self.assertGreater(report["int8_weight_bytes"], 0)
        self.assertLess(report["state_tensor_bytes"], storage_report(self.model)["state_tensor_bytes"])
        self.assertEqual(report["trainable_parameters"], 0)
        self.assertFalse(any(name.endswith(".weight") and "attn.qkv" in name for name in compressed.state_dict()))
        for name, value in self.model.state_dict().items():
            torch.testing.assert_close(value, before[name], rtol=0, atol=0)
        self.assertTrue(torch.isfinite(compressed(self.ids)[0]).all())

    def test_quantized_reload_and_cache(self):
        data, tokenizer, split = prepare(ROOT / "data/corpus.txt", 7)
        base = TinyGPT(Config(len(tokenizer), context=12, width=12, heads=3, layers=2)).eval()
        compressed = quantize_int8(base)
        metadata = {"config": base.cfg.state(), "tokenizer": tokenizer.state(), "split": split,
                    "seed": 7, "step": 0, "torch_version": str(torch.__version__)}
        x = data["train"][:8].unsqueeze(0)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "int8.pt"
            save_inference(path, compressed, metadata, "int8-weight-only")
            restored, _, state = load_checkpoint(path)
            self.assertTrue(state["inference_only"])
            self.assertNotIn("optimizer", state)
            self.assertEqual(storage_report(restored)["trainable_parameters"], 0)
            torch.testing.assert_close(compressed(x)[0], restored(x)[0], rtol=0, atol=0)
            self.assertTrue(benchmark_cache(restored, [0, 1], steps=15, repeats=1)["logits_close"])

    def test_lora_initial_delta_is_zero_and_only_adapters_train(self):
        before = self.model(self.ids)[0].detach()
        add_lora(self.model, rank=2, alpha=4)
        torch.testing.assert_close(before, self.model(self.ids)[0], rtol=0, atol=0)
        for name, p in self.model.named_parameters():
            self.assertEqual(p.requires_grad, name.endswith((".a", ".b")))
        self.model(self.ids, self.ids)[1].backward()
        for m in self.model.modules():
            if isinstance(m, LoRALinear):
                self.assertTrue(torch.equal(m.a.grad, torch.zeros_like(m.a)))
                self.assertGreater(float(m.b.grad.abs().sum()), 0)

    def test_lora_analytical_branch_merge_and_finite_difference(self):
        base = nn.Linear(3, 2)
        layer = LoRALinear(base, rank=1, alpha=2)
        with torch.no_grad():
            layer.a.copy_(torch.tensor([[1., 2., 3.]]))
            layer.b.copy_(torch.tensor([[4.], [-2.]]))
        x = torch.tensor([[2., 1., -1.]])
        expected = base(x) + torch.tensor([[8., -4.]])
        torch.testing.assert_close(layer(x), expected)
        torch.testing.assert_close(layer.merged()(x), layer(x), rtol=1e-5, atol=1e-6)
        layer(x).sum().backward()
        analytical = float(layer.b.grad[0, 0])
        with torch.no_grad():
            original = float(layer.b[0, 0])
            layer.b[0, 0] = original + .001
            plus = float(layer(x).sum())
            layer.b[0, 0] = original - .001
            minus = float(layer(x).sum())
            layer.b[0, 0] = original
        self.assertAlmostEqual(analytical, (plus-minus) / .002, delta=.01)

    def test_actual_lora_learning_keeps_every_base_tensor_fixed(self):
        add_lora(self.model, rank=2, alpha=4)
        frozen = {n: p.detach().clone() for n, p in self.model.named_parameters() if not p.requires_grad}
        optimizer = torch.optim.AdamW([p for p in self.model.parameters() if p.requires_grad], lr=.03)
        initial = float(self.model(self.ids, self.ids)[1].detach())
        for _ in range(50):
            optimizer.zero_grad()
            loss = self.model(self.ids, self.ids)[1]
            loss.backward()
            optimizer.step()
        final = float(self.model(self.ids, self.ids)[1].detach())
        self.assertLess(final, initial * .95)
        for n, p in self.model.named_parameters():
            if n in frozen:
                torch.testing.assert_close(p, frozen[n], rtol=0, atol=0)
        merged = merge_lora(self.model)
        torch.testing.assert_close(self.model(self.ids)[0], merged(self.ids)[0], rtol=1e-4, atol=1e-5)
        self.assertFalse(any(isinstance(m, LoRALinear) for m in merged.modules()))

    def test_adapter_validation_is_atomic_and_precision_order_explicit(self):
        before = deepcopy(self.model.state_dict())
        for spec in ({"rank": 0}, {"alpha": float("nan")}, {"targets": ["unknown"]}):
            with self.assertRaises(ValueError):
                add_lora(self.model, **spec)
        for name, value in self.model.state_dict().items():
            torch.testing.assert_close(value, before[name], rtol=0, atol=0)
        add_lora(self.model)
        with self.assertRaises(ValueError):
            add_lora(self.model)
        with self.assertRaises(ValueError):
            quantize_int8(self.model)
        state = lora_state(self.model)
        state.pop(next(iter(state)))
        with self.assertRaises(ValueError):
            load_lora_state(self.model, state)
        self.assertTrue(torch.isfinite(quantize_int8(merge_lora(self.model))(self.ids)[0]).all())

    def test_adapter_artifact_requires_exact_base_and_roundtrips(self):
        _, tokenizer, split = prepare(ROOT / "data/corpus.txt", 7)
        base = TinyGPT(Config(len(tokenizer), context=12, width=12, heads=3, layers=1)).eval()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "base.pt"
            adapter = Path(tmp) / "adapter.pt"
            optimizer = torch.optim.AdamW(base.parameters())
            save_checkpoint(path, base, optimizer, tokenizer, split, 7, 0, torch.Generator(), [])
            adapted = deepcopy(base)
            add_lora(adapted, rank=2, alpha=4)
            with torch.no_grad():
                for m in adapted.modules():
                    if isinstance(m, LoRALinear):
                        m.b.normal_(std=.1)
            payload = {"adapter_format_version": 1, "base_checkpoint_sha256": checkpoint_hash(path),
                       "config": base.cfg.state(), "lora": {"rank": 2, "alpha": 4}, "adapter_state": lora_state(adapted)}
            atomic_save(payload, adapter)
            restored, _ = apply_adapter(deepcopy(base), path, adapter)
            torch.testing.assert_close(adapted(self.ids)[0], restored(self.ids)[0], rtol=0, atol=0)
            with self.assertRaises(ValueError):
                require_distinct(path, path)
            payload["base_checkpoint_sha256"] = "wrong"
            atomic_save(payload, adapter)
            with self.assertRaises(ValueError):
                apply_adapter(deepcopy(base), path, adapter)

    def test_cli_end_to_end_composition(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths = {key: str(Path(tmp) / (key + ".pt")) for key in ("base", "adapter", "merged", "int8")}
            adapted_data = Path(tmp) / "domain.txt"
            documents = (ROOT / "data/corpus.txt").read_text().split("\n\n")
            adapted_data.write_text("\n\n".join(reversed(documents[:12])))
            def cli(*args):
                r = subprocess.run([sys.executable, str(ROOT / "tiny_gpt.py"), *args],
                                   capture_output=True, text=True, timeout=45, cwd=ROOT)
                self.assertEqual(r.returncode, 0, r.stderr)
                return r.stdout
            cli("train", "--steps", "3", "--context", "12", "--width", "12", "--heads", "3", "--layers", "1", "--eval-batches", "1", "--checkpoint", paths["base"])
            report = json.loads(cli("lora-train", "--checkpoint", paths["base"], "--steps", "5", "--eval-batches", "1", "--rank", "2", "--output", paths["adapter"], "--data", str(adapted_data)))
            self.assertTrue(report["frozen_base_unchanged"])
            merge = json.loads(cli("merge-lora", "--checkpoint", paths["base"], "--adapter", paths["adapter"], "--output", paths["merged"]))
            self.assertLess(merge["merge_logit_max_abs_error"], 1e-5)
            quantized = json.loads(cli("quantize", "--checkpoint", paths["base"], "--adapter", paths["adapter"], "--output", paths["int8"], "--eval-batches", "1", "--data", str(adapted_data)))
            self.assertLess(quantized["int8_storage"]["state_tensor_bytes"], quantized["float_storage"]["state_tensor_bytes"])
            report = json.loads(cli("benchmark", "--checkpoint", paths["int8"], "--tokens", "15", "--repeats", "1", "--prompt", "the "))
            self.assertTrue(report["logits_close"])
            self.assertIn('"cache_rebuilt"', cli("generate", "--checkpoint", paths["int8"], "--tokens", "3", "--prompt", "the ", "--kv-cache", "--trace"))
            cli("evaluate", "--checkpoint", paths["base"], "--adapter", paths["adapter"], "--batches", "1", "--data", str(adapted_data))
            cli("evaluate", "--checkpoint", paths["int8"], "--batches", "1", "--data", str(adapted_data))
            self.assertEqual(json.loads(cli("inspect", "--checkpoint", paths["int8"]))["kind"], "int8-weight-only")
            invalid_resume = subprocess.run([sys.executable, str(ROOT / "tiny_gpt.py"), "train", "--resume", paths["int8"], "--steps", "1"],capture_output=True,text=True,cwd=ROOT,timeout=30)
            self.assertNotEqual(invalid_resume.returncode, 0)
            self.assertIn("inference-only", invalid_resume.stderr)


if __name__ == "__main__":
    unittest.main()
