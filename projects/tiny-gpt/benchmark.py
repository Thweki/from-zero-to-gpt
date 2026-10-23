"""Teacher-forced cache comparison: identical IDs, windows and absolute positions."""
import statistics
import time
import torch
from model import generate


@torch.no_grad()
def decode_path(model, all_ids, prompt_length, steps, use_cache):
    cache, rows, processed, rebuilds = None, [], 0, 0
    ids = torch.tensor([all_ids], dtype=torch.long)
    for step in range(steps):
        end = prompt_length + step
        window = ids[:, max(0, end - model.cfg.context):end]
        rebuild = cache is None or cache[0][0].shape[2] >= model.cfg.context
        current = window if not use_cache or rebuild else window[:, -1:]
        if use_cache:
            logits, cache = model.forward_cached(current, None if rebuild else cache)
            rebuilds += int(rebuild)
        else:
            logits, _ = model(current)
        rows.append(logits[0, -1])
        processed += current.shape[1]
    cache_bytes = 0 if cache is None else sum(t.numel() * t.element_size() for pair in cache for t in pair)
    return torch.stack(rows), {"projected_token_positions": processed,
                              "cache_rebuilds": rebuilds, "final_cache_bytes": cache_bytes}


@torch.no_grad()
def benchmark_cache(model, prompt_ids, steps=24, repeats=5):
    if not prompt_ids or steps < 1 or repeats < 1:
        raise ValueError("nonempty prompt, positive steps and repeats required")
    model.eval()
    # Produce a common trajectory; timing excludes sampling, tokenizer and I/O.
    ids, _ = generate(model, prompt_ids, steps, seed=123)
    reference, full_info = decode_path(model, ids, len(prompt_ids), steps, False)
    cached, cache_info = decode_path(model, ids, len(prompt_ids), steps, True)
    difference = (reference - cached).abs()
    timings = {False: [], True: []}
    for repeat in range(repeats):
        # Alternate order to reduce systematic warm-cache/order bias.
        for use_cache in ((False, True) if repeat % 2 == 0 else (True, False)):
            start = time.perf_counter()
            decode_path(model, ids, len(prompt_ids), steps, use_cache)
            timings[use_cache].append((time.perf_counter() - start) * 1000)
    full_ms, cached_ms = (statistics.median(timings[mode]) for mode in (False, True))
    return {"steps": steps, "prompt_tokens": len(prompt_ids), "repeats": repeats,
            "context": model.cfg.context, "full": {**full_info, "median_ms": full_ms},
            "cached": {**cache_info, "median_ms": cached_ms},
            "logit_max_abs_error": float(difference.max()),
            "logits_close": bool(torch.allclose(reference, cached, rtol=1e-4, atol=1e-5)),
            "measured_speed_ratio_full_over_cached": full_ms / cached_ms,
            "note": "CPU wall time includes prefill and window rebuilds; excludes sampling/I/O. No guaranteed speedup. KV is FP32."}
