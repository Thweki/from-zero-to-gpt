# 一次实际 CPU 运行记录

本记录对应仓库自带原创语料、Python 3.12、PyTorch 2.14.1+cpu、单线程。数字来自实际运行；不同版本与硬件的速度和浮点结果可能不同。checkpoint 在临时目录生成，不包含在下载包内。

```bash
python -m unittest -v
python tiny_gpt.py train --steps 250 --checkpoint /tmp/from-zero-to-gpt-tiny.pt
python tiny_gpt.py evaluate --checkpoint /tmp/from-zero-to-gpt-tiny.pt --batches 5
python tiny_gpt.py generate --checkpoint /tmp/from-zero-to-gpt-tiny.pt --prompt "the garden" --tokens 100 --temperature .8 --top-k 10 --top-p .9 --seed 123
python tiny_gpt.py inspect --checkpoint /tmp/from-zero-to-gpt-tiny.pt
python tiny_gpt.py bpe-demo
```

8 项自检全部通过，测试正文约 1 秒；其中真实固定批次反向传播使损失从 3.669738 降到 0.028308。保存重载的 logits 与恢复后的下一次 AdamW 更新都按零容差比较通过，修改未来 ID 后过去 logits 也按零容差比较通过。

默认 250 步训练完整子进程约 4.25 秒，参数量 62,592，字符词表 38，C=48、H=3、n=2、L=48、batch=8、seed=42、AdamW lr=0.003。

| 步数 | 固定训练窗口平均损失 | 固定验证窗口平均损失 |
|---|---:|---:|
| 0 | 3.638757 | 3.634244 |
| 50 | 1.999224 | 2.007532 |
| 100 | 1.702695 | 1.721089 |
| 150 | 1.398792 | 1.399792 |
| 200 | 1.142143 | 1.134890 |
| 250 | 0.946669 | 0.901700 |

独立 evaluate 进程复现末行指标，验证困惑度 2.463789。数据划分、窗口 sampler 和分词方式均相同；这些数字仅适用于高度重复的教学故事分布，不是通用基准。

生成样例故意保留原样：

```text
the garden wasind and ewesit sond grew sunset, seta sali sornd thelig. was caledasi cali aled tro.
the tond sm
```

它已经学到一些局部片段，但存在明显拼写与句法错误，无法作可靠问答。这正是微小语料与微小模型应如实报告的能力边界。BPE 演示的第一步是合并 (a,n)，计数为 4；它独立于实际训练所用字符 tokenizer。
