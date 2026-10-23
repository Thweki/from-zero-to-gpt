#!/usr/bin/env python3
"""Local CPU train/evaluate/generate/inspect CLI. See README.md."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import torch
from model import Config, TinyGPT, generate
from tokenizer import CharacterTokenizer, bpe_demo
from efficient import add_lora, lora_state, load_lora_state, merge_lora, quantize_int8, storage_report
from benchmark import benchmark_cache

ROOT = Path(__file__).resolve().parent


def read_documents(path):
    raw = Path(path).read_text(encoding="utf-8")
    docs = [x.strip() + "\n" for x in raw.split("\n\n") if x.strip()]
    if len(docs) < 4:
        raise ValueError("need at least four blank-line-separated documents")
    return docs, hashlib.sha256(raw.encode()).hexdigest()


def prepare(path, seed, split=None, tokenizer=None):
    docs, digest = read_documents(path)
    if split is None:
        indices = list(range(len(docs)))
        random.Random(seed).shuffle(indices)
        n = max(1, len(indices) // 5)
        split = {"train": indices[n:], "validation": indices[:n], "data_sha256": digest}
    if digest != split["data_sha256"]:
        raise ValueError("corpus checksum differs from checkpoint; use the original corpus")
    if set(split["train"]) & set(split["validation"]):
        raise ValueError("document split overlaps")
    texts = {name: "".join(docs[i] for i in split[name]) for name in ("train", "validation")}
    tokenizer = tokenizer or CharacterTokenizer.fit(texts["train"])
    data = {name: torch.tensor(tokenizer.encode(text), dtype=torch.long) for name, text in texts.items()}
    return data, tokenizer, split


def batch(data, context, size, generator):
    if len(data) <= context:
        raise ValueError("split must contain more tokens than context length")
    starts = torch.randint(len(data) - context, (size,), generator=generator)
    x = torch.stack([data[i:i + context] for i in starts])
    y = torch.stack([data[i + 1:i + context + 1] for i in starts])
    return x, y


@torch.no_grad()
def evaluate(model, data, batches=10, batch_size=8):
    was_training = model.training
    model.eval()
    result = {}
    for name, tokens in data.items():
        gen = torch.Generator().manual_seed(2026)
        total = 0.0
        for _ in range(batches):
            x, y = batch(tokens, model.cfg.context, batch_size, gen)
            _, loss = model(x, y)
            total += float(loss)
        average = total / batches
        result[name] = {"loss_nats": average, "perplexity": math.exp(average)}
    model.train(was_training)
    return result


def save_checkpoint(path, model, optimizer, tokenizer, split, seed, step, sampler, history, training=None):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    state = {"format_version": 1, "config": model.cfg.state(), "model": model.state_dict(),
             "optimizer": optimizer.state_dict(), "tokenizer": tokenizer.state(), "split": split,
             "seed": seed, "step": step, "sampler_rng": sampler.get_state(),
             "torch_rng": torch.get_rng_state(), "history": history,
             "training": training or {},
             "torch_version": str(torch.__version__)}
    temporary = path.with_name(path.name + ".tmp")
    torch.save(state, temporary)
    temporary.replace(path)


def load_checkpoint(path):
    state = torch.load(path, map_location="cpu", weights_only=True)
    if state["format_version"] not in (1, 2):
        raise ValueError("unsupported checkpoint format")
    model = TinyGPT(Config(**state["config"]))
    kind = state.get("kind", "float")
    if kind == "int8-weight-only":
        model = quantize_int8(model)
    elif kind != "float":
        raise ValueError("unsupported model kind")
    model.load_state_dict(state["model"])
    if state.get("inference_only"):
        model.requires_grad_(False)
    model.eval()
    return model, CharacterTokenizer.from_state(state["tokenizer"]), state


def atomic_save(state, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    torch.save(state, temporary)
    temporary.replace(path)


def require_distinct(output, *inputs):
    if Path(output).resolve() in {Path(p).resolve() for p in inputs if p}:
        raise ValueError("output must not overwrite its base checkpoint or adapter")


def save_inference(path, model, source_state, kind="float", provenance=None):
    # No stale optimizer: a merged/quantized artifact is inference-only.
    state = {key: source_state[key] for key in ("config", "tokenizer", "split", "seed", "step", "torch_version")}
    state.update(format_version=2, kind=kind, model=model.state_dict(),
                 inference_only=True, provenance=provenance or {})
    atomic_save(state, path)


def checkpoint_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def apply_adapter(model, base_path, adapter_path):
    state = torch.load(adapter_path, map_location="cpu", weights_only=True)
    if state.get("adapter_format_version") != 1:
        raise ValueError("unsupported adapter format")
    if state["base_checkpoint_sha256"] != checkpoint_hash(base_path) or state["config"] != model.cfg.state():
        raise ValueError("adapter belongs to a different base checkpoint")
    add_lora(model, **state["lora"])
    load_lora_state(model, state["adapter_state"])
    model.eval()
    return model, state


def lora_train(args):
    require_distinct(args.output, args.checkpoint)
    torch.manual_seed(args.seed)
    model, tokenizer, base_state = load_checkpoint(args.checkpoint)
    data, _, split = prepare(args.data, args.seed, tokenizer=tokenizer)
    targets = args.targets.split(",")
    spec = {"rank": args.rank, "alpha": args.alpha, "targets": targets}
    add_lora(model, **spec)
    before = evaluate(model, data, args.eval_batches, args.batch)
    # Snapshot frozen tensors; validate they remain bit-identical after training.
    frozen = {name: p.detach().clone() for name, p in model.named_parameters() if not p.requires_grad}
    optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.lr, weight_decay=0.0)
    sampler = torch.Generator().manual_seed(args.seed + 1)
    model.train()
    for _ in range(args.steps):
        x, y = batch(data["train"], model.cfg.context, args.batch, sampler)
        optimizer.zero_grad(set_to_none=True)
        _, loss = model(x, y)
        if not torch.isfinite(loss):
            raise RuntimeError("non-finite adapter training loss")
        loss.backward()
        torch.nn.utils.clip_grad_norm_([p for p in model.parameters() if p.requires_grad], 1.0)
        optimizer.step()
    after = evaluate(model, data, args.eval_batches, args.batch)
    unchanged = all(torch.equal(frozen[name], p) for name, p in model.named_parameters() if name in frozen)
    if not unchanged:
        raise RuntimeError("frozen base changed during LoRA training")
    state = {"adapter_format_version": 1, "base_checkpoint_sha256": checkpoint_hash(args.checkpoint),
             "config": model.cfg.state(), "lora": spec, "adapter_state": lora_state(model),
             "training": {"steps": args.steps, "seed": args.seed, "lr": args.lr, "batch": args.batch,
                          "split": split, "before": before, "after": after},
             "torch_version": str(torch.__version__)}
    atomic_save(state, args.output)
    print(json.dumps({"adapter": args.output, "base_step": base_state["step"], "frozen_base_unchanged": unchanged,
                      "before": before, "after": after, "storage": storage_report(model)}, indent=2))


def train(args):
    torch.manual_seed(args.seed)
    random.seed(args.seed)
    sampler = torch.Generator().manual_seed(args.seed + 1)
    start, history = 0, []
    if args.resume:
        model, tokenizer, state = load_checkpoint(args.resume)
        if state.get("inference_only") or "optimizer" not in state:
            raise ValueError("this checkpoint is inference-only; resume from a training checkpoint")
        data, tokenizer, split = prepare(args.data, state["seed"], state["split"], tokenizer)
        optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
        optimizer.load_state_dict(state["optimizer"])
        sampler.set_state(state["sampler_rng"])
        torch.set_rng_state(state["torch_rng"])
        args.seed, start, history = state["seed"], state["step"], list(state["history"])
    else:
        data, tokenizer, split = prepare(args.data, args.seed)
        model = TinyGPT(Config(len(tokenizer), args.context, args.width, args.heads, args.layers))
        optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    initial = evaluate(model, data, args.eval_batches, args.batch)
    print(json.dumps({"step": start, "evaluation": initial}, ensure_ascii=False))
    model.train()
    for step in range(start + 1, start + args.steps + 1):
        x, y = batch(data["train"], model.cfg.context, args.batch, sampler)
        optimizer.zero_grad(set_to_none=True)
        _, loss = model(x, y)
        if not torch.isfinite(loss):
            raise RuntimeError("non-finite training loss")
        loss.backward()
        grad_norm = torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        if step % args.log_every == 0 or step == start + args.steps:
            metrics = evaluate(model, data, args.eval_batches, args.batch)
            item = {"step": step, "batch_loss": float(loss.detach()), "gradient_norm": float(grad_norm), "evaluation": metrics}
            history.append(item)
            print(json.dumps(item, ensure_ascii=False))
    save_checkpoint(args.checkpoint, model, optimizer, tokenizer, split, args.seed,
                    start + args.steps, sampler, history,
                    {"batch": args.batch, "optimizer": "AdamW", "lr": optimizer.param_groups[0]["lr"],
                     "weight_decay": optimizer.param_groups[0]["weight_decay"], "clip_norm": 1.0,
                     "eval_batches": args.eval_batches, "log_every": args.log_every})
    print(f"saved {args.checkpoint}; parameters={sum(p.numel() for p in model.parameters())}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--threads", type=int, default=1, help="CPU threads (one is fast for this tiny model)")
    commands = parser.add_subparsers(dest="command", required=True)
    train_p = commands.add_parser("train")
    train_p.add_argument("--data", default=str(ROOT / "data/corpus.txt"))
    train_p.add_argument("--checkpoint", default="runs/tiny.pt")
    train_p.add_argument("--resume")
    for name, default in (("steps", 250), ("context", 48), ("width", 48), ("heads", 3), ("layers", 2), ("batch", 8), ("seed", 42), ("eval-batches", 5), ("log-every", 50)):
        train_p.add_argument("--" + name, type=int, default=default)
    train_p.add_argument("--lr", type=float, default=0.003)
    for command in ("evaluate", "generate", "inspect", "benchmark", "quantize", "merge-lora", "lora-train"):
        sub = commands.add_parser(command)
        sub.add_argument("--checkpoint", default="runs/tiny.pt")
        if command != "lora-train":
            sub.add_argument("--adapter", help="adapter-only artifact; requires its exact floating-point base")
        if command == "evaluate":
            sub.add_argument("--data", default=str(ROOT / "data/corpus.txt"))
            sub.add_argument("--batches", type=int, default=20)
        if command == "generate":
            sub.add_argument("--prompt", default="the ")
            sub.add_argument("--tokens", type=int, default=100)
            sub.add_argument("--temperature", type=float, default=0.8)
            sub.add_argument("--top-k", type=int, default=0)
            sub.add_argument("--top-p", type=float, default=1.0)
            sub.add_argument("--seed", type=int, default=123)
            sub.add_argument("--trace", action="store_true")
            sub.add_argument("--kv-cache", action="store_true", help="reuse KV within a window; rebuild on rollover")
        if command == "benchmark":
            sub.add_argument("--prompt", default="the garden")
            sub.add_argument("--tokens", type=int, default=24)
            sub.add_argument("--repeats", type=int, default=5)
        if command in ("quantize", "lora-train"):
            sub.add_argument("--output", default="runs/tiny-int8.pt" if command == "quantize" else "runs/adapter.pt")
            sub.add_argument("--data", default=str(ROOT / "data/corpus.txt"))
            sub.add_argument("--eval-batches", type=int, default=5)
            sub.add_argument("--batch", type=int, default=8)
        if command == "merge-lora":
            sub.add_argument("--output", default="runs/merged.pt")
        if command == "lora-train":
            sub.add_argument("--steps", type=int, default=100)
            sub.add_argument("--rank", type=int, default=4)
            sub.add_argument("--alpha", type=float, default=8.0)
            sub.add_argument("--targets", default="attn.qkv,attn.out")
            sub.add_argument("--seed", type=int, default=42)
            sub.add_argument("--lr", type=float, default=0.01)
    commands.add_parser("bpe-demo")
    args = parser.parse_args()
    if args.threads < 1:
        parser.error("threads must be positive")
    torch.set_num_threads(args.threads)
    if args.command in ("train", "lora-train"):
        if min(args.steps, args.batch, args.eval_batches, getattr(args, "log_every", 1)) < 1 or not math.isfinite(args.lr) or args.lr <= 0:
            parser.error("training counts and learning rate must be positive")
        (train if args.command == "train" else lora_train)(args)
    elif args.command == "bpe-demo":
        print(json.dumps(bpe_demo(), indent=2))
    else:
        model, tokenizer, state = load_checkpoint(args.checkpoint)
        if args.adapter:
            model, adapter_state = apply_adapter(model, args.checkpoint, args.adapter)
            state = {**state, "split": adapter_state["training"]["split"], "seed": adapter_state["training"]["seed"]}
        if args.command == "generate":
            ids, trace = generate(model, tokenizer.encode(args.prompt), args.tokens, args.seed, args.temperature, args.top_k, args.top_p, args.kv_cache)
            print(tokenizer.decode(ids))
            if args.trace:
                print(json.dumps(trace, ensure_ascii=False))
        elif args.command == "evaluate":
            if args.batches < 1:
                parser.error("batches must be positive")
            data, _, _ = prepare(args.data, state["seed"], state["split"], tokenizer)
            print(json.dumps(evaluate(model, data, args.batches), indent=2))
        elif args.command == "benchmark":
            print(json.dumps(benchmark_cache(model, tokenizer.encode(args.prompt), args.tokens, args.repeats), indent=2))
        elif args.command == "merge-lora":
            if not args.adapter:
                parser.error("merge-lora requires --adapter")
            require_distinct(args.output, args.checkpoint, args.adapter)
            merged = merge_lora(model)
            probe = torch.zeros((1, min(4, model.cfg.context)), dtype=torch.long)
            with torch.no_grad():
                difference = float((model(probe)[0] - merged(probe)[0]).abs().max())
            save_inference(args.output, merged, state, provenance={"adapter_base_sha256": checkpoint_hash(args.checkpoint)})
            print(json.dumps({"output": args.output, "merge_logit_max_abs_error": difference, "storage": storage_report(merged)}, indent=2))
        elif args.command == "quantize":
            if min(args.eval_batches, args.batch) < 1:
                parser.error("evaluation counts must be positive")
            require_distinct(args.output, args.checkpoint, args.adapter)
            model = merge_lora(model)
            data, _, _ = prepare(args.data, state["seed"], state["split"], tokenizer)
            compressed = quantize_int8(model)
            probe = data["validation"][:model.cfg.context].unsqueeze(0)
            with torch.no_grad():
                difference = float((model(probe)[0] - compressed(probe)[0]).abs().max())
            save_inference(args.output, compressed, state, "int8-weight-only")
            print(json.dumps({"output": args.output, "float_storage": storage_report(model),
                              "int8_storage": storage_report(compressed), "probe_logit_max_abs_error": difference,
                              "float_evaluation": evaluate(model, data, args.eval_batches, args.batch),
                              "int8_evaluation": evaluate(compressed, data, args.eval_batches, args.batch),
                              "note": "weight storage only; dequantized floating-point compute, no int8 kernel or speed claim"}, indent=2))
        else:
            print(json.dumps({"config": state["config"], "kind": state.get("kind", "float"), "storage": storage_report(model),
                              "parameters": sum(p.numel() for p in model.parameters()),
                              "step": state["step"], "seed": state["seed"], "tokenizer": tokenizer.state(),
                              "split": state["split"], "training": state.get("training", {}), "torch_version": state["torch_version"],
                              "parameter_shapes": {n: list(p.shape) for n, p in model.named_parameters()},
                              "buffer_shapes_and_dtypes": {n: {"shape": list(p.shape), "dtype": str(p.dtype)} for n, p in model.named_buffers()}}, indent=2))


if __name__ == "__main__":
    main()
