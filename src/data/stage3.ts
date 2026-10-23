import type { Lesson } from '../types';

const autodiffReference = `class Value:
    def __init__(self, data, parents=()):
        self.data, self.grad = float(data), 0.0
        self.parents = parents
        self.pullback = lambda: None

    def __add__(self, other):
        other = other if isinstance(other, Value) else Value(other)
        out = Value(self.data + other.data, (self, other))
        def pullback():
            self.grad += out.grad
            other.grad += out.grad
        out.pullback = pullback
        return out

    def __mul__(self, other):
        other = other if isinstance(other, Value) else Value(other)
        out = Value(self.data * other.data, (self, other))
        def pullback():
            self.grad += other.data * out.grad
            other.grad += self.data * out.grad
        out.pullback = pullback
        return out

    def backward(self):
        order, seen = [], set()
        def visit(node):
            if node in seen:
                return
            seen.add(node)
            for parent in node.parents:
                visit(parent)
            order.append(node)
        visit(self)
        for node in order:
            node.grad = 0.0
        self.grad = 1.0
        for node in reversed(order):
            node.pullback()

def evaluate(x):
    leaf = Value(x)
    loss = leaf * leaf + leaf
    loss.backward()
    return loss.data, leaf.grad

print("f(3), f'(3):", evaluate(3))
`;

/** 本阶段为原创中文教材；链接用于核查概念与进一步阅读。 */
export const stage3Lessons: Lesson[] = [
  {
    id: 'neurons', number: '33', title: '神经元与感知机', english: 'A learnable weighted decision',
    subtitle: '从逻辑回归出发，把加权、偏置与激活拆成三个可以检查的步骤。',
    prerequisites: ['logistic-regression', 'dot-product'],
    goals: ['区分预激活与激活值', '解释偏置如何移动决策边界', '比较感知机硬阈值与可微神经元'],
    problem: '逻辑回归已经把多个特征压成一个分数再变成概率。神经元沿用这个计算单元，但允许不同的激活，并把输出传给下一个单元。先弄清每个数字扮演的角色，才能读懂后面几百层网络的矩阵式。',
    intuition: [
      { title: '每个特征各有一票，但票的分量不同', paragraphs: ['把输入 x 看成一张特征清单，权重 w 决定各项特征影响的方向和大小。先逐项相乘求和，再加偏置 b，得到预激活 z。z 可以是任意实数；经过激活函数后才得到输出 a。权重为负表示该特征增大时，在其他条件不变的情况下，z 减小。', '例如 x=(2,−1)、w=(0.5,1)、b=0.2，得到 z=0.2。若激活为 sigmoid，输出约 0.55；这时只有把它定义为二分类模型并配合合适损失训练，才有概率建模含义。一个普通隐藏激活不自动是概率。'] },
      { title: '偏置让门槛不用穿过原点', paragraphs: ['感知机用 z 是否大于等于 0 直接给类别。w 控制分界面的朝向，b 控制它的位置；去掉偏置会强迫边界穿过原点。将硬阈值换成平滑激活，就能用导数说明怎样微调参数。', '感知机和 sigmoid 神经元都是小型函数，但硬阈值几乎处处导数为 0，无法直接提供有用的梯度训练信号。本节实验使用可微或分段可微的激活；不要把实验中连续的输出曲线认成感知机的阶跃。'] },
    ],
    math: [
      { title: '一个单元的形状契约', paragraphs: ['d 维输入和 d 维权重做点积，得到标量 z，再加标量偏置。参数总数是 d+1，输入有多少个样本不会改变这一数目。一个批次可以反复使用同一组参数。'], formula: String.raw`z=\sum_{i=1}^{d}w_ix_i+b,\qquad a=\phi(z),\qquad \#\theta=d+1` },
      { title: '从局部变化到参数梯度', paragraphs: ['若激活在 z 处可导，链式法则给出输出对权重的变化率。偏置对 z 的导数为 1，输入对 z 的导数为对应权重。训练还需要乘以上游损失对 a 的导数；这里算的是神经元本身的局部敏感度。'], formula: String.raw`\frac{\partial a}{\partial w_i}=\phi'(z)x_i,\quad \frac{\partial a}{\partial b}=\phi'(z),\quad \frac{\partial a}{\partial x_i}=\phi'(z)w_i` },
    ],
    deep: [
      { title: '生物类比的边界', paragraphs: ['人工神经元的名称来自历史启发。加权和、偏置和标量激活是一种工程模型，不是对真实神经细胞电化学过程的完整模拟。理解它应依赖明确的输入输出和梯度，而不是依赖“像大脑所以会思考”的类比。'] },
      { title: '一个超平面还不够', paragraphs: ['单个线性阈值单元能分开线性可分的样本，却不能表示 XOR。sigmoid 只改变同一线性分数的刻度，也不会让其 0.5 决策边界变成曲线。下一步需要多个单元与非线性组合，建立能随输入变化的内部表示。'] },
    ],
    formula: String.raw`a=\phi(\mathbf w^\top\mathbf x+b)`, formulaCaption: '预激活 z 先汇总证据，激活 φ 再改变输出的形状。', lab: 'neural-network',
    labTask: '保持 x=1，先只改变 w，再只改变 b，比较 z 与输出。改用 sigmoid，寻找输出为 0.5 的参数；解释这个条件与 z=0 的关系。',
    starter: 'import math\n\ndef neuron(xs, weights, bias):\n    z = 0  # TODO: 对应分量相乘求和，再加偏置\n    if z >= 0:\n        return 1 / (1 + math.exp(-z))\n    e = math.exp(z)\n    return e / (1 + e)\n\nprint(neuron([2, -1], [0.5, 1], 0.2))\n',
    reference: 'import math\n\ndef neuron(xs, weights, bias):\n    if len(xs) != len(weights):\n        raise ValueError("输入与权重的维数必须相同")\n    z = sum(x * w for x, w in zip(xs, weights)) + bias\n    if z >= 0:\n        return 1 / (1 + math.exp(-z))\n    e = math.exp(z)\n    return e / (1 + e)\n\nprint(neuron([2, -1], [0.5, 1], 0.2))\n',
    codeExplanation: '先检查维数，避免 zip 静默截断错误输入。参考答案把 sigmoid 按 z 的符号分支，以免直接计算极大 exp(−z) 导致溢出；两个分支表达同一函数。',
    pythonTests: 'assert abs(neuron([0], [9], 0) - 0.5) < 1e-12\nassert abs(neuron([2, -1], [.5, 1], .2) - 0.549833997312478) < 1e-10\nassert neuron([1], [1000], 0) == 1\nassert neuron([1], [-1000], 0) == 0\n',
    misconceptions: ['预激活 z 与激活 a 是两个变量；sigmoid 的输出范围不会限制 z 的范围。', '偏置不是“无用常数”，它决定边界能否离开原点。', '神经元名称不意味着它完整模拟生物神经细胞，也不意味着每个输出都有概率含义。'],
    exercise: '手算两个特征例子的 z 与 sigmoid 输出。完成 neuron 并通过测试；在实验里找到两组不同参数，让 x=1 时输出相同，再比较 x=−1 时是否仍相同。',
    quiz: { question: 'sigmoid 神经元输出恰好为 0.5 时，预激活 z 满足什么条件？', options: ['z=0', 'z=0.5', '所有权重都为 0', '输入必须全部为 0'], correct: 0, hint: '把 sigmoid 写成 1/(1+exp(−z))，分母要等于多少？', explanation: 'sigmoid(0)=1/2。权重、输入与偏置可以以很多方式让加权和 z=0，不要求所有权重或输入为零。' },
    references: [ { title: 'D2L · Multilayer Perceptrons', url: 'https://d2l.ai/chapter_multilayer-perceptrons/mlp.html', note: '加权和、隐藏单元与激活函数的教材解释。' }, { title: 'CS231n · Neural Networks Part 1', url: 'https://cs231n.github.io/neural-networks-1/', note: '神经元模型、激活函数及生物类比的限制。' } ],
  },
  {
    id: 'activations', number: '34', title: '激活函数', english: 'Why nonlinearity matters', subtitle: '用函数形状和局部斜率，理解表达能力与梯度流。',
    prerequisites: ['neurons', 'derivatives'], goals: ['比较 ReLU、tanh 与 sigmoid', '计算激活的局部导数', '解释饱和与梯度消失的联系'],
    problem: '如果把许多线性层叠在一起，最后仍只是一层线性映射。网络需要非线性，才能让不同输入进入不同的计算行为。但非线性的斜率也会决定梯度能否传回来，因此不能只根据输出图像选择激活。',
    intuition: [
      { title: '叠层之前先制造弯折', paragraphs: ['ReLU 把负输入截为 0，正输入原样通过；tanh 把实数压进 −1 到 1；sigmoid 把实数压进 0 到 1。这些函数改变曲线形状，使多层组合不再能合并成一个仿射层。不同神经元可以在不同输入区域起作用。'] },
      { title: '梯度经过的每道门都有斜率', paragraphs: ['反向传播时，上游梯度要乘以激活在当前输入处的斜率。tanh 与 sigmoid 进入很大的正负输入后曲线变平，梯度随之变小。ReLU 在正区间的斜率为 1，负区间为 0；它缓解某些问题，也可能让长期处于负区间的单元收不到更新信号。'] },
    ],
    math: [
      { title: '三个函数与两个饱和区', paragraphs: ['sigmoid 的导数可以直接用其输出计算，最大值为 1/4；tanh 的导数也能从输出得到，最大值为 1。两者在输出接近范围边缘时导数趋近 0。这个局部事实经过层间连乘，才构成深层网络梯度衰减的一种原因。'], formula: String.raw`\sigma(z)=\frac1{1+e^{-z}},\quad \sigma'(z)=\sigma(z)(1-\sigma(z)),\quad \tanh'(z)=1-\tanh^2(z)` },
      { title: '不可微点需要一个工程约定', paragraphs: ['ReLU 在 0 左右的导数不同，所以在该点没有通常意义的导数。自动微分实现一般选 0 作为反传值；这是一项明确的约定。做数值梯度检查时应避开这个点，否则中心差分的 0.5 与约定值 0 不一致，并不代表反传程序必然写错。'], formula: String.raw`\operatorname{ReLU}(z)=\max(0,z),\qquad \operatorname{ReLU}'(z)=\begin{cases}0&z<0\\1&z>0\end{cases}` },
    ],
    deep: [
      { title: '为什么没有“始终最佳”的激活', paragraphs: ['激活的选择还取决于初始化、归一化、网络深度、优化器和任务。现代 Transformer 常用 GELU 或门控激活，不能由一张 ReLU 图像推导出它们一定更差。这里先把非线性与局部导数的关系建立清楚，再比较具体架构。'] },
      { title: '饱和不是概率本身的错误', paragraphs: ['二分类输出常用 sigmoid，即使它在极端输入处饱和也有合理建模作用。把 sigmoid 与二元交叉熵合并，可推导损失对 logit 的梯度为 p−y；框架还用稳定公式避免对极小概率取对数。隐藏层激活和输出层损失必须放在各自位置分析。'] },
    ],
    formula: String.raw`\frac{\partial L}{\partial z}=\frac{\partial L}{\partial a}\phi'(z)`, formulaCaption: '激活改变前向数值，也按局部斜率缩放反向信号。', lab: 'neural-network',
    labTask: '固定 x=1、b=0，依次选择三种激活，把 w 从负数移到正数。记录输出与局部导数；把 tanh 的预激活调大，观察输出接近 1 时梯度怎样改变。',
    starter: 'import math\n\ndef activate(x, kind):\n    if kind == "relu":\n        return None  # TODO: 负数变 0，正数保留\n    return math.tanh(x)\n\ndef slope(x, kind):\n    return None  # TODO: ReLU 在 0 取 0；其余为 tanh 导数\n',
    reference: 'import math\n\ndef activate(x, kind):\n    if kind == "relu":\n        return max(0, x)\n    return math.tanh(x)\n\ndef slope(x, kind):\n    if kind == "relu":\n        return float(x > 0)\n    return 1 - math.tanh(x) ** 2\n\nfor x in [-3, 0, 3]:\n    print(x, activate(x, "tanh"), slope(x, "tanh"))\n',
    codeExplanation: '练习聚焦 ReLU 与 tanh 两种激活。slope 返回解析导数；测试用远离 ReLU 拐点的输入做中心差分，另外单独检查零点的工程约定。所有计算只用标准库 math。',
    pythonTests: 'assert activate(-2, "relu") == 0\nassert activate(3, "relu") == 3\nassert slope(0, "relu") == 0\nassert slope(0, "tanh") == 1\nassert slope(4, "tanh") < .002\nfor _kind in ["relu", "tanh"]:\n    for _x in [-1.5, .7]:\n        _num = (activate(_x + 1e-5, _kind) - activate(_x - 1e-5, _kind)) / 2e-5\n        assert abs(slope(_x, _kind) - _num) < 1e-7\n',
    misconceptions: ['多个不含非线性的仿射层仍可合并成一个仿射层，层数本身不带来这种表达能力。', 'ReLU 不保证梯度永不消失；负输入的局部梯度为零，其他层的权重同样影响梯度。', 'ReLU 在 0 取梯度 0 是实现约定，不是声称它在 0 处可微。'],
    exercise: '实现 activate 与 slope，通过解析与数值导数测试。用实验比较 z=0 和 z=3 的 tanh 斜率，再解释为何激活值很大与梯度很大不是同一件事。',
    quiz: { question: '为什么 ReLU 在输入为 −2 时会阻断经过该激活的梯度？', options: ['因为输出是负数', '因为该区间函数恒为 0，局部导数为 0', '因为负数不能反向传播', '因为所有权重都变成了 0'], correct: 1, hint: '反向传播使用当前位置的局部斜率，先画出负半轴上的 ReLU。', explanation: '负输入区间内 ReLU 恒为 0，局部导数为 0；上游梯度乘以 0 后无法通过这条路径传向前层。' },
    references: [ { title: 'D2L · Multilayer Perceptrons', url: 'https://d2l.ai/chapter_multilayer-perceptrons/mlp.html', note: 'ReLU、sigmoid、tanh 的图像与数学定义。' }, { title: 'PyTorch · ReLU', url: 'https://docs.pytorch.org/docs/stable/generated/torch.nn.ReLU.html', note: '官方接口与分段函数定义。' } ],
  },
  {
    id: 'mlp', number: '35', title: '多层感知机', english: 'Compose learned representations', subtitle: '让一层提取特征，另一层组合特征，理解 XOR 为什么需要隐藏层。',
    prerequisites: ['activations', 'matrix-multiplication'], goals: ['写出两层 MLP 的前向公式', '计算每层参数量', '用隐藏非线性构造 XOR'],
    problem: '单个直线边界无法把 XOR 中的两类点分开。我们可以先让隐藏层把输入变成新特征，再由输出层组合这些特征。多层感知机的关键，是学习这种中间表示，而不只是把相同计算重复很多遍。',
    intuition: [
      { title: '隐藏层是可以学习的特征变换', paragraphs: ['第一层的每个神经元读取整个输入，但拥有各自的权重。它们可以对不同方向的组合做出响应。激活之后得到隐藏向量 h；输出层读取 h，原本难以分开的输入可能在新表示里变得容易处理。隐藏并不意味着神秘，只表示它不是数据直接给出的目标。'] },
      { title: '用两道折线解决一个具体问题', paragraphs: ['对 0 或 1 的两个输入，令 s=x₁+x₂，h₁=ReLU(s)，h₂=ReLU(s−1)，再输出 h₁−2h₂。s=0、1、2 时依次得到 0、1、0，恰好表达 XOR。这组权重是手工构造的，用来说明表达能力；训练则需要从数据找到合适参数。'] },
    ],
    math: [
      { title: '逐层跟踪维数', paragraphs: ['使用列向量记法，d 维输入经 m 个隐藏单元变为 m 维 h，再输出 k 维 y。第一层矩阵形状 m×d，第二层 k×m。激活逐分量作用，不把向量压缩成一个数。输出激活由任务决定，本课的标量回归输出使用恒等映射。'], formula: String.raw`\mathbf h=\phi(W_1\mathbf x+\mathbf b_1),\qquad \mathbf y=W_2\mathbf h+\mathbf b_2` },
      { title: '参数量与非线性各做什么', paragraphs: ['第一层有 md 个权重和 m 个偏置，第二层有 km 个权重和 k 个偏置。如果两层间省掉非线性，展开后得到 W₂W₁x+W₂b₁+b₂，仍是仿射函数。参数更多与函数族更灵活之间需要结构条件，不能只数参数。'], formula: String.raw`\#\theta=md+m+km+k,\qquad W_2(W_1\mathbf x+\mathbf b_1)+\mathbf b_2=(W_2W_1)\mathbf x+(W_2\mathbf b_1+\mathbf b_2)` },
    ],
    deep: [
      { title: '存在一种表示，不等于训练一定找到', paragraphs: ['通用逼近类结果讨论在合适条件下网络能表示或逼近哪些函数，不保证有限数据、有限训练步数与任意初始化都能找到好解。XOR 的手工权重只是存在性例子；学习速度、数值稳定和泛化还需要独立验证。'] },
      { title: '为什么不能让所有隐藏单元完全相同', paragraphs: ['如果同层单元具有相同初始参数并收到对称的梯度，它们会持续产生相同特征，白白占用宽度。随机初始化帮助打破对称性；合适的初始尺度还影响激活是否饱和。随机不是为了让结果不可复现，固定种子仍能得到确定实验。'] },
    ],
    formula: String.raw`f(\mathbf x)=W_2\phi(W_1\mathbf x+\mathbf b_1)+\mathbf b_2`, formulaCaption: 'MLP 通过非线性隐藏表示，把多个简单单元组合成更灵活的函数。', lab: 'neural-network',
    labTask: '分别改变两个隐藏权重和输出权重，观察曲线如何变化。把 v₂ 设为 0 看一个隐藏单元的贡献，再恢复 v₂；说明两个单元相加为何能产生更丰富的形状。',
    starter: 'def xor_network(xs):\n    s = xs[0] + xs[1]\n    h1 = max(0, s)\n    h2 = max(0, s - 1)\n    return None  # TODO: 用 h1、h2 构造 XOR 输出\n\nprint([xor_network(x) for x in [[0, 0], [0, 1], [1, 0], [1, 1]]])\n',
    reference: 'def xor_network(xs):\n    if len(xs) != 2:\n        raise ValueError("XOR 需要两个输入")\n    s = xs[0] + xs[1]\n    h1 = max(0, s)\n    h2 = max(0, s - 1)\n    return h1 - 2 * h2\n\nprint([xor_network(x) for x in [[0, 0], [0, 1], [1, 0], [1, 1]]])\n',
    codeExplanation: '两个 ReLU 先把输入转换为两个隐藏特征，再用输出权重 1 与 −2 组合。这里只有前向计算与已知权重，没有把手工设权重冒充训练；真实学习过程在阶段项目中实现。',
    pythonTests: 'assert xor_network([0, 0]) == 0\nassert xor_network([0, 1]) == 1\nassert xor_network([1, 0]) == 1\nassert xor_network([1, 1]) == 0\nassert xor_network([.25, .25]) == .5\n',
    misconceptions: ['隐藏层输出仍是可检查的数字，不一定对应人能命名的语义特征。', '多层线性映射仍可合并，必须检查层间是否有非线性。', '能表示 XOR 与能用某组学习率稳定学会 XOR 是两个结论。'],
    exercise: '手算四个 XOR 输入的两个隐藏值，再完成输出层。去掉 h₂ 的偏置 −1，检查哪一个样本失败；用公式说明这个偏置怎样创造新的折点。',
    quiz: { question: '两层仿射层之间去掉所有非线性后，整体表达什么函数？', options: ['任意连续函数', '一个仍可合并的仿射函数', '自动成为 XOR 分类器', '没有定义的函数'], correct: 1, hint: '把 W₂(W₁x+b₁)+b₂ 展开，看看 x 最终处于几次幂。', explanation: '展开得到 (W₂W₁)x+(W₂b₁+b₂)，仍是仿射映射。隐藏层的非线性使这种合并通常不再成立。' },
    references: [ { title: 'D2L · Multilayer Perceptrons', url: 'https://d2l.ai/chapter_multilayer-perceptrons/mlp.html', note: '隐藏层、非线性与多层结构的教材讲解。' }, { title: 'CS231n · Neural Network Architectures', url: 'https://cs231n.github.io/neural-networks-1/', note: '全连接网络、参数数量与初始化讨论。' } ],
  },
  {
    id: 'forward-pass', number: '36', title: '前向传播与批处理', english: 'Run many examples with one model', subtitle: '先对齐形状，再让一个批次中的每个样本共享参数。',
    prerequisites: ['mlp'], goals: ['逐层追踪批次张量形状', '实现一个批次的仿射前向', '区分样本维、特征维与参数维'],
    problem: '单个样本算对并不保证一批样本也算对。把样本和特征的轴混淆，代码可能仍能运行，却在计算完全不同的函数。批处理首先是一份形状约定，然后才是用矩阵运算提高吞吐量的方法。',
    intuition: [
      { title: '同一台机器，同时处理多张表单', paragraphs: ['把每个样本放在矩阵的一行，列表示特征。处理新一行时继续使用同一组权重与偏置，而不是给它创建新参数。批次大小决定一次参与计算的样本数，不决定模型参数的数量；最后不足一批的样本同样需要被正确处理。'] },
      { title: '偏置被重复使用，不是重复学习', paragraphs: ['对每一行的每个输出加对应偏置，可以看成先把偏置复制到各行再相加。张量框架会用广播完成这件事。广播省去显式复制，但不能替你确认轴的语义；尤其输出 (B,1) 与标签 (B,) 相减，可能错误广播成 (B,B)。'] },
    ],
    math: [
      { title: '采用样本按行的矩阵约定', paragraphs: ['本节把 X 写成 B×d，权重 W 写成 d×m，因此 XW 是 B×m。b 有 m 个分量，沿批次轴广播相加。上一课用列向量公式，本课改用行样本公式，数学内容相同，但权重矩阵需要相应转置。'], formula: String.raw`X\in\mathbb R^{B\times d},\quad W\in\mathbb R^{d\times m},\quad Z=XW+\mathbf1_B\mathbf b^\top\in\mathbb R^{B\times m}` },
      { title: '每一项都应能落回一个样本', paragraphs: ['输出第 n 行第 j 列只使用第 n 个样本的输入特征与第 j 个单元的参数，不把其他样本的特征混进来。均值损失再把各样本误差汇总；使用均值而不是求和，会改变不同批次大小下梯度的尺度。'], formula: String.raw`Z_{nj}=\sum_{i=1}^{d}X_{ni}W_{ij}+b_j,\qquad L=\frac1B\sum_{n=1}^B\ell(\hat y_n,y_n)` },
    ],
    deep: [
      { title: '批处理是否改变每个样本的输出', paragraphs: ['对只包含逐样本仿射与激活的 MLP，放进哪个批次不会改变一个样本的前向结果。BatchNorm 等使用批统计量的层与训练时 Dropout 会引入额外依赖或随机性，因此不能把这个结论无条件扩展到所有网络。'] },
      { title: '快来自运算组织，不来自改变定义', paragraphs: ['本课用列表循环，便于逐项核对矩阵乘法。实际张量库把大块运算交给优化过的 CPU 或 GPU 内核，减少解释器开销并利用并行硬件。向量化保持同一个公式，速度不意味着省略了样本或自动改善了统计泛化。'] },
    ],
    formula: String.raw`H=\phi(XW_1+\mathbf1_B\mathbf b_1^\top),\qquad Y=HW_2+\mathbf1_B\mathbf b_2^\top`, formulaCaption: '样本共享权重，每层只改变特征轴的宽度。', lab: 'neural-network',
    labTask: '观察批次表的三行输出。改变 v₁，确认各行都使用同一个新权重，但变化幅度由各自的 h₁ 决定。手算 x=0 那一行并与表格核对。',
    starter: 'def batch_forward(rows, weights, bias):\n    # weights[i][j]: 第 i 个输入到第 j 个输出\n    return None  # TODO: 返回每个样本的所有输出\n\nprint(batch_forward([[1, 2], [3, 4]], [[1, 2], [-1, 0]], [0.5, -1]))\n',
    reference: 'def batch_forward(rows, weights, bias):\n    d, m = len(weights), len(bias)\n    if any(len(row) != m for row in weights):\n        raise ValueError("权重矩阵形状错误")\n    if any(len(row) != d for row in rows):\n        raise ValueError("输入特征数错误")\n    return [[sum(row[i] * weights[i][j] for i in range(d)) + bias[j]\n             for j in range(m)] for row in rows]\n\nprint(batch_forward([[1, 2], [3, 4]], [[1, 2], [-1, 0]], [0.5, -1]))\n',
    codeExplanation: '外层循环遍历样本，内层循环遍历输出单元，最内层求和遍历输入特征。实现支持空批次并检查矩阵形状。这是标准库的可核算版本，不声称拥有 GPU 张量性能。',
    pythonTests: 'assert batch_forward([[1, 2], [3, 4]], [[1, 2], [-1, 0]], [.5, -1]) == [[-.5, 1], [-.5, 5]]\nassert batch_forward([], [[1]], [0]) == []\nassert batch_forward([[0, 0]], [[5], [9]], [2]) == [[2]]\nassert batch_forward([[2], [-2]], [[3, -1]], [1, 0]) == [[7, -2], [-5, 2]]\n',
    misconceptions: ['批次大小不是输入特征维数，增大批次不增加线性层参数。', '不同教材的权重矩阵可能转置，先看样本按行还是按列。', '能广播不代表轴对齐正确，特别要警惕 (B,1) 与 (B,) 的差。'],
    exercise: '画出 B=2、d=2、m=2 时矩阵的形状，再实现 batch_forward。把其中一个样本移到单独批次，验证输出相同，并写明这个结论对哪些层成立。',
    quiz: { question: 'X 的形状为 (8,3)，W 为 (3,5)，计算 XW 后的形状是什么？', options: ['(3,3)', '(8,5)', '(5,8)', '(8,3,5)'], correct: 1, hint: '矩阵乘法中间两个维数要相同，结果保留左右外侧的维数。', explanation: '每个样本的 3 个输入特征变为 5 个输出特征，8 个样本仍分别保留，因此结果形状是 (8,5)。' },
    references: [ { title: 'D2L · Linear Algebra', url: 'https://d2l.ai/chapter_preliminaries/linear-algebra.html', note: '矩阵乘法、轴与批次表示的数学基础。' }, { title: 'PyTorch · Broadcasting Semantics', url: 'https://docs.pytorch.org/docs/stable/notes/broadcasting.html', note: '广播规则及潜在形状陷阱的官方说明。' } ],
  },
  {
    id: 'computation-graph', number: '37', title: '计算图', english: 'Make dependencies explicit', subtitle: '把长公式拆成节点，保存每一步的数值与依赖。',
    prerequisites: ['forward-pass', 'chain-rule'], goals: ['把表达式画成有向无环图', '记录中间值与局部运算', '区分节点复用与复制计算'],
    problem: '一个长表达式的导数很容易丢掉某条路径。计算图把公式拆成基本操作，并记录谁依赖谁。前向时按依赖顺序得到数值，反向时沿相反方向汇总影响，这是自动微分能够系统执行的基础。',
    intuition: [
      { title: '把配方拆成有编号的工序', paragraphs: ['对 z=(wx+b)²，先记 p=wx，再记 u=p+b，最后 z=u²。每个节点都有当前数值与生产它的操作。这样我们知道计算 z 之前需要 u，计算 u 之前需要 p 与 b；节点的摆放位置不重要，依赖方向才重要。'] },
      { title: '同一个值走两条边，影响要保留两次', paragraphs: ['如果把平方写成 u×u，图里可以只有一个 u 节点，却有两条入边连到乘法。节点身份去重能避免重复安排计算，但不能丢掉两条边的贡献。后续反传时分别求出每条路径，再在同一个节点累加，得到平方的 2u。'] },
    ],
    math: [
      { title: '前向求值遵循拓扑顺序', paragraphs: ['有向无环图存在拓扑顺序：每个节点排在它依赖的节点之后。这个小图的顺序可以是 x,w,b,p,u,z，前三个叶子彼此可以换位。程序控制流可能动态生成不同的图，但一次实际执行中的依赖仍应有明确方向。'], formula: String.raw`p=wx,\qquad u=p+b,\qquad z=u^2` },
      { title: '操作表也是未来的反向规则表', paragraphs: ['对每种基本操作，只需知道其局部导数。乘法节点对两个操作数的局部导数分别是另一个操作数；加法对两边的导数均为 1；平方为 2u。把这些信息与前向中间值保存起来，就能在下一课逐节点传播上游梯度。'], formula: String.raw`\frac{\partial p}{\partial w}=x,\quad\frac{\partial p}{\partial x}=w,\quad\frac{\partial u}{\partial p}=\frac{\partial u}{\partial b}=1,\quad\frac{\partial z}{\partial u}=2u` },
    ],
    deep: [
      { title: '保存中间值会占内存', paragraphs: ['为了反传，乘法需要操作数，tanh 常需要输出。真实网络会保存许多激活，批次与序列越大占用越多。梯度检查点技术选择少存一些值并在反传时重算，以额外计算换内存；这解释了为什么训练内存远高于单纯存权重。'] },
      { title: '动态图不是把 Python 全部符号化', paragraphs: ['逐操作记录的自动微分引擎追踪实际执行过的数值操作，不会自动理解任意 Python 字符串或不可微决策。若控制流根据某个数选了一条分支，通常只记录本次走过的路径；选择分支这个离散事件本身不因此获得可用导数。'] },
    ],
    formula: String.raw`(w,x)\xrightarrow{\times}p\xrightarrow{+b}u\xrightarrow{(\cdot)^2}z`, formulaCaption: '同一个公式变成可按顺序求值与反传的依赖关系。', lab: 'neural-network',
    labTask: '设置 x=2、w=0.5、b=1，手算三个节点再与图核对。只改变 b，观察哪个最早的中间值发生变化；解释 p 为什么保持不变。',
    starter: 'def trace(x, w, b):\n    p = w * x\n    u = None  # TODO: 加偏置\n    z = None  # TODO: 平方\n    return {"p": p, "u": u, "z": z}\n\nprint(trace(2, .5, 1))\n',
    reference: 'def trace(x, w, b):\n    p = w * x\n    u = p + b\n    z = u * u\n    return {"p": p, "u": u, "z": z}\n\nprint(trace(2, .5, 1))\n',
    codeExplanation: 'trace 显式返回中间值，便于定位前向错误。这里保存的是数字和命名后的依赖，不是完整自动微分引擎；真正记录节点与反向函数的类会在 autodiff 课实现。',
    pythonTests: 'assert trace(2, .5, 1) == {"p": 1, "u": 2, "z": 4}\nassert trace(-2, 3, 1) == {"p": -6, "u": -5, "z": 25}\nassert trace(0, 7, -2)["z"] == 4\nassert trace(2, .5, 9)["p"] == trace(2, .5, 1)["p"]\n',
    misconceptions: ['计算图的箭头表示依赖，不表示变量沿箭头移动后消失。', '节点去重不允许把重复操作数的两条边变成一条梯度贡献。', '记录当前执行的图不意味着能自动求离散选择或任意程序行为的导数。'],
    exercise: '为 (wx+b)² 画出叶子、乘法、加法和平方节点，完成 trace。再把平方改写为 u×u，说明图里有几个 u 节点、几条进入乘法的边。',
    quiz: { question: '把平方 u² 写为 u×u 后，反向传播该怎样处理重复出现的 u？', options: ['只保留第一条边', '把两个 u 当作不相关的参数', '保留两条边，并把对同一 u 的贡献相加', '无法计算导数'], correct: 2, hint: '先把左右两个位置暂时分别求偏导，再考虑它们其实是同一个变量。', explanation: '乘法两边分别贡献 u 倍上游梯度，随后都累加到同一个 u 节点，所以得到 2u 倍上游梯度。' },
    references: [ { title: 'D2L · Forward and Backward Propagation', url: 'https://d2l.ai/chapter_multilayer-perceptrons/backprop.html', note: '计算图、中间变量与前向反向顺序。' }, { title: 'PyTorch · Autograd Mechanics', url: 'https://docs.pytorch.org/docs/stable/notes/autograd.html', note: '真实框架怎样记录计算图与保存反传信息。' } ],
  },
  {
    id: 'backprop', number: '38', title: '反向传播', english: 'Accumulate influence from the loss', subtitle: '终点种子为 1，局部导数相乘，分支汇合时相加。',
    prerequisites: ['computation-graph', 'gradients'], goals: ['手算标量图的反向传播', '区分局部导数与总梯度', '用有限差分独立核查偏导'],
    problem: '网络有许多参数，却通常只有一个标量损失。若对每个参数分别微扰并重新前向，代价会随参数数目增长。反向传播复用中间结果，从同一个损失出发，在一次逆向遍历中得到所有相关参数的梯度。',
    intuition: [
      { title: '上游信息告诉当前节点“这次有多重要”', paragraphs: ['损失对自身的导数是 1，这是反传的种子。一个节点收到上游梯度后，乘以自己的局部导数，再传给各个输入。例如平方收到 1，给 u 传 2u；加法把这个值完整传给两个输入；乘法分别按另一个操作数缩放。'] },
      { title: '逆序的目的，是等所有贡献到齐', paragraphs: ['当一个值影响多个后续节点，必须先收齐这些分支传回的梯度，再继续向它的输入传播。逆拓扑顺序满足这个要求。梯度累加与参数更新是不同步骤：先完成整个反传，再由优化器改参数，否则同一轮计算可能混用新旧权重。'] },
    ],
    math: [
      { title: '沿一条路径使用链式法则', paragraphs: ['设 u=wx+b，L=u²。先求 L 对 u 的导数，再乘以 u 对各个叶子的偏导。输入 x 和参数 w 的公式相似，但训练通常只更新参数；对输入求梯度仍可用于敏感性分析。把某个量叫“数据”不会让其数学导数消失。'], formula: String.raw`\frac{\partial L}{\partial w}=2(wx+b)x,\quad \frac{\partial L}{\partial b}=2(wx+b),\quad \frac{\partial L}{\partial x}=2(wx+b)w` },
      { title: '多条路径汇合时求和', paragraphs: ['若中间量 v 同时影响多个子节点，损失对 v 的总导数是每条后续路径贡献的和。有限差分可以在不调用反传程序的情况下近似偏导，适合小模型测试。中心差分精度受步长和浮点舍入影响，不能把步长无限缩小。'], formula: String.raw`\bar v=\sum_{j}\bar u_j\frac{\partial u_j}{\partial v},\qquad \frac{\partial L}{\partial w}\approx\frac{L(w+\varepsilon)-L(w-\varepsilon)}{2\varepsilon}` },
    ],
    deep: [
      { title: '反向模式为何适合训练', paragraphs: ['参数有 P 个而输出只有一个标量损失时，反向模式可以用与前向同量级的运算得到全部梯度，避免 P 次独立扰动。它需要保存或重算中间值，因此把计算成本问题转换成计算与内存的共同设计问题。'] },
      { title: '梯度正确也可能训练失败', paragraphs: ['梯度校验通过只能说明当前公式的导数计算一致。标签错位、损失定义不合适、学习率过大、初始化饱和，都可能使训练效果很差。先把数值正确性、优化是否下降和独立数据效果分别检查，才能知道下一步该修哪一层问题。'] },
    ],
    formula: String.raw`\bar v\mathrel{+}=\bar u\,\frac{\partial u}{\partial v},\qquad \bar L=1`, formulaCaption: '反传的基本指令是累加：上游梯度乘局部导数。', lab: 'neural-network',
    labTask: '先设 x=2、w=0.5、b=1，点击三次“反传一步”，核对梯度 8、4、2 分别属于 w、b、x。再改为负输入，对照有限差分表的符号与误差。',
    starter: 'def gradients(x, w, b):\n    u = w * x + b\n    upstream = 2 * u\n    return {"w": None, "b": None, "x": None}  # TODO: 填三个偏导\n',
    reference: 'def gradients(x, w, b):\n    u = w * x + b\n    upstream = 2 * u\n    return {"w": upstream * x, "b": upstream, "x": upstream * w}\n\nprint(gradients(2, .5, 1))\n',
    codeExplanation: '先复用 u，再共享上游梯度 2u。测试既检查手算例子，也分别微扰三个独立变量；这样不会只验证实现和自身完全相同的表达式。此练习没有执行参数更新。',
    pythonTests: 'assert gradients(2, .5, 1) == {"w": 8, "b": 4, "x": 2}\n_point = {"x": -.7, "w": .3, "b": .2}\nfor _key in _point:\n    _plus, _minus = _point.copy(), _point.copy()\n    _plus[_key] += 1e-5\n    _minus[_key] -= 1e-5\n    _loss = lambda p: (p["w"] * p["x"] + p["b"]) ** 2\n    _numeric = (_loss(_plus) - _loss(_minus)) / 2e-5\n    assert abs(gradients(**_point)[_key] - _numeric) < 1e-7\n',
    misconceptions: ['反向传播计算梯度，优化器才使用梯度更新参数。', '一个节点收到多个分支时应累加，不能用最后一条路径覆盖前面的贡献。', '有限差分是校验手段，参数很多时通常不适合作为实际训练的主算法。'],
    exercise: '先手算正负两个例子的三项偏导，再补齐 gradients。把 x 设为 0，解释为什么 w 梯度为 0，但 b 梯度仍可能不为 0；用实验与断言核查。',
    quiz: { question: '同一个参数经两条路径影响损失时，总梯度应如何计算？', options: ['只取较大的那条', '把两条贡献相加', '把两条贡献相乘', '直接取平均，与损失定义无关'], correct: 1, hint: '考虑 f(x)=x²+x，两项都随 x 改变，总变化应怎样合成？', explanation: '链式法则对所有依赖路径求和。f(x)=x²+x 的导数是 2x+1，覆盖任何一条都会得到错误结果。' },
    references: [ { title: 'CS231n · Backpropagation', url: 'https://cs231n.github.io/optimization-2/', note: '局部梯度、上游梯度与分支累加的推导。' }, { title: 'D2L · Automatic Differentiation', url: 'https://d2l.ai/chapter_preliminaries/autograd.html', note: '反向模式梯度计算与自动微分练习。' } ],
  },
  {
    id: 'autodiff', number: '39', title: '手写微型自动微分引擎', english: 'Build reverse mode from scalar operations', subtitle: '把前向值、依赖和局部反传函数装进 Value，亲手处理共享节点。',
    prerequisites: ['backprop', 'python'], goals: ['实现记录依赖的标量 Value', '按逆拓扑顺序执行反传', '验证共享节点梯度与 XOR 项目引擎'],
    problem: '手写每个新公式的完整导数既慢又容易出错。自动微分把规则绑定到加法、乘法等基本操作，运行时建立计算图，再自动组合局部导数。本课实现一个真实的小引擎，训练项目会在同一思路上扩展激活与 MLP。',
    intuition: [
      { title: '让数字随身携带计算来历', paragraphs: ['Value 不只存 data，还存 grad、父节点和一个反传函数。计算 a*b 时，新节点保存前向结果，并创建一个函数：将上游梯度分别乘 b.data 与 a.data，再累加给两个父节点。它不是猜导数，也不是在每次反传时进行小扰动。'] },
      { title: '先排好顺序，再统一执行', paragraphs: ['从输出深度优先遍历依赖，先访问父节点再记录当前节点，得到拓扑顺序。反转后执行每个节点的局部反传，就能在向前层传播前收齐梯度。seen 集合按节点身份去重，但乘法反传仍分别执行两条边；x*x 是不可缺少的测试。'] },
    ],
    math: [
      { title: '一个乘法节点的反向接口', paragraphs: ['若 c=ab，反向函数接收 c 的上游梯度，输出给 a 与 b 的贡献。即使 a 与 b 恰好指向同一对象，也必须各执行一次累加。把 += 写成 =，会在共享参数或多分支图上静默产生错误。'], formula: String.raw`c=ab:\qquad \bar a\mathrel{+}=b\bar c,\qquad \bar b\mathrel{+}=a\bar c` },
      { title: '用一个包含复用的图做最小验证', paragraphs: ['选择 f(x)=x*x+x，既有重复乘法输入，也有到输出的直接分支。x=3 时前向为 12，梯度应为 7。数值差分是独立校验，小图手算则能定位是拓扑顺序、种子还是累加规则出了问题。'], formula: String.raw`f(x)=x^2+x,\qquad f'(x)=2x+1,\qquad f(3)=12,\quad f'(3)=7` },
    ],
    deep: [
      { title: '浏览器小引擎与完整阶段产物', paragraphs: ['页面参考代码只实现加法与乘法，足以展示记录图、拓扑排序和反传。仓库 projects/micrograd/ 扩展了减法、除法、常数幂、tanh、ReLU、随机初始化 MLP、XOR 训练和命令行梯度校验，全部只用标准库，能够在真实 CPython 中运行。'] },
      { title: '清梯度策略必须明确', paragraphs: ['本页小引擎每次 backward 清空可达图的所有梯度，便于重复检查；完整项目的叶子梯度跨调用累积，每次训练前显式 zero_grad，并清空中间梯度避免旧图重复传播。两种语义都需要文档。两者都不支持构图后原地改 data 再对旧图反传，也不提供高阶导数。'] },
    ],
    formula: String.raw`\text{forward: record graph}\quad\longrightarrow\quad\text{backward: reverse topological order}`, formulaCaption: '自动微分精确组合当前程序路径的局部导数，误差来自浮点计算。', lab: 'neural-network',
    labTask: '先用图核对平方节点两条边为何贡献 2u，再在代码里实现乘法反传。故意把一个 += 改为 =，观察 x*x+x 的测试怎样失败，然后恢复。',
    starter: autodiffReference.replace('self.grad += other.data * out.grad\n            other.grad += self.data * out.grad', 'self.grad += 0  # TODO: 左输入的梯度贡献\n            other.grad += 0  # TODO: 右输入的梯度贡献'),
    reference: autodiffReference,
    codeExplanation: '每个运算返回新 Value，闭包 pullback 保存局部反传规则。backward 用身份集合建立逆拓扑遍历，不借助任何高层框架。完整可下载代码在 projects/micrograd/；该目录 README 给出 CPython 测试、数值校验和 XOR 训练命令。',
    pythonTests: 'assert evaluate(3) == (12, 7)\nassert evaluate(-2) == (2, -3)\nassert evaluate(0) == (0, 1)\n_x = Value(2)\n_a = _x * _x\n_y = _a * _a + _a\n_y.backward()\nassert _x.grad == 36, "共享中间节点必须先收齐梯度再传播"\n_y.backward()\nassert _x.grad == 36, "本页约定每次清空可达图梯度"\n',
    misconceptions: ['自动微分不等于符号化简，也不是有限差分；它组合已知局部导数。', '用 seen 避免重复遍历节点，不表示可以丢掉重复输入的梯度贡献。', '清梯度策略是接口约定；不能把某个小引擎的行为自动套给 PyTorch。'],
    exercise: '完成两行乘法反传，使共享输入和共享中间节点的测试通过。随后在本地运行 python3 main.py check 与 python3 -m unittest，记录一个数值梯度误差和最终 XOR 损失。',
    quiz: { question: 'Value 的乘法反传中为什么必须使用 += 累加梯度？', options: ['因为 Python 不支持赋值', '为了接收同一节点所有路径的贡献', '为了把学习率自动加进去', '为了近似有限差分'], correct: 1, hint: '把 a 和 b 设为同一个 Value，想一想 c=a*b 的两次反传写入。', explanation: '一个 Value 可以被多次使用，各条依赖边都贡献导数。+= 保留前面收到的贡献，普通赋值会覆盖而漏掉路径。' },
    references: [ { title: 'Karpathy · micrograd', url: 'https://github.com/karpathy/micrograd', note: '标量反向模式与小型网络的公开教学项目。' }, { title: 'PyTorch · Autograd Mechanics', url: 'https://docs.pytorch.org/docs/stable/notes/autograd.html', note: '官方机制说明，用于比较生产框架的图与梯度语义。' } ],
  },
  {
    id: 'optimizers', number: '40', title: 'SGD、动量与 Adam', english: 'Turn gradients into parameter updates', subtitle: '保持梯度计算不变，比较更新规则与跨步状态。',
    prerequisites: ['autodiff', 'gradient-descent'], goals: ['实现 SGD 与动量更新', '解释 Adam 的两种矩估计和偏差校正', '区分梯度、学习率与优化器状态'],
    problem: '反传告诉我们当前位置损失怎样变化，却没有规定如何走下一步。普通 SGD、动量与 Adam 使用相同梯度，但保存和缩放信息的方式不同。把更新公式真正算一遍，才能理解为什么恢复训练还要保存优化器状态。',
    intuition: [
      { title: '动量记住一段近期方向', paragraphs: ['SGD 直接沿当前负梯度走。动量把之前的方向按比例保留，再加入当前梯度，可能在持续一致的方向加快，也能缓解某些方向的来回震荡。本课程采用 v=βv+g 的约定；有的教材加入 (1−β)，比较学习率时必须一起比较定义。'] },
      { title: 'Adam 为每个参数调整有效尺度', paragraphs: ['Adam 维护梯度的一阶指数均值与平方梯度的指数均值。前者估计方向，后者估计尺度；再做早期偏差校正并除以尺度平方根。它不是自动找到最佳学习率，学习率过大仍可能发散，不同任务也不保证优于 SGD。'] },
    ],
    math: [
      { title: 'SGD 与动量', paragraphs: ['学习率 η 为正，梯度 g 由本轮完整反传得到。普通 SGD 对每个参数使用同样形式；动量 v 是与参数同形状的跨步状态。这里没有把梯度裁剪或权重衰减暗中并入公式，方便独立比较规则。'], formula: String.raw`\theta_{t+1}=\theta_t-\eta g_t,\qquad v_t=\beta v_{t-1}+g_t,\quad\theta_{t+1}=\theta_t-\eta v_t` },
      { title: 'Adam 的校正与数值稳定项', paragraphs: ['初始矩为 0，会使前几步均值偏小，因此除以 1−β 的 t 次幂进行校正。二阶矩是梯度平方的均值，不是减去均值平方后的方差。ε 防止分母为零；它与用于数值梯度检查的小扰动虽常用同一字母，作用不同。'], formula: String.raw`m_t=\beta_1m_{t-1}+(1-\beta_1)g_t,\quad s_t=\beta_2s_{t-1}+(1-\beta_2)g_t^2,\quad\theta_{t+1}=\theta_t-\eta\frac{m_t/(1-\beta_1^t)}{\sqrt{s_t/(1-\beta_2^t)}+\epsilon}` },
    ],
    deep: [
      { title: '小批量让梯度成为估计', paragraphs: ['用全部训练集计算的梯度与随机小批次梯度并不一样。小批次每步成本低，却带来抽样噪声；打乱顺序、批次大小、随机种子都会影响轨迹。本实验使用固定单样本目标以单独观察更新公式，不模拟随机抽样过程。'] },
      { title: '恢复训练需要恢复状态', paragraphs: ['若只恢复参数而把动量或 Adam 矩清零，下一步通常不等于原训练的下一步。可靠断点需要模型参数、优化器状态、步数以及适当的随机状态。评估一个优化器时还要控制预算、学习率与验证集选择，不能只比较某一次训练终点。'] },
    ],
    formula: String.raw`\text{gradient}\ +\ \text{optimizer state}\ \longrightarrow\ \Delta\theta`, formulaCaption: '同一梯度可以产生不同更新，优化器状态属于训练过程的一部分。', lab: 'neural-network',
    labTask: '先把 λ 设为 0，用相同初始参数比较三种优化器的前三步，记录每步 w 与损失。提高学习率，寻找损失升高的情况，并解释这不等于反传出错。',
    starter: 'def momentum_step(w, grad, velocity, lr=.1, beta=.9):\n    velocity = 0  # TODO: 保存旧方向并加入新梯度\n    w = w  # TODO: 沿负更新方向走一步\n    return w, velocity\n',
    reference: 'def momentum_step(w, grad, velocity, lr=.1, beta=.9):\n    velocity = beta * velocity + grad\n    w = w - lr * velocity\n    return w, velocity\n\nw, v = 1, 0\nfor grad in [2, 2, -1]:\n    w, v = momentum_step(w, grad, v)\n    print(w, v)\n',
    codeExplanation: '函数显式接收和返回 velocity，所以状态在迭代间保存。测试包括梯度反向和 β=0 退化为 SGD；不把参数值当速度，也不在每步调用时重新把速度设成零。',
    pythonTests: '_w, _v = momentum_step(1, 2, 0)\nassert abs(_w - .8) < 1e-12 and _v == 2\n_w, _v = momentum_step(_w, 2, _v)\nassert abs(_v - 3.8) < 1e-12 and abs(_w - .42) < 1e-12\nassert momentum_step(1, 2, 9, beta=0) == (.8, 2)\n_w, _v = momentum_step(1, -2, 0)\nassert _w > 1 and _v < 0\n',
    misconceptions: ['Adam 仍需要选择学习率，也不保证每一步训练损失都下降。', 'Adam 的第二种矩是平方梯度均值，不能直接称作梯度方差。', '动量状态与参数不同，恢复权重后清零状态会改变后续轨迹。'],
    exercise: '实现 momentum_step，手算连续两次梯度为 2 的更新。再运行交互实验比较 Adam 首步与 SGD 首步，说明矩校正如何改变有效更新尺度。',
    quiz: { question: '保存训练断点时，只保存模型参数会怎样影响 Adam 的继续训练？', options: ['一定与原轨迹完全一致', '一二阶矩和步数丢失，下一步可能改变', '模型参数自动包含所有优化器状态', '只能影响显示，不能影响数值'], correct: 1, hint: '检查 Adam 更新式里除了参数与当前梯度，还依赖哪些历史量。', explanation: 'Adam 的矩估计和步数参与更新；缺少这些状态，即使参数相同，也通常无法复现原训练的下一步。' },
    references: [ { title: 'Kingma & Ba · Adam', url: 'https://arxiv.org/abs/1412.6980', note: 'Adam 原始论文，矩估计与偏差校正公式。' }, { title: 'D2L · Momentum', url: 'https://d2l.ai/chapter_optimization/momentum.html', note: '动量优化的几何解释与不同记号约定。' } ],
  },
  {
    id: 'regularization', number: '41', title: '正则化与 Dropout', english: 'Control fitting and training randomness', subtitle: '把参数惩罚、随机失活与验证集效果分开检验。',
    prerequisites: ['optimizers', 'generalization'], goals: ['推导 L2 惩罚对梯度的贡献', '计算倒置 Dropout 的输出与期望', '区分训练和推理模式'],
    problem: '网络可以把训练样本记得很好，却在新样本上失败。正则化改变训练的偏好或过程，以限制某些拟合行为。它需要用独立验证数据判断是否有帮助，不能仅凭训练损失变大就宣称泛化一定改善。',
    intuition: [
      { title: 'L2 给大权重增加成本', paragraphs: ['在数据损失上加一个参数平方惩罚，训练就会权衡拟合误差与权重规模。它可能鼓励更平滑或更小范数的解，但特征尺度、网络结构和其他参数都影响具体效果。偏置是否参与惩罚是一个建模选择，工程中常将其排除。'] },
      { title: 'Dropout 让某些激活临时缺席', paragraphs: ['训练时随机把一部分激活置零，使下游不能始终依赖同一组合。倒置 Dropout 把保留的激活除以保留概率，保持该激活的期望不变。推理时不再随机丢弃，也不再额外缩放；若忘记切换模式，相同输入可能得到不同输出。'] },
    ],
    math: [
      { title: '把惩罚的梯度算出来', paragraphs: ['这里采用 λ/2 乘权重平方和，所以附加梯度是 λw。使用 SGD 时，可把一步更新写成先乘 1−ηλ 再减数据梯度；对自适应优化器，这种损失惩罚与解耦权重衰减一般不等价，不能把 Adam 与 AdamW 混成同一个规则。'], formula: String.raw`J=L_{\rm data}+\frac\lambda2\|\mathbf w\|_2^2,\quad \nabla J=\nabla L_{\rm data}+\lambda\mathbf w,\quad \mathbf w^+=(1-\eta\lambda)\mathbf w-\eta\nabla L_{\rm data}` },
      { title: '倒置 Dropout 的缩放来自期望', paragraphs: ['令 m 以 1−p 的概率取 1，以 p 的概率取 0，并与当前固定激活 h 独立。训练输出为 mh/(1−p)，其期望为 h，要求 p<1。这个等式只谈单个激活；经过非线性网络后的期望输出和损失不一定等于无 Dropout 时的值。'], formula: String.raw`m\sim\operatorname{Bernoulli}(1-p),\quad\tilde h=\frac{mh}{1-p},\quad\mathbb E[\tilde h]=h\quad(0\le p<1)` },
    ],
    deep: [
      { title: '用验证集决定何时停止', paragraphs: ['早停监控独立验证指标，在训练继续改善而验证效果转差前后保留合适断点。验证集参与超参数选择，不能再把它当作完全未见的数据报告最终效果。测试集应留到选择完成后，反复查看测试集同样会泄漏选择信息。'] },
      { title: '“更正则”不是单调更好', paragraphs: ['惩罚太强或丢弃概率过高会导致欠拟合。正则化还会与数据增强、网络宽度、归一化、学习率和训练预算相互影响。本实验只展示真实的 L2 梯度与掩码缩放，单个标量目标无法证明泛化；要在阶段项目的训练数据之外设计验证问题。'] },
    ],
    formula: String.raw`\text{train: }\tilde h=mh/(1-p),\qquad \text{eval: }h`, formulaCaption: '倒置 Dropout 的训练缩放与推理行为必须成套使用。', lab: 'neural-network',
    labTask: '固定 w，逐渐增大 λ，比较数据梯度与正则梯度。再把 p 设为 0.5，切换保留和丢弃掩码，手算两个输出的加权期望；说明按钮并未模拟随机采样。',
    starter: 'def l2_gradient(w, data_grad, lam):\n    return None  # TODO: 数据梯度加惩罚梯度\n\ndef inverted_dropout(h, mask, p, training=True):\n    if not training:\n        return h\n    return None  # TODO: 保留后除以保留概率\n',
    reference: 'def l2_gradient(w, data_grad, lam):\n    return data_grad + lam * w\n\ndef inverted_dropout(h, mask, p, training=True):\n    if not 0 <= p < 1:\n        raise ValueError("需要 0 <= p < 1")\n    if not training:\n        return h\n    return mask * h / (1 - p)\n\nprint(inverted_dropout(3, 1, .5), inverted_dropout(3, 0, .5))\n',
    codeExplanation: 'mask 显式传入，让测试可以核算，不把一次随机结果误认为数学结论。实际训练需按保留概率独立抽样；推理分支直接返回原激活。L2 函数只给出梯度，不执行更新。',
    pythonTests: 'assert l2_gradient(2, -3, .5) == -2\nassert l2_gradient(-2, 0, .1) == -.2\nassert inverted_dropout(3, 1, .5) == 6\nassert inverted_dropout(3, 0, .5) == 0\nassert inverted_dropout(3, 0, .5, training=False) == 3\n_p = .25\n_expectation = (1 - _p) * inverted_dropout(4, 1, _p) + _p * inverted_dropout(4, 0, _p)\nassert abs(_expectation - 4) < 1e-12\n',
    misconceptions: ['正则化不能替代验证集，也不保证越强越好。', '倒置 Dropout 保持单个激活的期望，不保证非线性网络的期望损失不变。', 'Adam 上的 L2 损失惩罚一般不等于 AdamW 的解耦权重衰减。'],
    exercise: '实现 L2 梯度和倒置 Dropout，通过期望断言。把 p 改为 0.25，手算保留时的放大倍数；再解释推理时为何不能继续使用同一随机掩码规则。',
    quiz: { question: '倒置 Dropout 丢弃概率为 0.25 时，被保留的激活在训练中乘以多少？', options: ['0.25', '0.75', '4/3', '4'], correct: 2, hint: '保留概率是 1−p，训练时除以保留概率以维持单激活的期望。', explanation: '保留概率为 0.75，被保留的激活除以 0.75，即乘 4/3。推理时直接使用原激活，不再做此缩放。' },
    references: [ { title: 'D2L · Dropout', url: 'https://d2l.ai/chapter_multilayer-perceptrons/dropout.html', note: '倒置 Dropout、期望与训练推理模式。' }, { title: 'Loshchilov & Hutter · Decoupled Weight Decay', url: 'https://arxiv.org/abs/1711.05101', note: 'L2 正则与自适应优化器中权重衰减的区别。' } ],
  },
  {
    id: 'pytorch', number: '42', title: 'PyTorch 张量与 autograd', english: 'Map scalar reasoning to real tensors', subtitle: '先把形状与梯度语义对齐，再在本地运行真正的 PyTorch。',
    prerequisites: ['autodiff', 'matrix-multiplication'], goals: ['解释 Tensor 的形状与叶子梯度', '将手写计算图对应到 autograd', '区分浏览器标准库练习与本地 PyTorch'],
    problem: '手写标量引擎可以训练小网络，但实际模型需要张量运算与成熟框架。学习 PyTorch 不该只记接口：同一条链式法则仍在工作，只是一次基本操作处理许多元素。形状、梯度累加和更新模式仍需由我们明确控制。',
    intuition: [
      { title: 'Tensor 是带形状的数字容器', paragraphs: ['一个批次四个二维样本的形状是 (4,2)，不是“长度为八的一维数组”。nn.Linear(2,8) 保存形状 (8,2) 的 weight，并计算 X·weightᵀ+b，得到 (4,8)。它的存储方向与上一课手写 XW 的 W 相反，公式必须对照接口。'] },
      { title: '框架帮你反传，你仍决定何时清零', paragraphs: ['requires_grad=True 让叶子张量参与梯度跟踪。标量 loss.backward() 后，叶子的 .grad 保存累计梯度；optimizer.zero_grad()、前向与损失、backward()、step() 组成训练循环。评估常组合 model.eval() 与 torch.no_grad()，前者改变某些层行为，后者关闭梯度记录。'] },
    ],
    math: [
      { title: '线性层接口中的转置', paragraphs: ['若一个批次有 B 个样本，每个样本 d 维，nn.Linear(d,m) 的权重存储为 m×d。前向输出为 XWᵀ+b，形状 B×m。偏置沿批次轴广播，同一个权重矩阵在所有样本间共享；梯度会累加这些使用位置的贡献。'], formula: String.raw`X\in\mathbb R^{B\times d},\quad W_{\rm torch}\in\mathbb R^{m\times d},\quad Y=XW_{\rm torch}^{\top}+\mathbf1_B\mathbf b^\top` },
      { title: '非标量输出需要说明求哪种导数', paragraphs: ['张量输出对张量输入一般对应雅可比矩阵。反向模式通常计算给定上游向量 v 与雅可比的乘积；标量损失默认种子为 1。非标量输出直接 backward() 一般需要显式提供同形上游梯度，或先用 sum、mean 归约成定义清楚的标量损失。'], formula: String.raw`\mathbf y=f(\mathbf x),\quad J_{ij}=\frac{\partial y_i}{\partial x_j},\qquad \nabla_{\mathbf x}(\mathbf v^\top\mathbf y)=J^\top\mathbf v` },
    ],
    deep: [
      { title: '真实运行环境是本地 Python', paragraphs: ['本网站浏览器的 Python 练习只使用标准库，下面的 shape 与线性前向练习可直接运行。真实 torch 代码放在 projects/micrograd/torch_compare.py；按该目录 README 创建虚拟环境并安装 torch 后运行。页面没有声称把 PyTorch 编译进浏览器，也没有伪装 autograd 输出。'] },
      { title: '叶子、脱离与原地操作', paragraphs: ['常规 backward 默认主要把梯度留在需要梯度的叶子上；中间张量若要观察梯度需了解 retain_grad。detach() 会切断后续对该路径的跟踪，item() 取出 Python 数字也不能继续承载原图。更新参数应由优化器或 no_grad 上下文管理，避免在仍需反传的图中错误原地改值。'] },
    ],
    formula: String.raw`\text{zero gradients}\to\text{forward}\to L\to\text{backward}\to\text{step}`, formulaCaption: '框架替你组织张量反传，训练顺序与形状仍由你负责。', lab: 'neural-network', runtime: 'browser',
    labTask: '在实验表中检查 (3,1)→(3,2)→(3,1) 的维数变化。改变一个输出权重验证三行都受影响；运行标准库代码后，按项目 README 在本地对照真实 torch。',
    starter: 'def linear_shape(batch, in_features, out_features):\n    return None  # TODO: 返回输出、PyTorch weight、bias 的形状\n\ndef linear_row(x, weight, bias):\n    # weight 每行对应一个输出单元，即 out_features × in_features\n    return None  # TODO: 按 PyTorch 的存储约定计算输出\n',
    reference: 'def linear_shape(batch, in_features, out_features):\n    return (batch, out_features), (out_features, in_features), (out_features,)\n\ndef linear_row(x, weight, bias):\n    if len(weight) != len(bias) or any(len(row) != len(x) for row in weight):\n        raise ValueError("线性层形状不一致")\n    return [sum(a * b for a, b in zip(x, row)) + c for row, c in zip(weight, bias)]\n\nprint(linear_shape(4, 2, 8))\nprint(linear_row([1, 2], [[1, -1], [2, 0]], [.5, -1]))\n',
    codeExplanation: '本页运行的是标准库的形状与前向核算，函数不会导入 torch，也不会声称执行 autograd。真实 PyTorch 的 requires_grad、backward 与优化器对照保存在本地脚本 torch_compare.py，需单独安装依赖。',
    pythonTests: 'assert linear_shape(4, 2, 8) == ((4, 8), (8, 2), (8,))\nassert linear_shape(1, 3, 1) == ((1, 1), (1, 3), (1,))\nassert linear_row([1, 2], [[1, -1], [2, 0]], [.5, -1]) == [-.5, 1]\nassert linear_row([0, 0], [[5, 9]], [3]) == [3]\n',
    misconceptions: ['model.eval() 不会自动禁用梯度；torch.no_grad() 也不会自动切换 Dropout 的推理行为。', 'PyTorch 线性层 weight 的存储形状是 (out,in)，不能直接照搬另一种矩阵记法。', '本页标准库形状练习不是 PyTorch 执行器，真实 torch 脚本需要本地 Python 环境。'],
    exercise: '完成两个标准库函数，对照实验核查形状。再在本地运行 torch_compare.py，检查标量梯度断言与批次输出形状；分别解释 eval、no_grad 和 zero_grad 的作用。',
    quiz: { question: 'nn.Linear(3,5) 接收形状为 (8,3) 的输入时，weight 与输出形状分别是什么？', options: ['weight (3,5)，输出 (8,3)', 'weight (5,3)，输出 (8,5)', 'weight (8,3)，输出 (5,3)', 'weight (5,8)，输出 (3,5)'], correct: 1, hint: 'PyTorch 保存每个输出单元的一行权重，前向内部使用 weight 的转置。', explanation: '5 个输出单元各有 3 个输入权重，weight 为 (5,3)；8 个样本各得到 5 个输出，结果为 (8,5)。' },
    references: [ { title: 'PyTorch · Autograd Quickstart', url: 'https://docs.pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html', note: 'requires_grad、backward 与梯度跟踪的官方教程。' }, { title: 'PyTorch · Linear', url: 'https://docs.pytorch.org/docs/stable/generated/torch.nn.Linear.html', note: '线性层输入、权重与输出形状的官方契约。' } ],
  },
  {
    id: 'nn-project', number: '43', title: '从零神经网络与框架对照', english: 'Train, verify, and compare', subtitle: '把数据、前向、自动微分与更新连成一个可以复现的 XOR 小项目。',
    prerequisites: ['regularization', 'pytorch'], goals: ['完成可运行的标量 MLP 训练循环', '以独立梯度检查和断言验证引擎', '对照从零实现与真实 PyTorch 的共同契约'],
    problem: '每个局部公式都看懂之后，还需要证明它们真的能协作。阶段项目用四个 XOR 样本训练一个小型 MLP，让前向、损失、反传、清梯度和优化器成为闭环，再用真实 PyTorch 对照相同计算语义。它验证工程链路，不把玩具训练当作语言模型。',
    intuition: [
      { title: '一次迭代是五个可观察的步骤', paragraphs: ['固定种子初始化参数，然后对整批四个样本前向，计算均方误差，清参数梯度，反传，按学习率更新。每轮必须重新前向，让计算图保存当前参数下的中间值。记录初始和最终损失，并检查每个样本的预测符号，才能发现“损失在变但任务没学会”的情况。'] },
      { title: '对照时先对齐契约，再比较结果', paragraphs: ['先在同一个标量公式上比较两个引擎的梯度，再检查网络层宽、激活、目标编码和 mean 损失。不同随机数实现或初始化尺度会产生不同轨迹，不能要求两个网络最终每个权重都一样。正确的对照是梯度数值、维数以及足够训练后的任务行为。'] },
    ],
    math: [
      { title: '明确四个样本与目标', paragraphs: ['项目把输入编码为 −1 与 +1：两个分量相同则目标为 −1，不同则目标为 +1。最终 tanh 输出在 −1 到 1 之间，按正负号分类。网络结构为 2→8→1，隐藏与输出都使用 tanh；它有 2×8+8+8×1+1=33 个参数。'], formula: String.raw`\hat y=\tanh(W_2\tanh(W_1\mathbf x+\mathbf b_1)+b_2),\qquad L=\frac14\sum_{n=1}^4(\hat y_n-y_n)^2` },
      { title: '先检查梯度，再检查下降', paragraphs: ['对随机选择的小图输入做中心差分，误差在合理容差内才说明反传实现与当前目标一致。训练后检查最终损失明显下降，并按阈值判断四个点；四点全对只表明拟合成功，不能估计真实任务中未知分布的表现。'], formula: String.raw`g_{\rm num}=\frac{L(\theta+\varepsilon)-L(\theta-\varepsilon)}{2\varepsilon},\qquad |g_{\rm auto}-g_{\rm num}|<10^{-7}` },
    ],
    deep: [
      { title: '项目文件与可复现入口', paragraphs: ['仓库 projects/micrograd/engine.py 实现标量引擎，nn.py 定义种子可控的 MLP，main.py 提供 check 与 train 命令，test_micrograd.py 覆盖共享路径、激活、数值梯度和实际 XOR 下降。README 给出标准库命令与独立 PyTorch 对照脚本的本地安装方法。'] },
      { title: '页面练习与完整训练各自验证什么', paragraphs: ['页面练习核算一个可微神经元的损失与梯度，并实际更新一个参数，适合浏览器快速检查链式法则。完整 MLP 从零训练在项目目录运行，绝不由预录结果替代。四点训练集没有独立泛化证据；扩展到真实数据时，应先定义划分、基线和可重复评估协议。'] },
    ],
    formula: String.raw`\theta\gets\theta-\eta\nabla_\theta L\quad\text{after zero-grad and backward}`, formulaCaption: '训练闭环把已定义的损失变成实际参数变化；测试让这个闭环可核查。', lab: 'neural-network',
    labTask: '先在前向表中观察共享参数，再核对反传的解析与数值梯度，最后应用几次更新观察损失。完整 XOR 训练请运行 projects/micrograd 的 main.py train，并记录种子与参数。',
    starter: 'import math\n\ndef loss_and_gradient(w, x, target):\n    prediction = math.tanh(w * x)\n    loss = (prediction - target) ** 2\n    grad = 0  # TODO: 误差、tanh 导数、输入三个因子\n    return loss, grad\n\ndef train_one(w, x, target, lr=.1):\n    loss, grad = loss_and_gradient(w, x, target)\n    return w  # TODO: 更新并返回 w\n',
    reference: 'import math\n\ndef loss_and_gradient(w, x, target):\n    prediction = math.tanh(w * x)\n    loss = (prediction - target) ** 2\n    grad = 2 * (prediction - target) * (1 - prediction ** 2) * x\n    return loss, grad\n\ndef train_one(w, x, target, lr=.1):\n    loss, grad = loss_and_gradient(w, x, target)\n    return w - lr * grad\n\nw = .2\nfor step in range(10):\n    print(step, loss_and_gradient(w, 1, 1)[0])\n    w = train_one(w, 1, 1)\n',
    codeExplanation: '页面代码是小型梯度核算，不宣称单神经元可以解决 XOR。测试使用数值差分与更新后的实际损失。完整 33 参数 XOR MLP 由项目的 Value 引擎训练，README 有可运行命令与测试；真实 torch 对照单独在本地运行。',
    pythonTests: '_w, _x, _target = .3, -.7, 1\n_loss, _grad = loss_and_gradient(_w, _x, _target)\n_num = (loss_and_gradient(_w + 1e-5, _x, _target)[0] - loss_and_gradient(_w - 1e-5, _x, _target)[0]) / 2e-5\nassert abs(_grad - _num) < 1e-7\nassert loss_and_gradient(.2, 0, 1) == (1, 0)\n_updated = train_one(.2, 1, 1)\nassert loss_and_gradient(_updated, 1, 1)[0] < loss_and_gradient(.2, 1, 1)[0]\nfor _i in range(50):\n    _updated = train_one(_updated, 1, 1)\nassert loss_and_gradient(_updated, 1, 1)[0] < .02\n',
    misconceptions: ['四点 XOR 全对只验证拟合与工程链路，不等于在真实任务上泛化良好。', '不同初始化的两个实现不需要学出完全相同的权重，先对照函数与梯度。', '旧图的中间值对应旧参数，更新后必须重新前向才能进行下一轮训练。'],
    exercise: '通过页面梯度与下降测试，再本地执行项目单元测试、check 与带种子的 train。修改学习率或隐藏宽度，记录成功与失败的设置，并解释为何不应用四个训练点报告泛化性能。',
    quiz: { question: '从零 MLP 与 PyTorch 初始权重不同，最可靠的首个对照步骤是什么？', options: ['要求所有最终权重逐项完全相同', '对同一标量函数与同一点比较梯度', '只看哪个打印得更快', '去掉所有测试以免随机性干扰'], correct: 1, hint: '先构造一个输入与公式都完全一致的小问题，把初始化差异排除出去。', explanation: '先固定同一个标量公式、输入与参数，对照前向和梯度，才能独立核查求导语义；不同初始化的完整训练轨迹不应要求相同。' },
    references: [ { title: 'Karpathy · micrograd', url: 'https://github.com/karpathy/micrograd', note: '标量自动微分与小网络训练的教学参考。' }, { title: 'PyTorch · Optimization Tutorial', url: 'https://docs.pytorch.org/tutorials/beginner/basics/optimization_tutorial.html', note: '清梯度、反传与优化器更新的官方训练循环。' } ],
  },
];
