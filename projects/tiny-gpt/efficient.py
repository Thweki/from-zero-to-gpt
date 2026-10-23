"""Inspectable LoRA and weight-only int8 storage, without PEFT/quantization APIs.

Int8Linear dequantizes into floating-point F.linear on each forward. This saves
stored weight bytes, not integer-GEMM compute or guaranteed peak RAM/latency.
"""
from copy import deepcopy
import math
import torch
from torch import nn
import torch.nn.functional as F


class LoRALinear(nn.Module):
    def __init__(self, base, rank, alpha):
        super().__init__()
        if not isinstance(base, nn.Linear):
            raise ValueError("LoRA requires a floating-point Linear base")
        if not isinstance(rank, int) or not 1 <= rank <= min(base.in_features, base.out_features):
            raise ValueError("rank must be positive and no larger than either dimension")
        if not math.isfinite(alpha) or alpha <= 0:
            raise ValueError("alpha must be finite and positive")
        self.base, self.rank, self.alpha = base, rank, float(alpha)
        self.base.requires_grad_(False)
        self.a = nn.Parameter(base.weight.new_empty(rank, base.in_features))
        self.b = nn.Parameter(base.weight.new_zeros(base.out_features, rank))
        nn.init.kaiming_uniform_(self.a, a=math.sqrt(5))

    def forward(self, x):
        return self.base(x) + F.linear(F.linear(x, self.a), self.b) * (self.alpha / self.rank)

    @torch.no_grad()
    def merged(self):
        result = deepcopy(self.base)
        result.weight.add_((self.b @ self.a) * (self.alpha / self.rank))
        result.requires_grad_(False)
        return result


LORA_TARGETS = ("attn.qkv", "attn.out", "mlp.up", "mlp.down", "head")


def add_lora(model, rank=4, alpha=8.0, targets=("attn.qkv", "attn.out")):
    targets = tuple(targets)
    if not targets or len(set(targets)) != len(targets) or any(t not in LORA_TARGETS for t in targets):
        raise ValueError("unknown, duplicate or empty LoRA targets")
    if any(isinstance(m, (LoRALinear, Int8Linear)) for m in model.modules()):
        raise ValueError("start LoRA from a floating-point, unadapted base")
    selected = [(name, module) for name, module in model.named_modules()
                if isinstance(module, nn.Linear) and any(name.endswith(t) for t in targets)]
    # Validate every replacement before mutating the base model.
    replacements = [(name, LoRALinear(deepcopy(module), rank, alpha)) for name, module in selected]
    if not replacements:
        raise ValueError("no matching target layers")
    model.requires_grad_(False)
    for name, replacement in replacements:
        parent_name, _, child = name.rpartition(".")
        setattr(model.get_submodule(parent_name) if parent_name else model, child, replacement)
    return model


def lora_state(model):
    return {name: value.detach().cpu().clone() for name, value in model.named_parameters()
            if name.endswith((".a", ".b"))}


def load_lora_state(model, state):
    expected = lora_state(model)
    if set(state) != set(expected):
        raise ValueError("adapter tensor names do not match target layers")
    for name, value in state.items():
        if value.shape != expected[name].shape or value.dtype != expected[name].dtype or not torch.isfinite(value).all():
            raise ValueError("adapter shape/dtype/values do not match")
    model.load_state_dict(state, strict=False)


def merge_lora(model):
    result = deepcopy(model)
    for name, module in list(result.named_modules()):
        if isinstance(module, LoRALinear):
            parent_name, _, child = name.rpartition(".")
            setattr(result.get_submodule(parent_name) if parent_name else result, child, module.merged())
    result.eval()
    return result


class Int8Linear(nn.Module):
    def __init__(self, source):
        super().__init__()
        weight = source.weight.detach()
        if weight.dtype != torch.float32 or not torch.isfinite(weight).all() or (source.bias is not None and not torch.isfinite(source.bias).all()):
            raise ValueError("quantization requires finite FP32 weights and bias")
        maximum = weight.abs().amax(dim=1, keepdim=True)
        scale = torch.where(maximum > 0, (maximum / 127).clamp_min(torch.finfo(weight.dtype).tiny), torch.ones_like(maximum))
        self.register_buffer("qweight", torch.round(weight / scale).clamp(-127, 127).to(torch.int8))
        self.register_buffer("scale", scale)
        self.register_buffer("bias", None if source.bias is None else source.bias.detach().float().clone())
        self.in_features, self.out_features = source.in_features, source.out_features

    def forward(self, x):
        weight = self.qweight.to(x.dtype) * self.scale.to(x.dtype)
        bias = None if self.bias is None else self.bias.to(x.dtype)
        return F.linear(x, weight, bias)


def quantize_int8(model):
    if any(isinstance(m, (LoRALinear, Int8Linear)) for m in model.modules()):
        raise ValueError("merge LoRA first; quantization requires a floating-point model")
    result = deepcopy(model)
    for name, module in list(result.named_modules()):
        if isinstance(module, nn.Linear):
            parent_name, _, child = name.rpartition(".")
            setattr(result.get_submodule(parent_name) if parent_name else result, child, Int8Linear(module))
    result.requires_grad_(False)
    result.eval()
    return result


def storage_report(model):
    tensors = model.state_dict()
    return {
        "state_tensor_bytes": sum(t.numel() * t.element_size() for t in tensors.values()),
        "int8_weight_bytes": sum(m.qweight.numel() for m in model.modules() if isinstance(m, Int8Linear)),
        "quantized_linears": sum(isinstance(m, Int8Linear) for m in model.modules()),
        "trainable_parameters": sum(p.numel() for p in model.parameters() if p.requires_grad),
        "lora_parameters": sum(t.numel() for t in lora_state(model).values()),
        "note": "tensor bytes exclude file metadata, activations, KV cache, optimizer and dequantization workspace",
    }
