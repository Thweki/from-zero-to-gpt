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


## 0.3.0：同一个模型的整合运行

旧训练检查点仍可加载。新训练250步复现上述损失；随后实际运行 LoRA 100步、合并、量化、缓存对照与生成。完整数值快照见 [EFFICIENCY_VALIDATION.json](EFFICIENCY_VALIDATION.json)，命令与口径见 [EFFICIENCY.md](EFFICIENCY.md)。

23项真实CPU测试全部通过（原8项 + 新15项），包括多批量／分块 prefill、每个前缀输出、旧缓存不变、长度／dtype拒绝、长提示／滑窗、QKV钩子计数、零权重／异常值／微小尺度、int8严格保存加载、LoRA零初始化与数值梯度、实际学习与冻结参数、基座哈希、换语料后的划分继承，以及完整CLI组合。CLI测试实际启多个子进程；本轮总测试约23秒，取决于机器负载。

| 验证项 | 本次实际结果 |
| --- | --- |
| LoRA 可训练参数 | 2,304 / 基座62,592（约3.68%）；全部冻结基座张量逐位未变 |
| 留出集损失 | 基座0.901700 → LoRA0.776511 → 合并0.776511 → int8合并0.777207 |
| 合并探针最大logits差 | 1.43×10⁻⁶；探针不是全语料上界 |
| 量化探针最大logits差 | 0.064478；有真实近似误差 |
| 状态张量字节 | 254,976 → 87,224，减少约65.8%；不含峰值RAM或激活 |
| 短轨迹缓存误差／投影位置 | 最大2.38×10⁻⁶；516 → 33个位置 |
| 滑窗轨迹缓存误差／投影位置 | 最大2.62×10⁻⁶；3,099 → 2,016个位置，42次prefill／重建 |
| int8合并模型生成 | 固定seed的完整前向与缓存生成80个新字符完全相同 |

短轨迹：提示10字符、生成24步、5次中位数，全前向12.97ms，缓存11.60ms，约1.12倍；滑窗80步为46.87ms与44.68ms，约1.05倍。时间包括prefill和滑窗重建，不含采样、分词、磁盘I/O；换机器或负载结果会变。这个极小模型不应被用来推断GPU大模型加速比。

适配器文件约13.8KB，只含适配器和元数据；原基座训练文件含AdamW等约802KB，二者内容不同，不能直接把文件比当量化压缩率。int8权重每次前向仍反量化到浮点计算；不宣称整数内核、4-bit、QLoRA、峰值显存实测或普遍质量不降。
