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
    if state["format_version"] != 1:
        raise ValueError("unsupported checkpoint format")
    model = TinyGPT(Config(**state["config"]))
    model.load_state_dict(state["model"])
    model.eval()
    return model, CharacterTokenizer.from_state(state["tokenizer"]), state


def train(args):
    torch.manual_seed(args.seed)
    random.seed(args.seed)
    sampler = torch.Generator().manual_seed(args.seed + 1)
    start, history = 0, []
    if args.resume:
        model, tokenizer, state = load_checkpoint(args.resume)
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
    for command in ("evaluate", "generate", "inspect"):
        sub = commands.add_parser(command)
        sub.add_argument("--checkpoint", default="runs/tiny.pt")
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
    commands.add_parser("bpe-demo")
    args = parser.parse_args()
    if args.threads < 1:
        parser.error("threads must be positive")
    torch.set_num_threads(args.threads)
    if args.command == "train":
        if min(args.steps, args.batch, args.eval_batches, args.log_every) < 1 or args.lr <= 0:
            parser.error("training counts and learning rate must be positive")
        train(args)
    elif args.command == "bpe-demo":
        print(json.dumps(bpe_demo(), indent=2))
    else:
        model, tokenizer, state = load_checkpoint(args.checkpoint)
        if args.command == "generate":
            ids, trace = generate(model, tokenizer.encode(args.prompt), args.tokens, args.seed, args.temperature, args.top_k, args.top_p)
            print(tokenizer.decode(ids))
            if args.trace:
                print(json.dumps(trace, ensure_ascii=False))
        elif args.command == "evaluate":
            if args.batches < 1:
                parser.error("batches must be positive")
            data, _, _ = prepare(args.data, state["seed"], state["split"], tokenizer)
            print(json.dumps(evaluate(model, data, args.batches), indent=2))
        else:
            print(json.dumps({"config": state["config"], "parameters": sum(p.numel() for p in model.parameters()),
                              "step": state["step"], "seed": state["seed"], "tokenizer": tokenizer.state(),
                              "split": state["split"], "training": state.get("training", {}), "torch_version": state["torch_version"],
                              "parameter_shapes": {n: list(p.shape) for n, p in model.named_parameters()}}, indent=2))


if __name__ == "__main__":
    main()
