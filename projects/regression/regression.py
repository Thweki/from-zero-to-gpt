#!/usr/bin/env python3
"""A reproducible, standard-library-only linear regression training project."""
import argparse
import json
import math
from pathlib import Path
import random


def make_splits(seed=7, count=120, noise=0.15):
    """Synthetic y=1.8x-0.4+Gaussian noise; no downloaded/private data."""
    if count < 10 or noise < 0:
        raise ValueError("count must be >=10 and noise nonnegative")
    rng = random.Random(seed)
    rows = []
    for _ in range(count):
        x = rng.uniform(-2, 2)
        rows.append((x, 1.8 * x - 0.4 + rng.gauss(0, noise)))
    rng.shuffle(rows)
    first, second = int(count * 0.6), int(count * 0.8)
    return rows[:first], rows[first:second], rows[second:]


def predict(x, w, b):
    return w * x + b


def mse(rows, w, b):
    if not rows:
        raise ValueError("MSE requires nonempty data")
    return sum((predict(x, w, b) - y) ** 2 for x, y in rows) / len(rows)


def gradients(rows, w, b):
    if not rows:
        raise ValueError("gradients require nonempty data")
    errors = [(predict(x, w, b) - y, x) for x, y in rows]
    return (2 * sum(e * x for e, x in errors) / len(rows),
            2 * sum(e for e, _ in errors) / len(rows))


def train(rows, lr=0.05, steps=400, w=0.0, b=0.0):
    if not rows or not math.isfinite(lr) or lr <= 0 or steps < 0:
        raise ValueError("use nonempty data, positive finite learning rate and nonnegative steps")
    history = [mse(rows, w, b)]
    for _ in range(steps):
        gw, gb = gradients(rows, w, b)
        w, b = w - lr * gw, b - lr * gb
        loss = mse(rows, w, b)
        if not all(math.isfinite(value) for value in (w, b, loss)):
            raise ValueError("training diverged; reduce --lr")
        history.append(loss)
    return w, b, history


def load_model(path):
    model = json.loads(Path(path).read_text(encoding="utf-8"))
    if model.get("schema") != 1:
        raise ValueError("unsupported model schema")
    for name in ("w", "b"):
        if not isinstance(model.get(name), (int, float)) or not math.isfinite(model[name]):
            raise ValueError("model parameters must be finite")
    if not isinstance(model.get("seed"), int):
        raise ValueError("model must include its dataset seed")
    return model


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    fit = sub.add_parser("train", help="fit training split and report validation MSE")
    fit.add_argument("--seed", type=int, default=7)
    fit.add_argument("--lr", type=float, default=0.05)
    fit.add_argument("--steps", type=int, default=400)
    fit.add_argument("--output", type=Path, default=Path("model.json"))
    infer = sub.add_parser("predict", help="load saved weights for inference")
    infer.add_argument("--model", type=Path, default=Path("model.json"))
    infer.add_argument("--x", type=float, nargs="+", required=True)
    evaluate = sub.add_parser("evaluate", help="evaluate the untouched test split")
    evaluate.add_argument("--model", type=Path, default=Path("model.json"))
    args = parser.parse_args(argv)
    try:
        if args.command == "train":
            training, validation, _ = make_splits(args.seed)
            w, b, history = train(training, args.lr, args.steps)
            model = {"schema": 1, "w": w, "b": b, "seed": args.seed,
                     "steps": args.steps, "lr": args.lr,
                     "data": "synthetic y=1.8*x-0.4; x~Uniform[-2,2]; noise~Normal(0,0.15)"}
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(model, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(json.dumps({"train_count": len(training), "validation_count": len(validation),
                              "initial_train_mse": history[0], "train_mse": history[-1],
                              "validation_mse": mse(validation, w, b),
                              "w": w, "b": b, "model": str(args.output)}, ensure_ascii=False, indent=2))
        elif args.command == "predict":
            model = load_model(args.model)
            if not all(math.isfinite(x) for x in args.x):
                raise ValueError("inputs must be finite")
            print(json.dumps([{"x": x, "prediction": predict(x, model["w"], model["b"])} for x in args.x], indent=2))
        else:
            model = load_model(args.model)
            training, _, testing = make_splits(model["seed"])
            # The constant baseline uses training labels only.
            baseline = sum(y for _, y in training) / len(training)
            print(json.dumps({"test_count": len(testing), "test_mse": mse(testing, model["w"], model["b"]),
                              "constant_baseline_mse": mse(testing, 0, baseline)}, indent=2))
    except (ValueError, OSError, KeyError, TypeError, OverflowError) as error:
        parser.exit(2, f"error: {error}\n")


if __name__ == "__main__":
    main()
