# 本地微型 GPT：从张量到下一个字符

这是实际可训练、保存、加载和逐字符采样的 decoder-only Transformer。它在本机使用 PyTorch 的张量、Linear、Embedding 与 autograd；注意力、因果 mask、LayerNorm、残差和 MLP 都在 `model.py` 显式实现，未调用 `nn.Transformer`、预训练权重或远程 API。网页中的概率表实验与本工程是两个不同模型。

默认模型只有约 6 万参数，两层、三头，宽度 48，上下文 48；训练数据是原创的英文有限模板故事。它能学到局部拼写和重复句式，不能回答知识问题，不能代表现代大语言模型的语言理解能力。验证集是文档留出，但模板和词汇仍然相近，验证损失不代表通用能力。

## 安装与运行

要求 Python 3.10+。以下命令在下载并解压后的 `tiny-gpt` 目录运行。CPU 版无需 CUDA；首次安装需要网络，之后训练和推理均可离线。

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt --index-url https://download.pytorch.org/whl/cpu
python -m unittest -v
python tiny_gpt.py train --steps 250 --checkpoint runs/tiny.pt
python tiny_gpt.py evaluate --checkpoint runs/tiny.pt
python tiny_gpt.py generate --checkpoint runs/tiny.pt --prompt "the garden" --tokens 120 --temperature 0.8 --top-k 10 --top-p 0.9 --seed 123 --trace
python tiny_gpt.py inspect --checkpoint runs/tiny.pt
python tiny_gpt.py bpe-demo
```

Windows 激活命令为 `.venv\Scripts\activate`。默认 CPU 单线程适合这个小网络；可把全局参数放在子命令前，例如 `python tiny_gpt.py --threads 2 train --steps 100`。有输入字符不在训练词表中时，tokenizer 会明确报错。BPE 仅为独立合并演示；训练模型使用可逆的字符 tokenizer，不能混用两者的 ID。

```bash
# 继续训练 100 步；保留 checkpoint 中的结构、词表、AdamW 状态与数据划分。
python tiny_gpt.py train --resume runs/tiny.pt --steps 100 --checkpoint runs/continued.pt
```

`--resume` 会恢复原优化器学习率；此时 `--lr`、结构参数与 `--seed` 不覆盖已保存状态。采样批大小和训练步数可改；若希望逐位复现，保持批大小、线程数、PyTorch 版本与机器环境一致。不同版本或不同硬件不保证位级一致。checkpoint 用 `weights_only=True` 读取，不应加载来源不明的文件。

## 数据与训练路径

`data/corpus.txt` 为本项目创作，CC0 1.0，授权见 `data/LICENSE.txt`。96 个独立段落用空行分隔；固定 seed 打乱文档 ID，再把约 20% 留作 validation。tokenizer 仅从 train 拟合。`prepare` 校验原始文本 SHA-256，检查文档划分不重叠，并在验证集出现未知字符时失败，不会悄悄重新拟合。更换语料时应重新训练；避免把同一文档切成窗口后随机分到两边。

训练窗口取 `x = tokens[i:i+T]`，`y = tokens[i+1:i+T+1]`。相邻文档拼接处也有少量跨文档目标，这是教学简化；生产语料应设计文档边界或 packed-sequence mask。模型一次前向得到每个位置的 logits，训练交叉熵平均所有 `B*T` 个目标。AdamW 更新全部参数；梯度裁剪阈值为 1。每次验证使用固定独立 sampler，无梯度，不影响训练 sampler。

## 张量形状与实现索引

设 `B` 批大小、`T <= context`、`C=width`、`H=heads`、`d=C/H`、`V` 词表大小。

| 张量/权重 | 形状 | 说明 |
|---|---|---|
| 输入 ID / 右移标签 | `[B,T]` | 整数索引，不是浮点特征 |
| token / position 表 | `[V,C]` / `[context,C]` | 查表相加得到 `[B,T,C]` |
| QKV Linear 权重 | `[3C,C]` | 输出 `[B,T,3C]`，拆成三份 |
| 每个 Q、K、V | `[B,H,T,d]` | 先 reshape 再 transpose |
| 分数与注意力权重 | `[B,H,T,T]` | `Q @ Kᵀ / sqrt(d)`；上三角置负无穷后 softmax |
| 多头合并 / 输出投影 | `[B,T,C]` / 权重 `[C,C]` | `weights @ V` 后重排 |
| LayerNorm gain、bias | 各 `[C]` | 仅沿最后特征轴归一化，方差 correction=0 |
| MLP up / down 权重 | `[4C,C]` / `[C,4C]` | 中间 `[B,T,4C]` 经 GELU |
| 最终 LM head 权重 | `[V,C]` | logits `[B,T,V]`，与 Embedding 不共享权重 |
| 交叉熵输入 / 标签 | `[B*T,V]` / `[B*T]` | 框架稳定计算 log-softmax |

每块为 `x = x + attention(norm1(x))`，再 `x = x + mlp(norm2(x))`，最后归一化并投影到词表。position 是学习式绝对位置。推理超出窗口后截断到最后 `context` 个 ID，并从 0 重新编号窗口位置；默认路径每步重算；--kv-cache 可复用窗口内每层 K/V，窗口滑动后重建以匹配绝对位置重新编号。采样先除以 temperature，再保留 top-k（0 表示关闭），再根据剩余归一化分布做 top-p，保留跨过累计阈值的那个 token，最后重新归一化并 multinomial。固定 seed 只保证相同环境、相同调用路径的可复现采样。

## 保存内容与检验边界

checkpoint 含格式版本、结构超参数、训练批大小/学习率/权重衰减/裁剪阈值等训练配置、模型张量、完整 AdamW 状态、字符词表、数据 SHA-256 与文档划分 ID、初始 seed、训练步数、训练 sampler 和 torch RNG 状态、指标历史、PyTorch 版本。写入临时文件后原子替换。`inspect` 列出全部参数名与形状，便于逐层追踪。

测试会真正反向传播并确认固定批次损失下降；验证未来 token 的改变不能影响过去 logits；检查保存加载 logits 完全相同、恢复下一次 AdamW 更新完全相同、采样过滤与种子复现、标签位移和评估不修改权重。固定批次下降证明程序能学习，不证明泛化。评估输出是 nats/token 与 `exp(loss)` 困惑度；不同 tokenizer 的困惑度不能直接横向比较。记录你的训练日志、验证曲线和失败样例，再改变一个因素做消融。


## 接入 KV Cache、LoRA 与 int8

三项已经接入同一个 GPT，不是独立概率表。完整运行命令、缓存边界、适配器格式与量化口径见 [EFFICIENCY.md](EFFICIENCY.md)，实测见 [VALIDATION.md](VALIDATION.md)。

```bash
python tiny_gpt.py benchmark --checkpoint runs/tiny.pt --tokens 24
python tiny_gpt.py lora-train --checkpoint runs/tiny.pt --output runs/adapter.pt
python tiny_gpt.py merge-lora --checkpoint runs/tiny.pt --adapter runs/adapter.pt --output runs/merged.pt
python tiny_gpt.py quantize --checkpoint runs/merged.pt --output runs/merged-int8.pt
python tiny_gpt.py generate --checkpoint runs/merged-int8.pt --kv-cache --tokens 80 --trace
```

量化器真正保存 int8 权重，但前向反量化后使用浮点计算，不宣称整数内核加速；此组合也不是 QLoRA。旧训练检查点保持兼容，合并／量化产物是单独标注的推理检查点，不能拿来恢复旧 AdamW。
