# 从零实现标量自动微分与 XOR MLP

这个项目是课程第 39、43 课的可运行产物，所有引擎与从零网络代码只使用 Python 标准库。它按操作建立标量计算图，以拓扑排序的逆序执行反向传播；不会把自动微分工作交给 NumPy 或 PyTorch。代码为本课程编写，学习思路可对照 [Karpathy 的 micrograd](https://github.com/karpathy/micrograd)，没有复制其实现。

在项目根目录运行：

```sh
cd projects/micrograd
python3 -m unittest -v
python3 main.py check
python3 main.py train --steps 1000 --seed 7
```

`check` 用中心差分独立校验 w、x、b 的梯度。`train` 使用固定种子创建 2→8→1 的 tanh 网络，以四个 XOR 样本的均方误差训练；目标为 −1 或 +1，按输出符号分类。每次迭代重新前向，调用 `zero_grad()`，反传，再更新参数。四个点的训练精度仅验证程序会拟合，不提供泛化证据。

`engine.py` 实现 `Value` 的加、减、乘、除、常数次幂、tanh、ReLU。局部梯度用 `+=` 累加，因此 `x*x` 的两条边都得到保留。节点拓扑遍历按身份去重，但不能把两条运算边合成一条。叶子 `.grad` 在不同 `backward()` 调用间累加；该教学实现每次反传清空中间节点梯度，支持同一图重复反传。训练时仍必须清空参数梯度。图不支持原地改数据后的旧图反传、高阶导数、向量输出隐式求导、GPU 或广播；建立图后到反传前不要改 `.data`。ReLU 在零点取导数 0。

## 分步练习

1. 暂时把 `__mul__` 的一个 `+=` 改为 `=`，运行测试，观察共享操作数与分支合并失败的原因，然后修复。
2. 用纸笔求 `z=(wx+b)^2` 的三个偏导，与 `main.py check` 中更复杂的图作对照。不要用本引擎本身作为唯一“正确答案”。
3. 修改隐藏宽度、种子、学习率，每次记录初始与最终损失。扩大网络不会保证每一个学习率都稳定。
4. 把标签改为随机值，思考“能记住四个点”与“能泛化”差别。真实项目要划分独立验证集。

## 可选：真实 PyTorch（仅本地 Python）

浏览器章节练习不导入 torch。下面的独立脚本是真实 PyTorch，与网站的标准库解释器分开：

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install torch
python torch_compare.py
```

脚本先对同一标量公式断言两个引擎的数值梯度一致，再用真实 `nn.Linear`、`backward()`、`zero_grad()`、`SGD.step()` 训练相同结构的 XOR 网络。两个实现采用独立初始化，不能预期每个权重或整条训练轨迹相同。此可选依赖不会被标准库测试导入，也不会在浏览器运行；具体 torch 安装选项参见 [官方安装说明](https://pytorch.org/get-started/locally/)。对照 [autograd 教程](https://docs.pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html) 检查叶子梯度、`no_grad()` 与 `detach()` 的作用。
