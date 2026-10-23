> 2026-10-23 更新：83 个节点均已交付首版，available 全为 true；状态与进度以当前源码及 PROGRESS 为准。

# 知识依赖图

机器可读的完整 DAG 位于 [src/data/knowledge-graph.json](../src/data/knowledge-graph.json)。每个节点包含稳定 `id`、中文 `title`、1–6 的 `stage`、先修 `prerequisites` 和教材可用性 `available`。`available: false` 表示规划；不得为这些节点生成空教材页面。依赖表示建议先修，不强制锁课。状态另存于学习者本地数据，不写入课程源文件。

## 第一组课程

```mermaid
graph LR
  F[函数是什么] --> L[线性函数与参数]
  L --> P[用 Python 表示函数]
  F --> V[向量的基本概念]
  L --> D[向量点积]
  V --> D
```

## 主要通路

```mermaid
graph TD
  F[函数与代数] --> C[导数 / 偏导 / 链式法则]
  V[向量] --> DP[点积]
  DP --> MM[矩阵乘法]
  C --> G[梯度与最优化]
  G --> GD[梯度下降]
  PR[概率] --> DI[分布 / 期望 / 方差]
  F --> LR[线性回归]
  GD --> TR[训练与验证]
  LR --> TR
  DI --> LOSS[损失函数]
  LOSS --> TR
  TR --> NN[MLP 与前向传播]
  MM --> NN
  NN --> BP[计算图 / 反向传播]
  C --> BP
  BP --> AD[自动微分 / 优化器]
  AD --> PT[PyTorch 对照]
  TOK[文本表示 / Tokenization] --> EMB[Embedding]
  EMB --> QKV[Attention / Q K V]
  MM --> QKV
  DI --> SM[Softmax]
  QKV --> SA[Scaled Attention / Self-Attention]
  SM --> SA
  SA --> MH[多头 / 位置 / 残差 / LayerNorm]
  MH --> DEC[Encoder-Decoder / Causal Mask / Decoder-only]
  DEC --> GPT[微型 GPT 实现]
  PT --> GPT
  TOK --> GPT
  GPT --> GEN[训练 / 保存 / 自回归 / 采样 / 评估]
  GEN --> MOD[预训练 / SFT / RLHF / DPO]
  GEN --> INF[KV Cache / 量化 / LoRA / 性能]
  MOD --> PAPER[局限 / 评估 / 论文阅读]
  INF --> PAPER
```

以上是便于阅读的概览，完整节点与跨阶段先修请查 JSON。课程新增必须保持唯一 ID、所有依赖存在、无环；状态迁移依赖稳定 ID，避免重命名破坏本地记录。若确实改名，需同时提供数据迁移。

## 维护验收

- 所有节点 ID 唯一，依赖目标必须存在；拓扑遍历必须覆盖全部节点。
- 0.2.0 可用集合严格等于图中的全部83个ID，并与 Lesson 聚合器一致。
- 可用节点须有真实 Lesson 内容、实验、自测、引用及可运行参考实现。
- 各阶段交付通过后才将对应 `available` 改为 true；不把计划等同于已完成。
- 搜索可以显示规划知识点，但进入动作只能到已发布教材或明确的路线信息。
