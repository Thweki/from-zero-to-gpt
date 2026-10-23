# 课程体系

本课程面向熟悉 Linux、Bash、网络和编程，但需要重新建立数学基础的独立开发者。学习以问题、可观察计算和可修改代码为主，不设置签到、截止日期或学习时长目标。

## 教材约定

每章包含：解决的问题、动机、直觉、定义与必要推导、真实交互实验、Python 实现、常见误区、动手任务、自测及反馈、前置与下一步、可靠参考。直觉／数学／代码／深入四种模式共享同一课程、草稿、实验参数和学习状态。

掌握状态由学习者主动标记；自测提供反馈，不等同于完整能力认证。建议先修关系提供导航，不把学习者锁在固定路线里。高级内容在通过内容和代码验收前只显示为规划节点。

## 第一批完整课程（MVP 范围）

| ID | 课程 | 先修 | 实验与可检验产出 |
| --- | --- | --- | --- |
| functions | 函数是什么 | 无；章内补齐输入、输出与坐标直觉 | 改变输入观察映射与图像；区分“一输入多输出”和“多输入一输出” |
| linear | 线性函数与参数 | functions | 调节斜率、截距；由两点变化解释斜率 |
| python | 用 Python 表示函数 | linear | 修改纯 Python 函数；用断言检查输入输出 |
| vectors | 向量的基本概念 | functions | 修改二维分量观察方向、长度；实现向量操作 |
| dot-product | 向量点积 | linear、vectors | 调节两个向量观察点积与夹角关系；手写点积 |

这五章保留为入门组；0.2.0 已补齐第一阶段其余18章及后续五个阶段。全部课程均有教材、实验、代码与自测。

## 完整路线

0.2.0 中以下节点均已完成首版教材、交互、知识检测与自动化验证。正式节点、ID 与依赖以 [knowledge-graph.json](../src/data/knowledge-graph.json) 为准。

### 阶段 1：数学基础

- `functions`：函数是什么。先修：无。MVP 课程。
- `linear`：线性函数与参数。先修：`functions`。MVP 课程。
- `python`：用 Python 表示函数。先修：`linear`。MVP 课程。
- `vectors`：向量的基本概念。先修：`functions`。MVP 课程。
- `dot-product`：向量点积。先修：`linear`、`vectors`。MVP 课程。
- `algebra`：代数与方程。先修：无。已交付首版。
- `coordinates`：坐标系与图像。先修：`functions`。已交付首版。
- `powers`：幂与指数。先修：`algebra`、`functions`。已交付首版。
- `logarithms`：对数与指数函数。先修：`powers`。已交付首版。
- `matrices`：矩阵与张量形状。先修：`vectors`。已交付首版。
- `matrix-multiplication`：矩阵乘法。先修：`dot-product`、`matrices`。已交付首版。
- `linear-geometry`：线性变换的几何直觉。先修：`matrix-multiplication`、`coordinates`。已交付首版。
- `probability`：概率与条件概率。先修：`algebra`。已交付首版。
- `distributions`：离散与连续分布。先修：`probability`、`functions`。已交付首版。
- `expectation`：期望与加权平均。先修：`distributions`、`dot-product`。已交付首版。
- `variance`：方差与标准差。先修：`expectation`、`powers`。已交付首版。
- `limits`：极限与局部变化。先修：`functions`、`coordinates`。已交付首版。
- `derivatives`：导数与切线。先修：`limits`、`linear`。已交付首版。
- `partial-derivatives`：偏导数。先修：`derivatives`、`vectors`。已交付首版。
- `chain-rule`：链式法则。先修：`derivatives`。已交付首版。
- `gradients`：梯度与方向。先修：`partial-derivatives`、`chain-rule`。已交付首版。
- `optimization`：最优化与损失地形。先修：`gradients`。已交付首版。
- `gradient-descent`：梯度下降。先修：`optimization`、`python`。已交付首版。

### 阶段 2：机器学习

- `rules-vs-learning`：规则编程与机器学习。先修：`python`。已交付首版。
- `datasets`：数据集、训练集与验证集。先修：`rules-vs-learning`、`probability`。已交付首版。
- `parameters`：参数与超参数。先修：`linear`、`rules-vs-learning`。已交付首版。
- `linear-regression`：从零实现线性回归。先修：`datasets`、`parameters`、`dot-product`。已交付首版。
- `loss-functions`：损失函数与均方误差。先修：`linear-regression`、`expectation`。已交付首版。
- `training-regression`：手写梯度下降训练循环。先修：`loss-functions`、`gradient-descent`。已交付首版。
- `generalization`：泛化、欠拟合与过拟合。先修：`training-regression`、`datasets`。已交付首版。
- `classification`：分类任务与决策边界。先修：`generalization`。已交付首版。
- `logistic-regression`：逻辑回归与二元交叉熵。先修：`classification`、`logarithms`、`derivatives`。已交付首版。

### 阶段 3：神经网络

- `neurons`：神经元与感知机。先修：`logistic-regression`、`dot-product`。已交付首版。
- `activations`：激活函数。先修：`neurons`、`derivatives`。已交付首版。
- `mlp`：多层感知机。先修：`activations`、`matrix-multiplication`。已交付首版。
- `forward-pass`：前向传播与批处理。先修：`mlp`。已交付首版。
- `computation-graph`：计算图。先修：`forward-pass`、`chain-rule`。已交付首版。
- `backprop`：反向传播。先修：`computation-graph`、`gradients`。已交付首版。
- `autodiff`：手写微型自动微分引擎。先修：`backprop`、`python`。已交付首版。
- `optimizers`：SGD、动量与 Adam。先修：`autodiff`、`gradient-descent`。已交付首版。
- `regularization`：正则化与 Dropout。先修：`optimizers`、`generalization`。已交付首版。
- `pytorch`：PyTorch 张量与 autograd。先修：`autodiff`、`matrix-multiplication`。已交付首版。
- `nn-project`：从零神经网络与框架对照。先修：`regularization`、`pytorch`。已交付首版。

### 阶段 4：自然语言处理与 Transformer

- `text-representation`：文本表示与序列。先修：`python`、`datasets`。已交付首版。
- `tokenization`：字符、子词与 Tokenization。先修：`text-representation`。已交付首版。
- `embeddings`：Embedding 与查表。先修：`tokenization`、`matrices`。已交付首版。
- `rnn-lstm`：RNN、LSTM 的动机与局限。先修：`embeddings`、`forward-pass`、`backprop`。已交付首版。
- `softmax`：Softmax 与概率归一化。先修：`logarithms`、`distributions`。已交付首版。
- `attention`：Attention：从加权汇聚开始。先修：`embeddings`、`expectation`、`rnn-lstm`。已交付首版。
- `qkv`：Q、K、V 的来源与作用。先修：`attention`、`matrix-multiplication`。已交付首版。
- `scaled-attention`：Scaled Dot-Product Attention。先修：`qkv`、`softmax`、`variance`。已交付首版。
- `self-attention`：Self-Attention 与张量形状。先修：`scaled-attention`。已交付首版。
- `multi-head`：Multi-Head Attention。先修：`self-attention`。已交付首版。
- `positions`：位置编码与位置表示。先修：`self-attention`、`powers`。已交付首版。
- `residual`：Residual Connection。先修：`forward-pass`、`backprop`。已交付首版。
- `layernorm`：Layer Normalization。先修：`variance`、`forward-pass`。已交付首版。
- `encoder-decoder`：Encoder 与 Decoder。先修：`multi-head`、`positions`、`residual`、`layernorm`。已交付首版。
- `causal-mask`：Causal Mask 与信息泄露。先修：`self-attention`、`datasets`。已交付首版。
- `decoder-only`：Decoder-only Transformer。先修：`encoder-decoder`、`causal-mask`。已交付首版。

### 阶段 5：手写 GPT

- `corpus`：构建与划分训练语料。先修：`tokenization`、`datasets`。已交付首版。
- `gpt-tokenizer`：实现字符与子词 Tokenizer。先修：`corpus`、`tokenization`。已交付首版。
- `gpt-embedding`：实现 Token 与位置 Embedding。先修：`gpt-tokenizer`、`positions`、`pytorch`。已交付首版。
- `transformer-block`：实现 Transformer Block。先修：`gpt-embedding`、`decoder-only`。已交付首版。
- `lm-head`：语言模型输出层。先修：`transformer-block`、`softmax`。已交付首版。
- `cross-entropy`：交叉熵与下一个 Token 目标。先修：`lm-head`、`logarithms`。已交付首版。
- `gpt-training`：实现训练循环与验证。先修：`cross-entropy`、`optimizers`、`corpus`。已交付首版。
- `checkpoints`：模型保存、加载与复现。先修：`gpt-training`。已交付首版。
- `autoregressive`：自回归逐 Token 生成。先修：`checkpoints`、`causal-mask`。已交付首版。
- `temperature`：Temperature 与随机采样。先修：`autoregressive`、`softmax`。已交付首版。
- `top-k-p`：Top-k 与 Top-p。先修：`temperature`、`distributions`。已交付首版。
- `gpt-evaluation`：验证、消融与错误分析。先修：`gpt-training`、`top-k-p`、`generalization`。已交付首版。
- `tiny-gpt`：可独立训练和推理的微型 GPT。先修：`gpt-evaluation`、`checkpoints`。已交付首版。

### 阶段 6：现代 LLM

- `pretraining-scaling`：预训练与 Scaling Laws。先修：`tiny-gpt`。已交付首版。
- `instruction-sft`：指令微调与 SFT。先修：`pretraining-scaling`、`datasets`。已交付首版。
- `rlhf-dpo`：RLHF 与 DPO 基础思想。先修：`instruction-sft`、`expectation`。已交付首版。
- `inference`：推理阶段计算流程。先修：`tiny-gpt`。已交付首版。
- `kv-cache`：KV Cache 与缓存正确性。先修：`inference`、`qkv`、`causal-mask`。已交付首版。
- `quantization`：模型量化与误差。先修：`inference`、`variance`。已交付首版。
- `lora`：LoRA 与参数高效微调。先修：`instruction-sft`、`matrix-multiplication`。已交付首版。
- `memory-performance`：推理性能、吞吐与显存。先修：`kv-cache`、`quantization`。已交付首版。
- `hallucination`：幻觉、事实性与模型局限。先修：`gpt-evaluation`、`instruction-sft`。已交付首版。
- `llm-evaluation`：现代 LLM 评估与数据污染。先修：`hallucination`、`datasets`。已交付首版。
- `paper-reading`：技术论文阅读与复现实验。先修：`pretraining-scaling`、`rlhf-dpo`、`lora`、`memory-performance`、`llm-evaluation`。已交付首版。

## 阶段作品与验收

1. 数学：用图像、数值与代码一致地解释函数、向量、矩阵、概率和梯度，并展示一次梯度下降。
2. 机器学习：不依赖机器学习框架实现回归、训练与验证；能解释损失下降和泛化差异。
3. 神经网络：手写标量自动微分引擎与 MLP；有限差分验证梯度，并与 PyTorch 对照。
4. Transformer：逐步展示 Q/K/V、mask、softmax、注意力输出的张量形状；检查因果信息不泄露。
5. 手写 GPT：独立的数据、tokenizer、模型、训练、checkpoint、生成脚本；用小语料训练并复现推理。
6. 现代 LLM：比较 KV Cache、量化、LoRA 的正确性和资源开销；阅读论文并说明假设、证据和局限。

## 参考体系与内容政策

所有说明为本项目原创组织和表达，不复制受保护教材的完整章节。章节引用须指向具体内容并说明用途。

- [Mathematics for Machine Learning](https://mml-book.github.io/)：线性代数、概率和优化参考。
- [Dive into Deep Learning](https://d2l.ai/)：机器学习、神经网络与注意力参考。
- [Python 官方教程](https://docs.python.org/3/tutorial/)：函数、数值和列表语义。
- [PyTorch 官方教程](https://pytorch.org/tutorials/)：张量、autograd 和训练实践。
- [3Blue1Brown](https://www.3blue1brown.com/topics/linear-algebra)：几何直觉，引用而非嵌入整套内容。
- [micrograd](https://github.com/karpathy/micrograd)、[makemore](https://github.com/karpathy/makemore)、[nanoGPT](https://github.com/karpathy/nanoGPT)：从小系统构建模型的实践参考。
- [Attention Is All You Need](https://arxiv.org/abs/1706.03762)：原始 Transformer 架构；教学简化须明确标注。
- [The Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/) 与 [Hugging Face LLM Course](https://huggingface.co/learn/llm-course/)：可视化及现代工作流补充。

区分可证明的数学结论、经验性训练规律和仍在研究的解释。Scaling Laws、对齐、幻觉等不得被描述为没有条件的定律。
