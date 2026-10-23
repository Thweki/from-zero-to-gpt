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

    def _attend(self, x, past=None):
        b, t, c = x.shape
        d = c // self.heads
        q, k, v = self.qkv(x).chunk(3, dim=-1)
        q, k, v = [z.view(b, t, self.heads, d).transpose(1, 2) for z in (q, k, v)]
        offset = 0 if past is None else past[0].shape[2]
        if past is not None:
            k = torch.cat((past[0], k), dim=2)
            v = torch.cat((past[1], v), dim=2)
        # Query length T, previous cache length S=offset.
        # [B,H,T,d] @ [B,H,d,S+T] -> [B,H,T,S+T]
        scores = (q @ k.transpose(-2, -1)) / math.sqrt(d)
        # A chunk beginning at offset sees all earlier tokens, but no future token.
        scores = scores.masked_fill(~self.mask[offset:offset+t, :offset+t], float("-inf"))
        weights = torch.softmax(scores, dim=-1)
        y = (weights @ v).transpose(1, 2).contiguous().view(b, t, c)
        return self.out(y), (k, v)

    def forward(self, x):
        return self._attend(x)[0]

    def forward_cached(self, x, past=None):
        return self._attend(x, past)


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

    def forward_cached(self, x, past=None):
        update, cache = self.attn.forward_cached(self.norm1(x), past)
        x = x + update
        return x + self.mlp(self.norm2(x)), cache


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

    @torch.no_grad()
    def forward_cached(self, ids, cache=None):
        """Inference-only append. Caller must supply the matching prefix cache.

        Each layer stores [B,H,S,d] keys/values, not attention weights. The cache
        is returned explicitly, never stored on the model or mutated in place.
        A sliding window must be rebuilt: learned absolute positions restart.
        """
        if self.training:
            raise ValueError("KV cache requires model.eval(); use forward for training")
        if ids.ndim != 2 or ids.shape[0] < 1 or ids.shape[1] < 1:
            raise ValueError("input must be nonempty [B,T]")
        offset = 0
        if cache is not None:
            if len(cache) != self.cfg.layers:
                raise ValueError("one K/V pair is required per layer")
            for pair in cache:
                if len(pair) != 2 or any(not isinstance(z, torch.Tensor) or z.ndim != 4 for z in pair):
                    raise ValueError("cache entries must be two [B,H,S,d] tensors")
                k, v = pair
                if k.shape != v.shape or k.shape[:2] != (ids.shape[0], self.cfg.heads) or k.shape[3] != self.cfg.width // self.cfg.heads:
                    raise ValueError("cache shape does not match model/batch")
                if offset and k.shape[2] != offset:
                    raise ValueError("all layer cache lengths must agree")
                offset = k.shape[2]
                if offset < 1 or k.device != ids.device or v.device != ids.device or k.dtype != self.token.weight.dtype or v.dtype != k.dtype:
                    raise ValueError("cache length/device/dtype does not match")
        if offset + ids.shape[1] > self.cfg.context:
            raise ValueError("cache exceeds context; rebuild the current window")
        positions = torch.arange(offset, offset + ids.shape[1], device=ids.device)
        x = self.token(ids) + self.position(positions)
        updated = []
        for i, block in enumerate(self.blocks):
            x, pair = block.forward_cached(x, None if cache is None else cache[i])
            updated.append(tuple(z.detach() for z in pair))
        return self.head(self.norm(x)), tuple(updated)


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
def generate(model, prompt_ids, steps, seed=123, temperature=1.0, top_k=0, top_p=1.0, use_cache=False):
    if not prompt_ids:
        raise ValueError("prompt cannot be empty")
    if steps < 0:
        raise ValueError("steps must be nonnegative")
    model.eval()
    ids = torch.tensor([prompt_ids], dtype=torch.long)
    generator = torch.Generator(device="cpu").manual_seed(seed)
    trace = []
    cache = None
    for _ in range(steps):
        rebuild = cache is None or cache[0][0].shape[2] >= model.cfg.context
        window = ids[:, -model.cfg.context:]
        evaluated = window if not use_cache or rebuild else ids[:, -1:]
        if use_cache:
            logits, cache = model.forward_cached(evaluated, None if rebuild else cache)
        else:
            logits, _ = model(evaluated)
        probs = filtered_probabilities(logits[0, -1], temperature, top_k, top_p)
        next_id = int(torch.multinomial(probs, 1, generator=generator))
        trace.append({"id": next_id, "probability": float(probs[next_id]),
                      "evaluated_tokens": evaluated.shape[1],
                      "cache_tokens": 0 if cache is None else cache[0][0].shape[2],
                      "cache_rebuilt": bool(use_cache and rebuild)})
        ids = torch.cat((ids, torch.tensor([[next_id]])), dim=1)
    return ids[0].tolist(), trace
