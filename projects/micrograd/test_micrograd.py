import math
import unittest
from engine import Value
from main import verify_gradients
from nn import MLP, XOR, train_xor


class EngineTests(unittest.TestCase):
    def test_shared_operand_accumulates_both_edges(self):
        x = Value(3)
        y = x * x
        y.backward()
        self.assertEqual(x.grad, 6)

    def test_branch_merge_and_topological_order(self):
        x = Value(2)
        a = x * x
        (a * a + a).backward()
        self.assertEqual(x.grad, 36)  # 4*x**3 + 2*x

    def test_leaf_accumulation_and_explicit_reset(self):
        x = Value(3)
        y = (x * x) ** 2
        y.backward()
        self.assertEqual(x.grad, 108)
        y.backward()
        self.assertEqual(x.grad, 216)
        x.grad = 0
        y.backward()
        self.assertEqual(x.grad, 108)

    def test_arithmetic_and_reverse_operators(self):
        x = Value(2)
        y = 3 - x + 4 / x - x / 2 + (-x) + 2 * x
        self.assertEqual(y.data, 4)
        y.backward()
        self.assertAlmostEqual(x.grad, -1.5)

    def test_activations(self):
        x = Value(0.5)
        x.tanh().backward()
        self.assertAlmostEqual(x.grad, 1 - math.tanh(.5) ** 2)
        for data, expected in [(-2, 0), (0, 0), (2, 1)]:
            x = Value(data)
            x.relu().backward()
            self.assertEqual(x.grad, expected)

    def test_power_zero_and_fraction(self):
        x = Value(0)
        (x ** 0).backward()
        self.assertEqual(x.grad, 0)
        x = Value(4)
        (x ** .5).backward()
        self.assertEqual(x.grad, .25)
        with self.assertRaises(ValueError):
            Value(-2) ** .5

    def test_gradient_check_all_inputs(self):
        self.assertEqual(len(verify_gradients()), 3)

    def test_seed_and_parameter_reset(self):
        a, b = MLP(seed=7), MLP(seed=7)
        self.assertEqual([p.data for p in a.parameters()], [p.data for p in b.parameters()])
        a([1, -1]).backward()
        self.assertTrue(any(p.grad != 0 for p in a.parameters()))
        a.zero_grad()
        self.assertTrue(all(p.grad == 0 for p in a.parameters()))

    def test_xor_training_learns_non_linear_rule(self):
        model, history = train_xor()
        self.assertLess(history[-1], 0.02)
        self.assertLess(history[-1], history[0] / 20)
        for xs, target in XOR:
            self.assertEqual(model(xs).data > 0, target > 0)

    def test_dimension_check(self):
        with self.assertRaises(ValueError):
            MLP()([1])


if __name__ == "__main__":
    unittest.main()

