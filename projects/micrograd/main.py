"""Run: python main.py check  OR  python main.py train --steps 1000."""
import argparse
from engine import Value
from nn import XOR, train_xor


def verify_gradients():
    def objective(w, x, b):
        return ((w * x + b).tanh() + x * x) ** 2

    point = [0.7, -0.4, 0.2]
    values = [Value(v) for v in point]
    objective(*values).backward()
    rows = []
    for i, value in enumerate(values):
        plus, minus = point.copy(), point.copy()
        plus[i] += 1e-5
        minus[i] -= 1e-5
        high = objective(*[Value(v) for v in plus]).data
        low = objective(*[Value(v) for v in minus]).data
        numeric = (high - low) / 2e-5
        assert abs(value.grad - numeric) < 1e-7, (i, value.grad, numeric)
        rows.append(("wxb"[i], value.grad, numeric))
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["check", "train"])
    parser.add_argument("--steps", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()
    if args.command == "check":
        for name, exact, numeric in verify_gradients():
            print(f"{name}: autodiff={exact:.9f}, finite-difference={numeric:.9f}")
        print("All gradient checks passed.")
    else:
        if args.steps < 1:
            parser.error("--steps must be positive")
        model, history = train_xor(steps=args.steps, seed=args.seed)
        print(f"seed={args.seed}; loss: {history[0]:.6f} -> {history[-1]:.6f}")
        correct = 0
        for xs, target in XOR:
            prediction = model(xs).data
            correct += (prediction > 0) == (target > 0)
            print(f"x={xs}, target={target:+d}, prediction={prediction:+.5f}")
        print(f"training accuracy: {correct}/4 (only a toy fitting check)")


if __name__ == "__main__":
    main()

