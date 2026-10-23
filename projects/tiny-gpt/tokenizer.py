"""Deterministic character tokenizer, plus an independent educational BPE demo."""
from collections import Counter


class CharacterTokenizer:
    def __init__(self, chars):
        self.chars = list(chars)
        if not self.chars or len(set(self.chars)) != len(self.chars):
            raise ValueError("vocabulary must contain distinct characters")
        self.stoi = {ch: i for i, ch in enumerate(self.chars)}

    @classmethod
    def fit(cls, text):
        return cls(sorted(set(text)))

    def encode(self, text):
        missing = sorted(set(text) - self.stoi.keys())
        if missing:
            raise ValueError(f"characters absent from vocabulary: {missing!r}; try a prompt from data/corpus.txt")
        return [self.stoi[c] for c in text]

    def decode(self, ids):
        return "".join(self.chars[i] for i in ids)

    def state(self):
        return {"type": "character", "chars": self.chars}

    @classmethod
    def from_state(cls, state):
        if state["type"] != "character":
            raise ValueError("unsupported tokenizer")
        return cls(state["chars"])

    def __len__(self):
        return len(self.chars)


def bpe_demo(text="banana bandana", merges=4):
    """One sequence, no pretokenization: intentionally not a production BPE."""
    tokens = list(text)
    history = []
    for _ in range(merges):
        pairs = Counter(zip(tokens, tokens[1:]))
        if not pairs:
            break
        # Sort to make frequency ties independent of hash/dict insertion order.
        pair = min(pairs, key=lambda p: (-pairs[p], p))
        history.append({"pair": list(pair), "count": pairs[pair]})
        out, i = [], 0
        while i < len(tokens):
            if tuple(tokens[i:i + 2]) == pair:
                out.append("".join(pair))
                i += 2
            else:
                out.append(tokens[i])
                i += 1
        tokens = out
    return {"tokens": tokens, "merges": history}
