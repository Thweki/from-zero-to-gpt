"""Run with: python -m unittest -v. All tests use actual local tensor operations."""
import math
from pathlib import Path
import tempfile
import unittest
import torch
from model import Config, TinyGPT, LayerNorm, filtered_probabilities, generate
from tokenizer import CharacterTokenizer, bpe_demo
from tiny_gpt import ROOT, batch, evaluate, prepare, save_checkpoint, load_checkpoint

torch.set_num_threads(1)


class TinyGPTTests(unittest.TestCase):
    def setUp(self):
        torch.manual_seed(7)
        self.data, self.tokenizer, self.split = prepare(ROOT / "data/corpus.txt", 7)
        self.model = TinyGPT(Config(len(self.tokenizer), context=16, width=24, heads=3, layers=1))
        self.generator = torch.Generator().manual_seed(8)

    def test_tokenizer_and_bpe_roundtrip(self):
        text = "the garden"
        self.assertEqual(self.tokenizer.decode(self.tokenizer.encode(text)), text)
        self.assertEqual(CharacterTokenizer.from_state(self.tokenizer.state()).chars, self.tokenizer.chars)
        with self.assertRaises(ValueError):
            self.tokenizer.encode("\U0001f680")
        demo = bpe_demo()
        self.assertEqual("".join(demo["tokens"]), "banana bandana")
        self.assertEqual(demo["merges"][0]["pair"], ["a", "n"])

    def test_split_and_shifted_targets(self):
        self.assertFalse(set(self.split["train"]) & set(self.split["validation"]))
        x, y = batch(self.data["train"], 16, 4, self.generator)
        self.assertEqual(tuple(x.shape), (4, 16))
        self.assertTrue(torch.equal(x[:, 1:], y[:, :-1]))

    def test_causality_and_shapes(self):
        ids = torch.randint(len(self.tokenizer), (2, 12), generator=self.generator)
        modified = ids.clone()
        modified[:, 7:] = (modified[:, 7:] + 1) % len(self.tokenizer)
        self.model.eval()
        a, _ = self.model(ids)
        b, _ = self.model(modified)
        self.assertEqual(tuple(a.shape), (2, 12, len(self.tokenizer)))
        torch.testing.assert_close(a[:, :7], b[:, :7], rtol=0, atol=0)
        short, _ = self.model(ids[:, :7])
        torch.testing.assert_close(a[:, :7], short, rtol=1e-5, atol=1e-6)

    def test_layernorm_matches_formula(self):
        x = torch.tensor([[[1.0, 2.0, 3.0], [3.0, 8.0, 1.0]]])
        out = LayerNorm(3)(x)
        expected = (x - x.mean(-1, keepdim=True)) / torch.sqrt(x.var(-1, correction=0, keepdim=True) + 1e-5)
        torch.testing.assert_close(out, expected)

    def test_sampling_renormalization_and_reproducibility(self):
        logits = torch.tensor([math.log(.5), math.log(.3), math.log(.15), math.log(.05)])
        p = filtered_probabilities(logits, top_p=.7)
        torch.testing.assert_close(p, torch.tensor([.625, .375, 0., 0.]))
        k = filtered_probabilities(logits, top_k=1)
        torch.testing.assert_close(k, torch.tensor([1., 0., 0., 0.]))
        a, _ = generate(self.model, [0], 5, seed=5)
        b, _ = generate(self.model, [0], 5, seed=5)
        self.assertEqual(a, b)
        with self.assertRaises(ValueError):
            filtered_probabilities(logits, temperature=0)

    def test_loss_backward_and_real_learning(self):
        # Hold one batch fixed: a precise, inexpensive learnability test, not a generalization claim.
        x, y = batch(self.data["train"], 16, 8, self.generator)
        optimizer = torch.optim.AdamW(self.model.parameters(), lr=.01)
        initial = float(self.model(x, y)[1].detach())
        for _ in range(45):
            optimizer.zero_grad(set_to_none=True)
            _, loss = self.model(x, y)
            loss.backward()
            self.assertTrue(all(p.grad is not None and torch.isfinite(p.grad).all() for p in self.model.parameters()))
            optimizer.step()
        final = float(self.model(x, y)[1].detach())
        print(f"\nactual fixed-batch training loss: {initial:.6f} -> {final:.6f}")
        self.assertLess(final, initial * .6)

    def test_checkpoint_logits_and_optimizer_resume(self):
        optimizer = torch.optim.AdamW(self.model.parameters(), lr=.003)
        x, y = batch(self.data["train"], 16, 4, self.generator)
        optimizer.zero_grad()
        self.model(x, y)[1].backward()
        optimizer.step()
        self.model.eval()
        before = self.model(x)[0].detach()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "tiny.pt"
            save_checkpoint(path, self.model, optimizer, self.tokenizer, self.split, 7, 1, self.generator, [])
            loaded, tokenizer, state = load_checkpoint(path)
            torch.testing.assert_close(before, loaded(x)[0], rtol=0, atol=0)
            self.assertEqual(tokenizer.chars, self.tokenizer.chars)
            restored_optimizer = torch.optim.AdamW(loaded.parameters(), lr=.99)
            restored_optimizer.load_state_dict(state["optimizer"])
            restored_generator = torch.Generator().set_state(state["sampler_rng"])
            next_x, next_y = batch(self.data["train"], 16, 4, self.generator)
            clone_x, clone_y = batch(self.data["train"], 16, 4, restored_generator)
            self.assertTrue(torch.equal(next_x, clone_x))
            for model, opt, bx, by in ((self.model, optimizer, next_x, next_y), (loaded, restored_optimizer, clone_x, clone_y)):
                opt.zero_grad()
                model(bx, by)[1].backward()
                opt.step()
            for a, b in zip(self.model.parameters(), loaded.parameters()):
                torch.testing.assert_close(a, b, rtol=0, atol=0)

    def test_evaluation_does_not_change_parameters(self):
        before = {name: p.detach().clone() for name, p in self.model.named_parameters()}
        scores = evaluate(self.model, self.data, batches=2, batch_size=2)
        self.assertGreater(scores["validation"]["perplexity"], 1)
        for name, p in self.model.named_parameters():
            torch.testing.assert_close(p, before[name], rtol=0, atol=0)


if __name__ == "__main__":
    unittest.main()
