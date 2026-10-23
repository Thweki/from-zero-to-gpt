"""A deterministic tiny MLP. No NumPy, torch, or other high-level framework."""
import random
from engine import Value


class Neuron:
    def __init__(self, inputs, rng):
        bound = inputs ** -0.5
        self.w = [Value(rng.uniform(-bound, bound)) for _ in range(inputs)]
        self.b = Value(0)

    def __call__(self, xs):
        if len(xs) != len(self.w):
            raise ValueError("input dimension mismatch")
        return (sum((w * x for w, x in zip(self.w, xs)), self.b)).tanh()

    def parameters(self):
        return self.w + [self.b]


class MLP:
    def __init__(self, inputs=2, widths=(8, 1), seed=7):
        rng = random.Random(seed)
        self.layers = []
        for width in widths:
            self.layers.append([Neuron(inputs, rng) for _ in range(width)])
            inputs = width

    def __call__(self, xs):
        for layer in self.layers:
            xs = [neuron(xs) for neuron in layer]
        return xs[0] if len(xs) == 1 else xs

    def parameters(self):
        return [p for layer in self.layers for neuron in layer for p in neuron.parameters()]

    def zero_grad(self):
        for p in self.parameters():
            p.grad = 0.0


XOR = [([-1, -1], -1), ([-1, 1], 1), ([1, -1], 1), ([1, 1], -1)]


def train_xor(steps=1000, learning_rate=0.08, seed=7):
    model = MLP(seed=seed)
    history = []
    for _ in range(steps):
        predictions = [model(xs) for xs, _ in XOR]
        loss = sum((prediction - y) ** 2 for prediction, (_, y) in zip(predictions, XOR)) / len(XOR)
        model.zero_grad()
        loss.backward()
        for p in model.parameters():
            p.data -= learning_rate * p.grad
        history.append(loss.data)
    return model, history

