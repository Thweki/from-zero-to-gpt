"""Independent analytic, numerical, holdout and CLI checks; Python stdlib only."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from regression import gradients, make_splits, mse, predict, train


class RegressionTests(unittest.TestCase):
    def test_predictions_and_mse_have_analytic_values(self):
        self.assertEqual(predict(-2, 3, 1), -5)
        self.assertAlmostEqual(mse([(0, 1), (1, 4)], 2, 0), 2.5)

    def test_gradient_matches_independent_finite_difference(self):
        rows = [(-0.9, -1), (0.1, 0.8), (1.5, 2)]
        w, b, h = 0.3, -0.4, 1e-6
        gw, gb = gradients(rows, w, b)
        numerical_w = (mse(rows, w + h, b) - mse(rows, w - h, b)) / (2 * h)
        numerical_b = (mse(rows, w, b + h) - mse(rows, w, b - h)) / (2 * h)
        self.assertAlmostEqual(gw, numerical_w, places=7)
        self.assertAlmostEqual(gb, numerical_b, places=7)

    def test_one_step_uses_two_old_parameters(self):
        w, b, history = train([(-1, -1), (0, 1), (1, 3)], lr=0.1, steps=1)
        self.assertAlmostEqual(w, 4 / 15)
        self.assertAlmostEqual(b, 0.2)
        self.assertEqual(len(history), 2)

    def test_exact_linear_recovery_including_negative_slope(self):
        for true_w, true_b in [(2, 1), (-1.2, -0.3), (0, 4)]:
            rows = [(x, true_w * x + true_b) for x in [-1, -0.5, 0, 0.5, 1]]
            w, b, _ = train(rows, steps=600)
            self.assertAlmostEqual(w, true_w, places=7)
            self.assertAlmostEqual(b, true_b, places=7)

    def test_reproducible_disjoint_splits_and_holdout_improvement(self):
        splits = make_splits(7)
        self.assertEqual(splits, make_splits(7))
        self.assertNotEqual(splits, make_splits(8))
        self.assertEqual([len(group) for group in splits], [72, 24, 24])
        self.assertEqual(len(set(row for group in splits for row in group)), 120)
        training, validation, testing = splits
        w, b, history = train(training)
        baseline = sum(y for _, y in training) / len(training)
        self.assertLess(history[-1], history[0] / 20)
        self.assertLess(mse(validation, w, b), 0.06)
        self.assertLess(mse(testing, w, b), mse(testing, 0, baseline) / 20)

    def test_cli_saves_loads_predicts_and_evaluates(self):
        script = Path(__file__).with_name("regression.py")
        with tempfile.TemporaryDirectory() as directory:
            model = Path(directory) / "model.json"
            result = subprocess.run([sys.executable, str(script), "train", "--output", str(model)], check=True, capture_output=True, text=True)
            report = json.loads(result.stdout)
            self.assertNotIn("test_mse", report, "training must not report test results")
            self.assertLess(report["validation_mse"], 0.06)
            prediction = subprocess.run([sys.executable, str(script), "predict", "--model", str(model), "--x", "0", "1"], check=True, capture_output=True, text=True)
            rows = json.loads(prediction.stdout)
            self.assertAlmostEqual(rows[1]["prediction"] - rows[0]["prediction"], report["w"])
            evaluation = subprocess.run([sys.executable, str(script), "evaluate", "--model", str(model)], check=True, capture_output=True, text=True)
            self.assertEqual(json.loads(evaluation.stdout)["test_count"], 24)


if __name__ == "__main__":
    unittest.main()
