# 在同一个 GPT 上接入缓存、LoRA 与量化

先按 README 安装 CPU PyTorch，运行测试并训练基座。以下命令都在本项目目录执行，没有远程模型 API。网页中仍运行小规模概念实验；这里操作的是真实 Transformer 张量与检查点。

```bash
python -m unittest -v
python tiny_gpt.py train --checkpoint runs/tiny.pt
```

## 1. KV Cache：先验证每一步，再比较时间

```bash
python tiny_gpt.py benchmark --checkpoint runs/tiny.pt --prompt "the garden" --tokens 24 --repeats 5
python tiny_gpt.py benchmark --checkpoint runs/tiny.pt --prompt "the garden" --tokens 80 --repeats 5
python tiny_gpt.py generate --checkpoint runs/tiny.pt --kv-cache --tokens 80 --trace
# 去掉 --kv-cache 即为原来的完整窗口重算基线。
```

`model.forward_cached(ids, cache)` 返回新位置的 logits 和显式逐层缓存。每层 K、V 均为 `[B,H,S,d]`；缓存没有存注意力概率。prefill 可一次接收多个 Token，后续可追加单个或一块 Token。新增位置使用 `offset + arange(T)`；因果 mask 取第 `offset:offset+T` 行，允许读取以前的 K/V，并阻止看见块内的未来位置。旧缓存不会原地改动；训练模式拒绝这条推理路径。

**窗口边界**：学习式绝对位置只有 `context` 项。原生成基线滑窗后把剩余 Token 从位置 0 重新编号；其隐藏状态和每层 K/V 都可能改变。因此不能只删除缓存最早一项。生成器在窗口移动时对整个当前窗口重新 prefill，保证与基线定义一致；超过窗口后加速收益会缩小。底层 `forward_cached` 不静默截断，超限明确报错，由生成器负责重建。

缓存属于特定的前缀、模型和适配器；改权重、改 Token 前缀或改批次顺序后不要继续使用旧缓存。此接口不为你存储跨请求身份，也不实现 PagedAttention、GQA 或无限长度记忆。

`benchmark.py` 先生成一条公共 Token 轨迹，再让两种路径沿同一轨迹逐步计算所有词表 logits。它报告最大绝对误差与容差比较、真实经过 QKV 投影的位置数、重建次数及缓存张量字节。计时使用 CPU 单线程 wall time，包含 prefill／重建，排除采样、分词和文件 I/O，预热后交替顺序取中位数。短模型中框架调度开销可能大于省下的计算；速度比是本机实测，不是复杂度定理。

## 2. LoRA：实际训练、单独保存、校验基座、合并

```bash
python tiny_gpt.py lora-train --checkpoint runs/tiny.pt --rank 4 --alpha 8 --steps 100 --output runs/adapter.pt
python tiny_gpt.py evaluate --checkpoint runs/tiny.pt --adapter runs/adapter.pt --batches 5
python tiny_gpt.py generate --checkpoint runs/tiny.pt --adapter runs/adapter.pt --kv-cache --tokens 80
python tiny_gpt.py merge-lora --checkpoint runs/tiny.pt --adapter runs/adapter.pt --output runs/merged.pt
```

`efficient.LoRALinear` 计算 `Wx + bias + (alpha/r) B(Ax)`，其中 `A:[r,in]`，`B:[out,r]`。默认目标为每层 `attn.qkv,attn.out`，可用 `--targets` 指定其中一项，或选择 `mlp.up,mlp.down,head`。先冻结全部基座参数，再注册可训练 A/B。A 用随机初始化，B 为零；初始增量严格为零，第一步 A 梯度为零而 B 可学习。两个因子都设零会阻断初始学习。

默认两层模型只训练 2,304 个适配器参数，占 62,592 个基座参数约 3.68%。优化器仅接收这些参数，训练结束逐张量确认基座未改变。报告实际训练／验证损失，不根据“LoRA”名字推断效果。默认仍使用原故事分布，只展示参数高效更新机制，并非指令微调或聊天能力评测。

可用 `--data` 换成由空行分隔文档的兼容语料；字符词表来自基座，不重新拟合，未知字符明确报错。新数据独立按文档拆分，适配器记录其 SHA-256 与划分；评估加载同一划分，不使用基座语料的旧文档索引。数据哈希不同则拒绝评估。

适配器文件只存 A/B 和结构、训练信息、**基座检查点文件 SHA-256**，不重复保存基座权重。即便张量形状相同，另一份基座文件也会被拒绝。必须保留精确原文件；重新序列化一个数值相同的文件也可能有不同文件哈希。加载时验证张量名、形状、dtype 与有限值。

合并执行 `W <- W + (alpha/r)BA`，输出标准浮点模型，不保留 LoRA 分支。合并前后只应有浮点舍入差异，命令会报告一个小探针的 logits 差；测试还比较完整序列。独立适配器支持保存加载与合并，但当前没有适配器优化器续训功能。合并检查点是推理产物，不包含失效的旧优化器。

## 3. 量化：真实 int8 存储，浮点前向

```bash
# 可以量化基座，也可以量化已经合并的适配模型。
python tiny_gpt.py quantize --checkpoint runs/merged.pt --output runs/merged-int8.pt
python tiny_gpt.py inspect --checkpoint runs/merged-int8.pt
python tiny_gpt.py evaluate --checkpoint runs/merged-int8.pt --batches 5
python tiny_gpt.py generate --checkpoint runs/merged-int8.pt --kv-cache --tokens 80
python tiny_gpt.py benchmark --checkpoint runs/merged-int8.pt --tokens 64
# 也可直接组合：加载适配器 -> 合并 -> 量化。
python tiny_gpt.py quantize --checkpoint runs/tiny.pt --adapter runs/adapter.pt --output runs/combined-int8.pt
```

`Int8Linear` 对每个输出通道 j 取 `scale[j] = max(abs(W[j,:])) / 127`，把 `round(W/scale)` 裁剪到 `[-127,127]` 后真正存入 `torch.int8` buffer。零通道使用尺度 1；微小非零通道的尺度限制为 FP32 最小正规数以防下溢。舍入采用 `torch.round` 的最近偶数规则。输入权重及偏置须为有限 FP32。

QKV、注意力输出、MLP up/down 和 LM head 共 9 个 Linear 被替换；Embedding、LayerNorm、偏置和逐通道尺度仍为 FP32，缓存也仍为 FP32。序列化产物没有这些 Linear 的完整浮点权重副本。加载时根据 `kind` 重建相同模块，再严格加载全部张量。

前向把 `qweight * scale` 反量化为临时浮点矩阵，再调用 `F.linear`。这是实际的 **weight-only int8 存储**，没有整数 GEMM、激活量化、4-bit、GPTQ、校准搜索或 QLoRA。存储下降不表示峰值内存下降同样比例，也不保证推理加速。

报告的 `state_tensor_bytes` 按状态字典张量的 `numel * element_size` 求和，包括因果 mask 与尺度，不含容器头、优化器、激活、临时反量化或 KV 缓存。不要用含 AdamW 的训练文件与推理文件的磁盘大小直接当量化压缩率；两者内容不同。验证输出同时给出探针 logits 最大差、两种模型的训练／验证交叉熵与困惑度。探针不是全语料最大误差，损失差也不是所有任务质量保证。

## 检查点与实验顺序

| 产物 | 内容 | 用途 |
| --- | --- | --- |
| 原有 format 1 | 浮点模型、AdamW、RNG、数据划分等 | 原训练仍可精确恢复 |
| adapter format 1 | A/B、基座文件哈希、目标层和训练元数据 | 需精确基座；可推理和合并 |
| format 2 / float | 合并后的浮点张量与必要元数据 | 独立推理，无训练优化器 |
| format 2 / int8-weight-only | 真正 int8 Linear buffers、尺度及其余浮点张量 | 独立推理，可用 KV Cache |

推理产物明确不能作为 `train --resume` 输入。输出路径不得覆盖输入基座或适配器。全部文件使用 `weights_only=True` 加载，不执行 pickle 中任意 Python；仍只加载可信、本机产生的文件。

先验证不变量，再单独改变一个因素：相同模型的缓存输出应一致，LoRA 合并只容许舍入误差，而量化会引入可测近似误差。最后再组合三项；**浮点 LoRA -> 合并 -> int8 -> KV Cache** 已有完整 CLI 回归，不把它描述为量化基座上的 LoRA 训练。
