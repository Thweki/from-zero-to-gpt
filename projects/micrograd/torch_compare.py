"""Optional local Python comparison. Requires a separately installed PyTorch."""
import torch
from engine import Value


def compare():
    scalar = Value(0.7)
    loss = (scalar * 1.5 + 0.2) ** 2
    loss.backward()
    tensor = torch.tensor(0.7, dtype=torch.float64, requires_grad=True)
    tensor_loss = (tensor * 1.5 + 0.2) ** 2
    tensor_loss.backward()
    assert abs(scalar.grad - tensor.grad.item()) < 1e-10
    x = torch.tensor([[-1.0, -1.0], [-1.0, 1.0], [1.0, -1.0], [1.0, 1.0]])
    torch.manual_seed(7)
    model = torch.nn.Sequential(torch.nn.Linear(2, 8), torch.nn.Tanh(), torch.nn.Linear(8, 1), torch.nn.Tanh())
    y = torch.tensor([[-1.0], [1.0], [1.0], [-1.0]])
    optimizer = torch.optim.SGD(model.parameters(), lr=0.08)
    for _ in range(1500):
        prediction = model(x)
        assert prediction.shape == y.shape == (4, 1)
        loss = ((prediction - y) ** 2).mean()
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
    print("Scalar derivative agrees:", scalar.grad, tensor.grad.item())
    print("PyTorch predictions:", model(x).detach().flatten().tolist())
    print("Independent initialization: compare gradients and behavior, not exact weights.")


if __name__ == "__main__":
    compare()

