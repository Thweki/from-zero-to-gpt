"""A small, explicit pre-norm decoder. No nn.Transformer or attention API."""
from dataclasses import dataclass, asdict
import math
import torch
from torch import nn
import torch.nn.functional as F


@dataclass
class Config:
    vocab_size: int
    context: int = 48
    width: int = 48
    heads: int = 3
    layers: int = 2

    def __post_init__(self):
        if min(self.vocab_size, self.context, self.width, self.heads, self.layers) < 1:
            raise ValueError("all dimensions must be positive")
        if self.width % self.heads:
            raise ValueError("width must be divisible by heads")

    def state(self):
        return asdict(self)


class LayerNorm(nn.Module):
    def __init__(self, width, eps=1e-5):
        super().__init__()
        self.gain = nn.Parameter(torch.ones(width))
        self.bias = nn.Parameter(torch.zeros(width))
        self.eps = eps

    def forward(self, x):
        mean = x.mean(dim=-1, keepdim=True)
        variance = ((x - mean) ** 2).mean(dim=-1, keepdim=True)
        return (x - mean) * torch.rsqrt(variance + self.eps) * self.gain + self.bias


class CausalAttention(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.heads = cfg.heads
        self.qkv = nn.Linear(cfg.width, 3 * cfg.width)
        self.out = nn.Linear(cfg.width, cfg.width)
        self.register_buffer("mask", torch.tril(torch.ones(cfg.context, cfg.context, dtype=torch.bool)))

    def forward(self, x):
        b, t, c = x.shape
        d = c // self.heads
        q, k, v = self.qkv(x).chunk(3, dim=-1)
        q, k, v = [z.view(b, t, self.heads, d).transpose(1, 2) for z in (q, k, v)]
        # [B,H,T,d] @ [B,H,d,T] -> [B,H,T,T]
        scores = (q @ k.transpose(-2, -1)) / math.sqrt(d)
        scores = scores.masked_fill(~self.mask[:t, :t], float("-inf"))
        weights = torch.softmax(scores, dim=-1)
        y = (weights @ v).transpose(1, 2).contiguous().view(b, t, c)
        return self.out(y)


class MLP(nn.Module):
    def __init__(self, width):
        super().__init__()
        self.up = nn.Linear(width, 4 * width)
        self.down = nn.Linear(4 * width, width)

    def forward(self, x):
        return self.down(F.gelu(self.up(x)))


class Block(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.norm1, self.norm2 = LayerNorm(cfg.width), LayerNorm(cfg.width)
        self.attn, self.mlp = CausalAttention(cfg), MLP(cfg.width)

    def forward(self, x):
        x = x + self.attn(self.norm1(x))
        return x + self.mlp(self.norm2(x))


class TinyGPT(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.cfg = cfg
        self.token = nn.Embedding(cfg.vocab_size, cfg.width)
        self.position = nn.Embedding(cfg.context, cfg.width)
        self.blocks = nn.ModuleList([Block(cfg) for _ in range(cfg.layers)])
        self.norm = LayerNorm(cfg.width)
        self.head = nn.Linear(cfg.width, cfg.vocab_size, bias=False)
        self.apply(self._init)

    @staticmethod
    def _init(module):
        if isinstance(module, (nn.Linear, nn.Embedding)):
            nn.init.normal_(module.weight, mean=0, std=0.02)
            if isinstance(module, nn.Linear) and module.bias is not None:
                nn.init.zeros_(module.bias)

    def forward(self, ids, targets=None):
        if ids.ndim != 2 or not 0 < ids.shape[1] <= self.cfg.context:
            raise ValueError("input must be [B,T], 0 < T <= context")
        t = ids.shape[1]
        x = self.token(ids) + self.position(torch.arange(t, device=ids.device))
        for block in self.blocks:
            x = block(x)
        logits = self.head(self.norm(x))  # [B,T,V], unnormalized scores
        loss = None if targets is None else F.cross_entropy(logits.reshape(-1, self.cfg.vocab_size), targets.reshape(-1))
        return logits, loss


def filtered_probabilities(logits, temperature=1.0, top_k=0, top_p=1.0):
    if temperature <= 0 or not math.isfinite(temperature):
        raise ValueError("temperature must be finite and > 0")
    if top_k < 0 or not 0 < top_p <= 1:
        raise ValueError("top_k >= 0 and 0 < top_p <= 1 required")
    scores = logits / temperature
    if top_k:
        indices = scores.argsort(descending=True, stable=True)
        keep = indices[:min(top_k, len(scores))]
        masked = torch.full_like(scores, float("-inf"))
        masked[keep] = scores[keep]
        scores = masked
    probabilities = torch.softmax(scores, dim=-1)
    if top_p < 1:
        sorted_p, indices = probabilities.sort(descending=True, stable=True)
        # Include the token which crosses p; previous cumulative mass < p.
        keep = sorted_p.cumsum(dim=-1) - sorted_p < top_p
        keep[0] = True
        filtered = torch.zeros_like(probabilities)
        filtered[indices[keep]] = probabilities[indices[keep]]
        probabilities = filtered / filtered.sum()
    return probabilities


@torch.no_grad()
def generate(model, prompt_ids, steps, seed=123, temperature=1.0, top_k=0, top_p=1.0):
    if not prompt_ids:
        raise ValueError("prompt cannot be empty")
    if steps < 0:
        raise ValueError("steps must be nonnegative")
    model.eval()
    ids = torch.tensor([prompt_ids], dtype=torch.long)
    generator = torch.Generator(device="cpu").manual_seed(seed)
    trace = []
    for _ in range(steps):
        logits, _ = model(ids[:, -model.cfg.context:])
        probs = filtered_probabilities(logits[0, -1], temperature, top_k, top_p)
        next_id = int(torch.multinomial(probs, 1, generator=generator))
        trace.append({"id": next_id, "probability": float(probs[next_id])})
        ids = torch.cat((ids, torch.tensor([[next_id]])), dim=1)
    return ids[0].tolist(), trace
