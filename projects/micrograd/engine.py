"""A small reverse-mode scalar autodiff engine, using only the standard library."""
from __future__ import annotations

import math


class Value:
    def __init__(self, data, children=(), op="", label=""):
        self.data = float(data)
        self.grad = 0.0
        # Keep operand order and repeated edges. Topological traversal deduplicates nodes.
        self._prev = tuple(children)
        self._op = op
        self.label = label
        self._backward = lambda: None

    def __repr__(self):
        return f"Value(data={self.data:.6g}, grad={self.grad:.6g})"

    @staticmethod
    def wrap(other):
        return other if isinstance(other, Value) else Value(other)

    def __add__(self, other):
        other = Value.wrap(other)
        out = Value(self.data + other.data, (self, other), "+")

        def backward():
            self.grad += out.grad
            other.grad += out.grad
        out._backward = backward
        return out

    __radd__ = __add__

    def __neg__(self):
        return self * -1

    def __sub__(self, other):
        return self + -Value.wrap(other)

    def __rsub__(self, other):
        return Value.wrap(other) + -self

    def __mul__(self, other):
        other = Value.wrap(other)
        out = Value(self.data * other.data, (self, other), "*")

        def backward():
            self.grad += other.data * out.grad
            other.grad += self.data * out.grad
        out._backward = backward
        return out

    __rmul__ = __mul__

    def __pow__(self, exponent):
        if not isinstance(exponent, (int, float)):
            raise TypeError("exponent must be a real constant")
        if self.data < 0 and not float(exponent).is_integer():
            raise ValueError("fractional powers of negative inputs are not real")
        if self.data == 0 and exponent < 1 and exponent != 0:
            raise ValueError("power or derivative is undefined at zero")
        out = Value(self.data ** exponent, (self,), f"**{exponent}")

        def backward():
            derivative = 0.0 if exponent == 0 else exponent * self.data ** (exponent - 1)
            self.grad += derivative * out.grad
        out._backward = backward
        return out

    def __truediv__(self, other):
        return self * Value.wrap(other) ** -1

    def __rtruediv__(self, other):
        return Value.wrap(other) * self ** -1

    def tanh(self):
        t = math.tanh(self.data)
        out = Value(t, (self,), "tanh")

        def backward():
            self.grad += (1 - t * t) * out.grad
        out._backward = backward
        return out

    def relu(self):
        out = Value(max(0, self.data), (self,), "relu")

        def backward():
            self.grad += (self.data > 0) * out.grad
        out._backward = backward
        return out

    def _topological(self):
        order, seen = [], set()

        def visit(node):
            if node in seen:
                return
            seen.add(node)
            for parent in node._prev:
                visit(parent)
            order.append(node)
        visit(self)
        return order

    def backward(self):
        """Seed a scalar output with 1; accumulate into leaves like PyTorch.

        Intermediate gradients are cleared per pass, so repeated calls on a
        retained scalar graph correctly accumulate only the leaf gradients.
        Do not mutate data between constructing a graph and calling backward.
        """
        order = self._topological()
        for node in order:
            if node._prev:
                node.grad = 0.0
        if self._prev:
            self.grad = 1.0
        else:
            self.grad += 1.0
        for node in reversed(order):
            node._backward()

