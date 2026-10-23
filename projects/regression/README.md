# 从零线性回归：可独立运行的训练与推理

只需要 Python 3.10+ 标准库。无需安装机器学习框架、下载数据或配置密钥。从本目录运行：

```bash
python regression.py train --seed 7 --steps 400 --lr 0.05 --output model.json
python regression.py predict --model model.json --x -1 0 1
python regression.py evaluate --model model.json
python -m unittest -v
```

训练从 `w=0, b=0` 开始，每一步按全部训练样本计算 MSE 梯度，再同时更新权重与偏置。第一次命令输出初始/最终训练 MSE、验证 MSE 和保存位置；第二次命令加载 JSON 模型预测新输入；第三次命令才报告独立测试集的 MSE，并与仅从训练标签估计的常数基线比较。典型参数会接近真实的 `w=1.8, b=-0.4`，有噪声时不应期待完全相同。

数据由本项目原创合成：`x ~ Uniform[-2,2]`，`y=1.8*x-0.4+ε`，`ε ~ Normal(0,0.15)`。局部 `random.Random(seed)` 生成并打乱 120 个样本，按 72/24/24 分成训练/验证/测试，不读取外部资料。种子和生成说明与权重一同保存，可以重新生成同一划分。单独修改 `--seed` 会生成另一份实验；不同 Python 实现或版本之间的 `gauss` 输出不作为跨版本位级一致性保证。

先使用训练和验证指标选择学习率与轮数，确定方案后再执行 `evaluate`。反复根据测试结果改方案会消耗测试集的独立性。当前玩具任务的数据来源与线性假设相符，不能用这个成绩证明模型可用于真实租金或房价。

建议实验：比较 `--steps 1` 与 `--steps 400`；固定种子只改变学习率；将生成式改成二次函数后观察线性模型的残差。测试使用手算值、中心有限差分、已知直线、保留样本和独立子进程检验训练与加载流程。

进一步阅读：[D2L 线性回归](https://d2l.ai/chapter_linear-regression/linear-regression.html)、[Python random 文档](https://docs.python.org/3/library/random.html)。教学项目的推导与练习位于网站阶段二的线性回归、损失函数、训练循环与泛化课程。
