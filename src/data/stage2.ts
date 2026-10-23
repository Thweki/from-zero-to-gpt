import type { Lesson } from '../types';

const learningSource = { title: 'An Introduction to Statistical Learning · 免费教材', url: 'https://www.statlearning.com/', note: '作者公开教材：监督学习、回归、分类与模型评估。' };
const regressionSource = { title: 'Dive into Deep Learning · Linear Regression', url: 'https://d2l.ai/chapter_linear-regression/linear-regression.html', note: '线性预测、均方损失和梯度下降的完整推导。' };

/** Original teaching text, executable examples and acceptance checks for stage 2. */
export const stage2Lessons: Lesson[] = [
  {
    id: 'rules-vs-learning', number: '24', title: '规则编程与机器学习', english: 'Rules, examples, and learned functions',
    subtitle: '从手写一条规则，走向用样本选择一条规则。', prerequisites: ['python'],
    goals: ['区分规则、样本和模型参数', '解释监督学习需要什么输入', '用独立样本检验学到的规则'],
    problem: '假设你想根据房屋面积估算租金。写出“面积乘一个固定单价”很容易，但单价如何决定？当地区、楼龄和市场变化时，手写规则越来越难维护。机器学习把一部分规则选择交给数据，同时仍需要人决定任务、特征、模型与评价方式。',
    intuition: [
      { title: '两种程序都在计算函数', paragraphs: ['规则程序可以写成 rent=2×area+1：开发者直接指定 2 和 1。学习程序则先接收一些面积与真实租金的配对，让算法寻找合适的斜率和截距。训练结束以后，两者都可以把一个新面积映射为预测租金。', '“学习”没有让程序脱离规则。我们仍明确写出允许搜索的函数、怎样打分以及怎样改参数。自动化的是这些约束下的参数选择，而不是自动理解所有业务含义。'] },
      { title: '样本既是线索，也有局限', paragraphs: ['如果只给模型很小房屋的例子，它可能在这个范围内表现不错，却无法可靠预测别墅。这与人根据少量经验猜规律很相似：看到过的情况越窄，推断到远处就越需要谨慎。', '实验里可以在固定规则和可调模型之间切换。先用训练点调整直线，再看另一组验证点。验证点没有参与参数更新，因而能提供不同于“记住例子”的检查。'] },
    ],
    math: [
      { title: '把例子写成输入与目标', paragraphs: ['监督数据集包含 n 对输入 xᵢ 和目标 yᵢ。输入必须是在实际预测时能够获得的信息；目标是训练时用来判断预测好坏的答案。模型 f 的参数 θ 在训练期间被改变。', '本课只有一个特征和两个参数，θ=(w,b)。它仍是机器学习，只是模型规模很小，便于逐步检查全部计算。'], formula: String.raw`D=\{(x_i,y_i)\}_{i=1}^{n},\qquad f_{\theta}(x)=wx+b` },
      { title: '选择规则需要一个明确标准', paragraphs: ['给每个候选参数计算平均平方误差，误差越小，说明它对这些已知答案的拟合越好。训练是寻找这个平均值较小的参数，接下来的课程才会讨论如何有效寻找。', '最小化训练误差并不保证在未来数据上最好。如果数据记录出错，模型也可能很努力地拟合错误。目标函数表达的是我们交给算法的标准，而非任务价值的全部。'], formula: String.raw`\theta^{\ast}\in\underset{\theta}{\operatorname{argmin}}\;\frac1n\sum_{i=1}^{n}(f_{\theta}(x_i)-y_i)^2` },
    ],
    deep: [
      { title: '何时应该直接写规则', paragraphs: ['税率、权限和单位换算等明确规定通常应该直接编码：精确规则有可解释、可审核和容易测试的优势。机器学习更适合难以枚举规则、但有足够代表性样本的任务，例如图像模式识别。两种方法也可以组合。'] },
      { title: '模型选择也是人为假设', paragraphs: ['选择直线就假定预测随输入线性变化；给模型更多自由度会改变它能表达的关系。即使数据没有变化，不同模型族也可能给出不同外推。后面的泛化实验会把这种假设与验证误差联系起来，而不是把学习结果当成唯一真理。'] },
    ],
    formula: String.raw`\text{examples}+\text{model family}+\text{objective}\longrightarrow\text{learned parameters}`,
    formulaCaption: '数据提供证据，模型族和目标规定“如何学”。', lab: 'machine-learning',
    labTask: '先切换到手写规则，观察它在训练点和验证点的误差；再切到可学习模型，调节 w、b 后执行训练。记录两种方案的预测，并说明学习程序中仍有哪些部分是人预先指定的。',
    starter: `def predict(x, w, b):
    return w * x + b

def choose_model(data, candidates):
    # TODO: 返回平均平方误差最小的 (w, b)，并列时保留先出现者。
    return None

print(choose_model([(0, 1), (1, 3)], [(0, 0), (2, 1)]))
`,
    reference: `def predict(x, w, b):
    return w * x + b

def choose_model(data, candidates):
    if not data or not candidates:
        raise ValueError("需要样本和候选模型")
    return min(candidates, key=lambda p: sum((predict(x, *p) - y) ** 2 for x, y in data) / len(data))

print(choose_model([(0, 1), (1, 3)], [(0, 0), (2, 1)]))
`,
    codeExplanation: '这里刻意使用有限候选集合，让“学习”变成可穷举验证的选择。min 按每个候选的平均误差比较，返回参数而不是误差；同分时保持候选的原顺序。后续用梯度下降替代穷举，学习目标仍然相同。',
    pythonTests: `assert predict(-2, 3, 1) == -5
assert choose_model([(0, 1), (1, 3), (2, 5)], [(1, 0), (2, 1), (3, 2)]) == (2, 1)
assert choose_model([(0, 2)], [(0, 1), (9, 3)]) == (0, 1), "并列时保持顺序"
assert choose_model([(1, -2), (2, -4)], [(2, 0), (-2, 0)]) == (-2, 0)
`,
    misconceptions: ['机器学习仍然依赖人指定的表示、模型和目标，不会自动定义什么叫成功。', '训练数据里的答案是学习线索，不代表预测时也能读取真实答案。', '训练样本都预测正确，并不能推出未来样本也全部正确。'],
    exercise: '为 y=−x+2 构造三个训练样本和四组候选参数，实现模型选择。再加入一个错误标签，观察最优候选是否改变；写出一项你会优先检查的数据问题。',
    quiz: { question: '用样本训练 y=wx+b 时，哪一项由训练过程直接调整？', options: ['真实目标 y', '输入的测量单位', '参数 w 和 b', '任务是否有用'], correct: 2, hint: '区分已观测的样本、预先设定的任务与模型内部可改变的数值。', explanation: '在给定数据、模型形式和目标之后，训练调整 w 和 b。它不会自动修改真实标签，也不会判断业务任务本身是否合理。' },
    references: [learningSource, { title: 'Google Machine Learning Crash Course · Introduction', url: 'https://developers.google.com/machine-learning/crash-course', note: '从问题、样本和模型开始理解机器学习工作流。' }],
  },
  {
    id: 'datasets', number: '25', title: '数据集、训练集与验证集', english: 'Split before you learn',
    subtitle: '把用于学习的答案，与用于检验的答案分开。', prerequisites: ['rules-vs-learning', 'probability'],
    goals: ['解释训练、验证与测试的不同用途', '实现可复现且无重叠的数据划分', '识别重复样本、时间和预处理造成的信息泄露'],
    problem: '一位学生练习过同一套试卷后，在这套卷子上取得高分，并不能证明他能解决新题。模型同样需要未参加参数学习的样本。划分数据不是文件整理，而是决定我们的评估究竟在检验记忆还是对新情况的预测能力。',
    intuition: [
      { title: '练习、调方案与最终考试', paragraphs: ['训练集负责计算梯度和更新参数；验证集负责比较模型复杂度、学习率或训练轮数；测试集保留到最终方案确定以后，提供一次独立评估。反复看测试集再修改方案，它就逐渐成为另一份验证集。', '实验按固定种子把 32 个合成样本分组。调节训练比例时，点的颜色和实际样本数都会改变。更多训练点可能改善拟合，但过少验证点会让误差估计更不稳定。'] },
      { title: '先问新样本从哪里来', paragraphs: ['如果未来任务是预测下个月销售额，随机打散所有月份可能把未来信息带回训练。应该按时间先后划分。如果一个病人有多次记录，则通常需要按病人分组，防止同一人的近似副本同时出现在两边。', '标准化、填补缺失值、选择特征等会从数据估计统计量。这些统计量也只能在训练集拟合，再原样应用到验证和测试；否则评估答案已经悄悄参与了学习。'] },
    ],
    math: [
      { title: '集合不相交，还要符合使用场景', paragraphs: ['训练、验证和测试索引应两两不相交，它们的并集覆盖计划使用的全部样本。代码里可以用集合检查这些条件，防止切片边界错误或重复索引。', '无重叠只是必要条件。两条不同索引如果是同一文档的重复副本，仍可能泄露。真实划分还需要检查内容、用户或时间上的关系。'], formula: String.raw`I_{\mathrm{train}}\cap I_{\mathrm{val}}=\varnothing,\qquad I_{\mathrm{train}}\cup I_{\mathrm{val}}=\{0,\ldots,n-1\}` },
      { title: '验证误差是有限样本估计', paragraphs: ['验证损失是只在验证样本上计算的平均损失。它估计的是类似分布下的表现，样本太少或不具有代表性时，这个估计可能偏离部署表现。', '固定随机种子可以重现同一次划分，方便比较方案；它不会让数据自动变得有代表性。报告多个种子或交叉验证有助于观察划分带来的波动，但不能修复系统性偏差。'], formula: String.raw`\widehat R_{\mathrm{val}}(\theta)=\frac1{|I_{\mathrm{val}}|}\sum_{i\in I_{\mathrm{val}}}\ell(f_{\theta}(x_i),y_i)` },
    ],
    deep: [
      { title: '标签分布与分层划分', paragraphs: ['在罕见类别的分类任务中，普通随机划分可能让小验证集里没有任何正例。分层划分尽量保留各类比例，但若部署要面对新医院或新地区，按来源隔离可能比保留比例更重要。划分策略必须对应你希望检验的推广范围。'] },
      { title: '验证集也会被间接拟合', paragraphs: ['每次按验证结果选择方案，都在利用验证集的信息。尝试成千上万种方案后，最好的验证分数可能部分来自偶然性。这是需要保留最终测试集、记录搜索次数并在最终方案确定后再报告结果的原因。'] },
    ],
    formula: String.raw`D=D_{\mathrm{train}}\;\dot\cup\;D_{\mathrm{val}}\;\dot\cup\;D_{\mathrm{test}}`,
    formulaCaption: '这里的不交并表示样本分组互不重叠；真实评估还要防止关联内容泄露。', lab: 'machine-learning',
    labTask: '把训练比例从 50% 调到 80%，观察训练与验证点数并分别运行训练；随后换一个种子，再比较验证 MSE。记录你实际看到了什么，不把单次验证分数下降当成所有划分都更好的证据。',
    starter: `import random

def split_indices(n, train_fraction=0.75, seed=7):
    # TODO: 打乱索引，前 int(n*train_fraction) 个用于训练。
    return [], []

print(split_indices(12))
`,
    reference: `import random

def split_indices(n, train_fraction=0.75, seed=7):
    if n < 2 or not 0 < train_fraction < 1:
        raise ValueError("需要至少两个样本和有效比例")
    count = int(n * train_fraction)
    if count == 0 or count == n:
        raise ValueError("两组都必须非空")
    indices = list(range(n))
    random.Random(seed).shuffle(indices)
    return indices[:count], indices[count:]

print(split_indices(12))
`,
    codeExplanation: '局部 random.Random(seed) 让划分可复现，同时不修改全局随机状态。切片前先打乱索引，不改变原数据本身。划分得到索引后，同一组索引必须同时应用于输入和标签，避免配对关系被破坏。',
    pythonTests: `a, b = split_indices(20, 0.6, 9)
assert len(a) == 12 and len(b) == 8
assert not (set(a) & set(b)), "训练与验证不能重叠"
assert sorted(a + b) == list(range(20)), "每个样本恰好出现一次"
assert split_indices(20, 0.6, 9) == (a, b), "同种子要可复现"
assert split_indices(20, 0.6, 10) != (a, b)
before = random.getstate()
split_indices(10)
assert random.getstate() == before, "局部划分不干扰全局随机状态"
`,
    misconceptions: ['随机种子固定只保证可复现，不保证划分一定公平或没有泄露。', '验证集用于挑方案，因此最终测试集仍有独立价值。', '不同文件名或不同索引不代表内容独立，近重复样本也会泄露。'],
    exercise: '实现划分函数并检查无重叠、完整覆盖和可复现性。再为“同一用户多次访问”和“按天记录的销量”各提出一种划分方案，说明随机逐行划分在哪一步可能高估效果。',
    quiz: { question: '标准化时，均值和标准差应该从哪里估计？', options: ['全部数据，保证最准确', '仅训练集，然后应用到其他集合', '每个验证样本单独估计', '测试集，因为它最重要'], correct: 1, hint: '预处理也会从数据学习信息。考虑部署时哪些数据可以提前参与拟合。', explanation: '只用训练集拟合预处理统计量，然后应用到验证和测试。用全体数据会让原本独立的评估样本参与方案构建，造成信息泄露。' },
    references: [learningSource, { title: 'Scikit-learn · Common pitfalls and recommended practices', url: 'https://scikit-learn.org/stable/common_pitfalls.html', note: '数据泄露及只在训练集拟合预处理的具体例子；本课代码不依赖该库。' }],
  },
  {
    id: 'parameters', number: '26', title: '参数与超参数', english: 'What training changes',
    subtitle: '把模型内部的数字，与学习过程的控制旋钮分清楚。', prerequisites: ['linear', 'rules-vs-learning'],
    goals: ['识别直线模型中的参数', '区分学习率、模型复杂度和学习到的权重', '说明验证集如何参与超参数选择'],
    problem: '训练界面常同时出现权重、偏置、学习率、轮数和多项式次数。它们都是数字，却扮演不同角色。如果把它们混为一谈，就难以解释为什么调大一个值会改变预测，而调大另一个值只是改变训练路径。',
    intuition: [
      { title: '模型参数决定当前输出', paragraphs: ['在 y=wx+b 中，w 和 b 是模型参数。给定 x，只要改变任意一个，当前预测就可能立即变化。实验中拖动权重与偏置，直线和两组损失立刻重算，这展示的是参数对函数本身的影响。', '训练不是给每个样本单独选择一条直线，而是找到一组共享的 w、b，供所有训练样本和未来输入使用。参数共享既限制了表达能力，也让模型能够从少量样本归纳规律。'] },
      { title: '超参数约束如何寻找模型', paragraphs: ['学习率 η 决定每次沿梯度方向走多远；训练轮数决定走多少次；多项式次数决定允许的函数族。这些通常由开发者或外层搜索过程设定，不能靠同一个基础梯度更新自动当作权重学习。', '固定当前 w、b，只拖动学习率，当前预测应保持不变。按下训练后，两种学习率才表现出不同轨迹。用验证集挑选学习率，再用训练集重新拟合，是一种常见但需要记录的实验流程。'] },
    ],
    math: [
      { title: '用符号区分模型和算法', paragraphs: ['θ 表示参数，λ 表示超参数配置。学习算法 A 使用训练数据和配置产生参数。预测时主要使用训练好的 θ；学习率不会在普通线性模型的前向计算中再次出现。', '这只是当前工作流的分类。例如某些元学习算法也会学习学习率，但那是外层算法明确增加的学习对象，不能据此把所有数字的角色混淆。'], formula: String.raw`\theta=(w,b),\qquad\lambda=(\eta,T,d),\qquad\theta^{\ast}=A(D_{\mathrm{train}};\lambda)` },
      { title: '同一损失，不同更新幅度', paragraphs: ['梯度 g 描述当前损失对参数的局部变化率。乘以学习率再取负方向，就是一次参数变化。参数和梯度同维，学习率在本节是一个正标量。', '如果学习率为零，参数不变；太大则可能跳过低损失区域甚至发散。它并不是“越大训练越好”的速度档位。'], formula: String.raw`\theta_{t+1}=\theta_t-\eta\,\nabla_{\theta}L(\theta_t)` },
    ],
    deep: [
      { title: '初始化也属于实验配置', paragraphs: ['初始参数影响训练从哪里出发；种子让随机初始化和数据顺序可复现。凸的线性回归比较容易收敛到同一个最优区域，神经网络则可能对起点更加敏感。报告学习率却不说明初始化、划分和轮数，会让复现变困难。'] },
      { title: '参数越多不是自动越好', paragraphs: ['次数为 d 的一元多项式有 d+1 个系数。增加次数扩大可表达函数的集合，通常可以把训练误差压低，但也可能把噪声当作规律。模型容量是一项超参数决策，其结果必须通过独立验证而不是仅靠训练拟合判断。'] },
    ],
    formula: String.raw`\underbrace{f_{w,b}(x)=wx+b}_{\text{prediction}}\qquad\underbrace{(w,b)\leftarrow(w,b)-\eta(g_w,g_b)}_{\text{learning}}`,
    formulaCaption: '参数进入预测式；学习率进入更新式。', lab: 'machine-learning',
    labTask: '把 w、b 分别调节，观察当前预测立即变化。重置后只改变学习率，确认当前损失不变；再用单步训练比较参数变化。最后记录初始化、学习率、划分种子三项信息，使别人能够复现实验。',
    starter: `def update(parameters, gradients, learning_rate):
    # TODO: 创建新字典，对每个参数执行一次梯度下降。
    return None

print(update({"w": 1.0, "b": 0.0}, {"w": 2.0, "b": -1.0}, 0.1))
`,
    reference: `def update(parameters, gradients, learning_rate):
    if learning_rate < 0 or set(parameters) != set(gradients):
        raise ValueError("参数键必须匹配且学习率非负")
    return {name: value - learning_rate * gradients[name] for name, value in parameters.items()}

print(update({"w": 1.0, "b": 0.0}, {"w": 2.0, "b": -1.0}, 0.1))
`,
    codeExplanation: '字典把参数名称和数值配对，更新返回新字典，因此旧参数可用于对比或计算同一时刻的其他梯度。学习率是额外的控制参数，不作为模型权重被函数修改。零学习率提供一个很有用的边界检查。',
    pythonTests: `p = {"w": 1.0, "b": 0.0}
r = update(p, {"w": 2.0, "b": -1.0}, 0.1)
assert isinstance(r, dict) and set(r) == {"w", "b"}, "更新必须返回包含全部参数的新字典"
assert abs(r["w"] - 0.8) < 1e-12 and abs(r["b"] - 0.1) < 1e-12
assert p == {"w": 1.0, "b": 0.0}, "不要修改输入参数"
assert update(p, {"w": 9.0, "b": -3.0}, 0) == p
assert update({"a": -2}, {"a": -4}, 0.5) == {"a": 0}
`,
    misconceptions: ['学习率与权重都可以调，但它们不进入同一条计算公式。', '基础训练循环通常更新模型参数，超参数由外层实验选择。', '更大的学习率可能让损失上升，训练轮数更多也不保证验证结果更好。'],
    exercise: '实现独立的参数更新函数，用负梯度、零学习率和不修改原字典三种测试检查。手算一次 w=1、梯度=−3、学习率=0.2 的更新，并解释为什么更新后的权重增加。',
    quiz: { question: '只把学习率从 0.01 改为 0.1，尚未执行训练，线性模型当前预测如何变化？', options: ['一定变成十倍', '一定更准确', '不变，因为 w、b 未变', '全部变成零'], correct: 2, hint: '将预测公式和参数更新公式分别写出来，检查学习率出现在哪一边。', explanation: '普通线性前向预测只读取 x、w、b。学习率只影响后续更新的步长，所以尚未训练时当前预测保持不变。' },
    references: [regressionSource, { title: 'Google ML Crash Course · Hyperparameters', url: 'https://developers.google.com/machine-learning/crash-course/linear-regression/hyperparameters', note: '学习率、批大小和训练轮数的作用。' }],
  },
  {
    id: 'linear-regression', number: '27', title: '从零实现线性回归', english: 'Fit a line from observations',
    subtitle: '先把预测、残差与一条最佳拟合直线计算清楚。', prerequisites: ['datasets', 'parameters', 'dot-product'],
    goals: ['计算批量线性预测与残差', '使用闭式解求一元最小二乘直线', '识别恒定输入和外推的限制'],
    problem: '给定多个带噪声的输入输出点，我们希望得到一条能概括整体趋势的直线。两点可以确定一条直线，但很多点通常不在同一直线上。线性回归用“总平方误差尽量小”把这个矛盾变成一个明确、可计算的问题。',
    intuition: [
      { title: '预测线与真实点之间的距离', paragraphs: ['对每个输入 x，模型给出 ŷ=wx+b。数据点和预测线在相同横坐标处的纵向差，是预测残差。普通最小二乘关注纵向预测误差，并不是到直线的最短垂直几何距离。', '实验显示训练点、验证点和当前直线。先手调 w、b，再点击最小二乘拟合；按钮只读取训练点。即使训练误差最小，验证点仍可能离直线很远，因为有噪声和抽样差异。'] },
      { title: '把坐标中心移到平均位置', paragraphs: ['一元最小二乘直线在带截距时经过训练数据的平均点。先看输入和目标分别偏离各自均值多少，再比较这些偏离是否同向，便能确定斜率。', '如果所有 x 都相同，数据没有提供“改变 x 时 y 怎么变”的证据。此时斜率不能从样本唯一确定。参考实现选择报告错误，而不是用除以零或任意巨大权重伪装成成功。'] },
    ],
    math: [
      { title: '从点积到一维仿射预测', paragraphs: ['多特征模型的预测是权重与输入的点积再加偏置。本课是一维版本，因此只剩一个乘积。批量预测对每个输入使用同一组参数，不把样本数当作特征维数。', '在公式中，ŷᵢ 是预测，yᵢ 是观测目标，两者不能交换角色后继续解释残差的方向。'], formula: String.raw`\hat y_i=\mathbf w^{\mathsf T}\mathbf x_i+b\quad\text{(one feature: }\hat y_i=wx_i+b\text{)},\qquad e_i=\hat y_i-y_i` },
      { title: '一元最小二乘的闭式解', paragraphs: ['把平方误差分别对 w、b 求导并令其为零，可以得到下面的解。分母是输入离均值的平方和；当它大于零时，w 和 b 的最小二乘解唯一。', '闭式解不需要学习率，它直接利用整批统计量求解。之后的梯度训练应当逐渐靠近同一个解，因此它也是检验训练代码的参照。'], formula: String.raw`w^{\ast}=\frac{\sum_i(x_i-\bar x)(y_i-\bar y)}{\sum_i(x_i-\bar x)^2},\qquad b^{\ast}=\bar y-w^{\ast}\bar x` },
    ],
    deep: [
      { title: '线性指对参数的关系', paragraphs: ['模型 y=c₀+c₁x+c₂x² 虽然对 x 画出曲线，但对系数仍是线性的，因此也可以做线性最小二乘。我们将在泛化实验用多项式基函数控制容量；“线性模型”不总等于屏幕上的一条直线。'] },
      { title: '相关不是因果', paragraphs: ['回归可以从面积预测租金，却不能仅凭相关数据推断“强行增加一平方米一定导致多少租金增长”。地区等隐藏因素可能同时影响面积和租金。拟合质量描述预测关系，干预效果则需要额外的因果假设或实验设计。'] },
    ],
    formula: String.raw`(w^{\ast},b^{\ast})=\underset{w,b}{\operatorname{argmin}}\sum_i(wx_i+b-y_i)^2`,
    formulaCaption: '在同一横坐标比较预测和目标，求使纵向平方残差最小的参数。', lab: 'machine-learning',
    labTask: '先手调直线使训练误差尽量小，记录 w、b 和 MSE，再点击“最小二乘拟合”比较。换种子后观察参数是否仍精确等于生成数据的真实参数，解释噪声和有限样本的影响。',
    starter: `def fit_line(data):
    # TODO: 计算 x、y 均值以及中心化平方和，返回 (w, b)。
    return None

print(fit_line([(-1, -1), (0, 1), (1, 3)]))
`,
    reference: `def fit_line(data):
    if len(data) < 2:
        raise ValueError("至少需要两个点")
    mx = sum(x for x, y in data) / len(data)
    my = sum(y for x, y in data) / len(data)
    denominator = sum((x - mx) ** 2 for x, y in data)
    if denominator == 0:
        raise ValueError("输入恒定，斜率无法唯一确定")
    w = sum((x - mx) * (y - my) for x, y in data) / denominator
    return w, my - w * mx

print(fit_line([(-1, -1), (0, 1), (1, 3)]))
`,
    codeExplanation: '先减均值再计算交叉乘积，可以直接对应推导中的中心化公式。返回的 b 使直线经过平均点。测试使用精确直线与带噪声的小例子，并显式检查恒定输入，避免只验证一个理想案例。',
    pythonTests: `result = fit_line([(-2, -3), (0, 1), (3, 7)])
assert isinstance(result, tuple) and len(result) == 2, "拟合必须返回 (w, b) 参数对"
w, b = result
assert abs(w - 2) < 1e-10 and abs(b - 1) < 1e-10
w, b = fit_line([(0, 1), (1, 2), (2, 2)])
assert abs(w - 0.5) < 1e-10 and abs(b - 7/6) < 1e-10
w, b = fit_line([(-1, 4), (0, 4), (2, 4)])
assert w == 0 and b == 4
try:
    fit_line([(1, 2), (1, 4)])
except ValueError:
    pass
else:
    raise AssertionError("恒定输入不能唯一决定斜率")
`,
    misconceptions: ['最小二乘最小化纵向残差，并非数据点到直线的最短距离。', '有噪声的有限样本通常不会精确恢复生成参数。', '得到好的拟合直线不等于证明输入对输出存在因果作用。'],
    exercise: '实现闭式解，手算数据 (0,1)、(1,2)、(2,2) 的均值、分母与斜率。再把所有 y 同时加 3，验证斜率不变而截距增加 3，并说明这一结果的几何含义。',
    quiz: { question: '所有训练输入 x 都相同，最小二乘公式的分母会怎样？', options: ['等于样本数', '等于 1', '等于 0，无法唯一确定斜率', '自动取负数'], correct: 2, hint: '每个 x 都等于其均值时，逐个检查 (x−均值)² 的值。', explanation: '所有中心化输入都为零，平方和也是零。数据只约束该横坐标处的预测，无法区分通过相同预测点的不同斜率。' },
    references: [regressionSource, learningSource],
  },
  {
    id: 'loss-functions', number: '28', title: '损失函数与均方误差', english: 'Turn mistakes into a scalar',
    subtitle: '用一个数字比较整批预测，同时看清这个数字忽略了什么。', prerequisites: ['linear-regression', 'expectation'],
    goals: ['独立计算 MSE 与 RMSE', '解释平方、平均和残差符号各自的作用', '用异常值比较 MSE 与 MAE 的敏感性'],
    problem: '一条直线可能在第一个样本上更好，另一条却在第二个样本上更好。训练算法需要一个统一标准比较整批预测。损失函数把多次错误汇总为标量，但汇总方法会改变模型重视哪些错误，因此不能不加思考地把“分数低”当作一切。',
    intuition: [
      { title: '先平方，避免正负抵消', paragraphs: ['预测比目标高 2 和低 2 都是错误。如果直接求平均残差，它们会抵消成零。平方让两种方向都产生正惩罚，并且把误差 4 的惩罚变成误差 2 的四倍。', '实验用竖线连接预测与样本。拖动参数，观察单个残差、其平方与整体平均之间的关系。训练 MSE 只平均训练点，验证 MSE 只平均验证点，不能混在一起再称为验证。'] },
      { title: '平均解决规模比较，不解决单位问题', paragraphs: ['同样的误差模式复制两份，平方误差总和会翻倍，MSE 则保持不变，这让不同样本数的批次容易比较。不过不同数据集的分布和难度仍可能不同，平均本身并不能保证比较公平。', 'MSE 的单位是目标单位的平方；RMSE 取平方根恢复原单位。MAE 平均绝对误差，对极端残差的放大较弱。选择损失要联系任务里大错误的代价。'] },
    ],
    math: [
      { title: '从样本损失到经验均值', paragraphs: ['样本残差 eᵢ=ŷᵢ−yᵢ，平方损失为 eᵢ²。MSE 是这些平方的等权平均，是经验分布下的期望。某些教材加 1/2 方便求导，那会缩放梯度，但不改变最优参数的位置。', '若需要样本权重，则要明确权重如何归一化。这里每个样本权重相同，不把类别数或特征数误当作除数。'], formula: String.raw`\operatorname{MSE}=\frac1n\sum_{i=1}^{n}(\hat y_i-y_i)^2,\qquad\operatorname{RMSE}=\sqrt{\operatorname{MSE}}` },
      { title: '平方为何让异常值影响大', paragraphs: ['对预测值求导时，平方损失的导数是残差的两倍。所以极端残差不仅在报表上占比更大，也会更强地推动参数更新。一个标签录入错误就可能把整条回归线拉偏。', 'MAE 对非零残差的导数大小是 1，方向随符号改变；零点不可微时可以用次梯度。损失的数学形状决定了训练对错误的响应。'], formula: String.raw`\frac{\partial e_i^2}{\partial\hat y_i}=2(\hat y_i-y_i),\qquad\operatorname{MAE}=\frac1n\sum_i|\hat y_i-y_i|` },
    ],
    deep: [
      { title: '平均分可能遮住局部失败', paragraphs: ['总体 MSE 低，仍可能在少数群体、边缘输入或罕见场景上很差。除了总体平均，也应查看残差图、误差分位数和有业务意义的子组。单个汇总指标方便优化，却不能代替错误分析。'] },
      { title: '损失隐含了统计假设', paragraphs: ['在独立同方差高斯噪声假设下，最小化 MSE 对应最大化观测数据的似然。如果噪声尺度随输入改变、标签包含极端异常值或任务关注中位数，其他损失可能更合适。这里的假设是解释工具，并不是使用 MSE 时自动成立的事实。'] },
    ],
    formula: String.raw`\frac{(-2)+2}{2}=0\quad\text{but}\quad\frac{(-2)^2+2^2}{2}=4`,
    formulaCaption: '平均残差为零仍可能预测很差；平方误差不会因正负抵消。', lab: 'machine-learning',
    labTask: '先把参数设为 w=0、b=0，选择一个训练点手算残差及平方，再与图中指标比较。逐步增大噪声，观察 MSE 与 MAE 哪一个受大残差影响更明显。不要在有不同标签的数据之间只根据分数大小判断模型优劣。',
    starter: `import math

def losses(predictions, targets):
    # TODO: 返回 {"mse": ..., "rmse": ..., "mae": ...}。
    return None

print(losses([1, 5], [3, 3]))
`,
    reference: `import math

def losses(predictions, targets):
    if len(predictions) != len(targets) or not targets:
        raise ValueError("需要非空且等长的预测和目标")
    errors = [p - y for p, y in zip(predictions, targets)]
    mse = sum(e * e for e in errors) / len(errors)
    return {"mse": mse, "rmse": math.sqrt(mse), "mae": sum(abs(e) for e in errors) / len(errors)}

print(losses([1, 5], [3, 3]))
`,
    codeExplanation: '同一份残差列表用于三个指标，避免正负方向或分母不一致。检查非空与等长后再使用 zip，因为 zip 本身会静默忽略较长列表的末尾。RMSE 在平均之后开方，不是把每个平方开方再平均。',
    pythonTests: `a = losses([1, 5], [3, 3])
assert a == {"mse": 4.0, "rmse": 2.0, "mae": 2.0}
b = losses([0, 0, 6], [0, 0, 0])
assert b["mse"] == 12 and b["mae"] == 2
assert abs(b["rmse"] - math.sqrt(12)) < 1e-12
assert losses([2, 4, 2, 4], [1, 2, 1, 2]) == losses([2, 4], [1, 2]), "复制样本不改变平均"
try:
    losses([1, 2], [1])
except ValueError:
    pass
else:
    raise AssertionError("必须检查长度")
`,
    misconceptions: ['平均残差等于零不等于 MSE 等于零，正负错误可能抵消。', 'RMSE 是先平均平方再开方，不等于 MAE。', '训练 MSE 更低只说明训练拟合更好，不能直接说明泛化更好。'],
    exercise: '手算残差为 [0,0,6] 时的 MSE、RMSE、MAE 并实现函数。再把 6 改成 12，比较三个指标增加的倍数，解释平方损失为什么需要格外注意异常标签。',
    quiz: { question: '把整份数据原样复制一次且预测也复制，MSE 如何变化？', options: ['翻倍', '减半', '保持不变', '一定变成零'], correct: 2, hint: '同时检查平方误差总和与作为分母的样本数量怎样变化。', explanation: '复制使平方误差总和与样本数同时翻倍，二者的比值不变。MSE 是平均损失，不是平方误差的总和。' },
    references: [regressionSource, { title: 'Scikit-learn · Regression metrics', url: 'https://scikit-learn.org/stable/modules/model_evaluation.html#regression-metrics', note: 'MSE、RMSE 与 MAE 的定义和适用背景；实现仅使用标准库。' }],
  },
  {
    id: 'training-regression', number: '29', title: '手写梯度下降训练循环', english: 'A complete training loop',
    subtitle: '预测、计算误差、求梯度、同时更新，再重复。', prerequisites: ['loss-functions', 'gradient-descent'],
    goals: ['推导 w 与 b 的 MSE 梯度', '实现使用旧参数同时更新的训练循环', '用损失与有限差分检查训练是否正确'],
    problem: '知道什么参数更好，还需要一种可执行的方法逐渐到达它。线性回归的闭式解很方便，但大型神经网络通常没有这种一步求解方式。亲手写一个只含两个参数的训练循环，可以把后续所有训练流程的基本结构完整看见。',
    intuition: [
      { title: '每轮先看同一时刻的模型', paragraphs: ['一轮先用当前 w、b 计算所有预测，然后计算平均损失和两个梯度，最后一起更新。不能先更新 w，再用新 w 求 b 的梯度，否则两个分量不再来自同一个参数点。', '实验的“单步训练”严格执行这个流程，并记录训练与验证损失。验证点只用于观察，绝不进入梯度。你可以比较一次更新的参数变化与手算结果。'] },
      { title: '训练曲线是一种诊断记录', paragraphs: ['适中的学习率通常让这个凸二次目标逐渐下降；过大的学习率会震荡或发散。实验允许你从相同初始值比较不同学习率，观察真实算出的曲线，而不是预先绘制的示意图。', '停止条件可以是达到轮数、梯度很小或验证损失不再改善。梯度接近零表示当前参数附近对小变化不敏感，并不自动代表模型能解决所有真实问题。'] },
    ],
    math: [
      { title: '将链式法则应用到每个样本', paragraphs: ['残差为 wxᵢ+b−yᵢ。平方对残差的导数是 2eᵢ，残差对 w 的导数是 xᵢ，对 b 的导数是 1。把每个样本贡献加起来并除以样本数，得到整批梯度。', '这里没有在损失前放 1/2，因此梯度包含系数 2。损失定义与梯度实现必须配套。'], formula: String.raw`g_w=\frac2n\sum_i(wx_i+b-y_i)x_i,\qquad g_b=\frac2n\sum_i(wx_i+b-y_i)` },
      { title: '同时更新与有限差分检查', paragraphs: ['使用同一个旧状态计算 g_w、g_b，再对两个参数执行减去学习率乘梯度。中心有限差分可以独立近似某一维导数，用于发现符号、平均或乘输入的错误。', '差分步长不是越小越好，太小会受浮点消减影响。本课取 10⁻⁶，并在普通尺度的小数据上检查。'], formula: String.raw`\begin{aligned}w'&=w-\eta g_w,&b'&=b-\eta g_b,\\\partial_wL&\approx\frac{L(w+h,b)-L(w-h,b)}{2h}.\end{aligned}` },
    ],
    deep: [
      { title: '数据尺度决定稳定步长', paragraphs: ['当输入扩大一百倍，w 梯度里还要乘输入，目标的曲率会大幅增加，原来安全的学习率可能立刻发散。特征标准化不只影响显示单位，也影响优化条件。它的均值与尺度仍必须只从训练数据估计。'] },
      { title: '批量、随机与小批量', paragraphs: ['本课每一步读取全部训练点，称为全批量梯度下降。随机梯度一次读取一个样本，小批量读取一组样本，它们用有噪声的估计换取每步更低成本。总训练轮数、更新步数和看到的样本数因此不是同一个概念。'] },
    ],
    formula: String.raw`\boxed{\text{predict}\to\text{loss}\to\text{gradient}\to\text{update}\to\text{repeat}}`,
    formulaCaption: '完整训练循环的每一步都可以单独测试。', lab: 'machine-learning',
    labTask: '重置后令学习率为 0.1，执行一步并记录 w、b、训练损失和验证损失；再运行 60 步。把学习率改为 1.5 重做，说明曲线反映的现象。最后用最小二乘参数检查收敛位置是否接近。',
    starter: `def train(data, w=0.0, b=0.0, lr=0.1, steps=200):
    # TODO: 每轮用同一组旧参数计算两个平均梯度，然后同时更新。
    return w, b

print(train([(-1, -1), (0, 1), (1, 3)]))
`,
    reference: `def train(data, w=0.0, b=0.0, lr=0.1, steps=200):
    if not data or lr < 0 or steps < 0:
        raise ValueError("检查数据、学习率与步数")
    for _ in range(steps):
        errors = [(w * x + b - y, x) for x, y in data]
        gw = 2 * sum(e * x for e, x in errors) / len(data)
        gb = 2 * sum(e for e, x in errors) / len(data)
        w, b = w - lr * gw, b - lr * gb
    return w, b

print(train([(-1, -1), (0, 1), (1, 3)]))
`,
    codeExplanation: 'errors 保存当前状态下每个残差及输入，再计算两个平均梯度。Python 的元组赋值先计算右边所有表达式，因此 w、b 同时由旧值更新。函数既支持训练，也支持零步和零学习率等可核对边界。',
    pythonTests: `data = [(-1, -1), (0, 1), (1, 3)]
w, b = train(data, steps=1)
assert abs(w - 4/15) < 1e-12 and abs(b - 0.2) < 1e-12, "检查 2/n 和同时更新"
w, b = train(data)
assert abs(w - 2) < 1e-8 and abs(b - 1) < 1e-8
assert train(data, 3, -2, steps=0) == (3, -2)
assert train(data, 3, -2, lr=0, steps=10) == (3, -2)
negative = [(-1, 3), (0, 1), (1, -1)]
w, b = train(negative)
assert abs(w + 2) < 1e-8 and abs(b - 1) < 1e-8
`,
    misconceptions: ['梯度下降减去梯度，不是直接把参数设成梯度。', '计算 b 梯度时不乘 x；计算 w 梯度时需要乘对应输入。', '训练损失下降不保证验证损失逐步下降，更不能保证部署效果。'],
    exercise: '实现 train，通过单步数值和最终参数两类检查。手算第一轮的残差及两个梯度；然后改变学习率为 0，解释为什么即使重复很多次也完全没有学习。用闭式解作独立参照。',
    quiz: { question: '为什么应先求出 g_w 和 g_b，再同时更新两个参数？', options: ['为了避免导入数学库', '保证两个梯度来自同一个旧参数点', '让每轮样本数翻倍', '使验证集自动进入训练'], correct: 1, hint: '梯度是损失函数在某一个位置的向量，考虑其分量应对应什么状态。', explanation: '同一个梯度向量的各分量必须在同一组参数处计算。提前更新某个参数再求另一梯度，会改变原本规定的全批量梯度下降步骤。' },
    references: [regressionSource, { title: 'Dive into Deep Learning · Optimization Algorithms', url: 'https://d2l.ai/chapter_optimization/index.html', note: '批量与随机梯度下降、学习率和优化条件的进一步说明。' }],
  },
  {
    id: 'generalization', number: '30', title: '泛化、欠拟合与过拟合', english: 'Fit the pattern, measure the gap',
    subtitle: '训练分数继续提高时，模型在新样本上可能已经变差。', prerequisites: ['training-regression', 'datasets'],
    goals: ['区分欠拟合与过拟合的证据', '用多项式次数和噪声设计受控实验', '使用验证误差选容量并说明评估局限'],
    problem: '如果一条弯曲得很复杂的线穿过每个训练点，它是否比一条平滑曲线更好？答案取决于新数据，而非训练图上的贴合程度。泛化是从有限观察走向未见样本的能力；过拟合恰好发生在模型把样本里的偶然细节也当成规律时。',
    intuition: [
      { title: '复杂度不足与复杂度过度', paragraphs: ['实验数据由固定的二次趋势加噪声构成。一次多项式只有直线，可能无法表达真实弯曲，训练和验证误差都较高，这是欠拟合的一种证据。二次模型包含恰好合适的形状，但仍受噪声影响。', '高次模型能用更多系数贴近训练点，特别是样本很少时，曲线在点之间或边缘可能剧烈摆动。训练误差降低而验证误差变高，才是当前实验里过拟合的证据，不能只凭曲线弯曲就下结论。'] },
      { title: '每次只改变一个实验因素', paragraphs: ['先固定种子、训练比例和噪声，只改变次数；再固定次数改变训练比例；最后改变噪声。这样的对照能帮助解释差异来自哪里。若所有旋钮同时改变，分数虽然变化，却很难归因。', '实验每次用真实最小二乘求系数，训练与验证分数各自由当前预测计算。并非每个随机划分都呈现同样的 U 形曲线，因此应记录实际结果和不确定性。'] },
    ],
    math: [
      { title: '用基函数扩大模型族', paragraphs: ['次数 d 对应 d+1 个参数，包括常数项。把输入转换成 [1,x,…,xᵈ] 后，仍然是在这些特征上做线性最小二乘。原输入已限制在 −1 到 1，能缓解高次幂尺度过大的问题。', '当训练点少于参数数目时，解可能不唯一；接近共线时也会不稳定。实验使用 QR 正交化求最小二乘，并保持训练样本数大于可选次数，避免把求解器失败误认成学习规律。'], formula: String.raw`f_{\mathbf c}(x)=\sum_{j=0}^{d}c_jx^j,\qquad\phi(x)=(1,x,\ldots,x^d)` },
      { title: '泛化差距不是全部表现', paragraphs: ['训练误差和验证误差的差称为一种经验泛化差距。差距小但两个误差都高，仍可能欠拟合；差距大且验证误差高，提示过拟合或分布差异。还需要同时看绝对误差大小。', '验证分数选出的次数属于实验结果，最终报告最好在未用于选次数的测试集上进行。实验只有训练与验证两组，提供的是学习演示而非最终测试结论。'], formula: String.raw`\widehat\Delta=\widehat R_{\mathrm{val}}-\widehat R_{\mathrm{train}},\qquad d^{\ast}\in\underset{d}{\operatorname{argmin}}\;\widehat R_{\mathrm{val}}(\mathbf c_d)` },
    ],
    deep: [
      { title: '更多数据与正则化', paragraphs: ['增加有代表性的训练样本，往往能让模型更容易区分趋势和噪声。正则化则对参数或函数复杂度施加约束，使模型不必用全部自由度贴合每个训练点。它们都可能改善泛化，但效果需要用相同评估流程验证。'] },
      { title: '分布改变是另一种问题', paragraphs: ['训练在小房屋、部署在大房屋，即使模型在随机验证集表现很好，也可能无法外推。过拟合讨论通常默认评估分布接近训练来源；分布变化会破坏这个前提，需要按真实部署场景构造验证集，而非只增加训练轮数。'] },
    ],
    formula: String.raw`\text{small training error}\;\not\Rightarrow\;\text{small unseen-data error}`,
    formulaCaption: '拟合与推广是两个需要分别检验的问题。', lab: 'machine-learning',
    labTask: '固定种子为 7、训练比例为 50%、噪声为 0.4，依次拟合 1、2、5、9 次模型并记录两组 MSE。再把噪声调为 0 重做，比较高容量在有噪声与无噪声条件下的实际表现。用验证分数选次数并说明还缺少哪一组最终评估数据。',
    starter: `def select_degree(results):
    # results: [(次数, 训练MSE, 验证MSE), ...]
    # TODO: 按验证 MSE 选次数，并列时选择次数较小者。
    return None

print(select_degree([(1, 0.8, 0.9), (2, 0.1, 0.2), (9, 0.0, 2.0)]))
`,
    reference: `def select_degree(results):
    if not results:
        raise ValueError("需要实验记录")
    return min(results, key=lambda row: (row[2], row[0]))[0]

print(select_degree([(1, 0.8, 0.9), (2, 0.1, 0.2), (9, 0.0, 2.0)]))
`,
    codeExplanation: '函数读取实验记录而不是重新训练，用于检验你是否真的按验证误差选方案。排序关键字先比较验证 MSE，再用较低次数打破平局；训练误差被保留用于诊断，却不是选最优次数的依据。',
    pythonTests: `assert select_degree([(1, 0.8, 0.9), (2, 0.1, 0.2), (9, 0.0, 2.0)]) == 2
assert select_degree([(8, 0.0, 0.3), (2, 0.2, 0.3)]) == 2, "同分选更简单模型"
assert select_degree([(1, 0.01, 5), (3, 0.2, 0.5)]) == 3, "不能只看训练误差"
assert select_degree([(4, 1, 2)]) == 4
try:
    select_degree([])
except ValueError:
    pass
else:
    raise AssertionError("空记录必须拒绝")
`,
    misconceptions: ['训练与验证都很差可能是欠拟合，不能仅看二者差距小就宣布成功。', '高次曲线不必然过拟合，要看独立样本上的证据。', '验证集挑过模型以后，就不能再当成完全未参与选择的最终测试集。'],
    exercise: '填写至少四个次数的实验表，实现依据验证误差选次数的函数。解释为什么训练 MSE 为 0 的 9 次模型可能输给训练 MSE 为 0.1 的 2 次模型；再提出一种避免验证分数被过度使用的做法。',
    quiz: { question: '哪个结果最直接提示当前模型在这份划分中过拟合？', options: ['训练与验证误差都很高', '训练误差很低而验证误差明显更高', '训练与验证误差都低', '模型有两个参数'], correct: 1, hint: '过拟合强调对已见样本拟合很好，却没有把这种表现推广到独立样本。', explanation: '很低的训练误差配上明显更高的验证误差，是过拟合的典型证据。两组误差都高更可能提示模型容量、特征或训练不足。' },
    references: [learningSource, { title: 'Dive into Deep Learning · Generalization', url: 'https://d2l.ai/chapter_linear-classification/generalization-classification.html', note: '训练误差、泛化误差与模型复杂度。' }],
  },
  {
    id: 'classification', number: '31', title: '分类任务与决策边界', english: 'Scores become decisions',
    subtitle: '预测一个类别，还需要说明分数、阈值和错误代价。', prerequisites: ['generalization'],
    goals: ['区分连续分数、概率与离散类别', '从阈值推导一维决策边界', '计算混淆矩阵、准确率、精确率与召回率'],
    problem: '预测一封邮件是否为垃圾邮件，与预测房价不同：最终动作只有几个类别。模型通常先产生连续分数，再按阈值做决定。调整阈值会改变漏报与误报，所以同一个模型不只有一种使用方式，准确率也无法表达所有决策后果。',
    intuition: [
      { title: '先打分，再做动作', paragraphs: ['假设模型给出属于正类的概率 p，阈值 τ=0.5 表示 p≥τ 时预测正类。提高阈值通常会减少预测为正类的样本，可能减少误报，也可能漏掉更多真正的正例。', '实验中的点标记真实标签，曲线表示模型概率，竖线是决策边界。改变阈值不更新权重，概率曲线不变，但混淆矩阵与预测标签会立即重算。'] },
      { title: '把错误分成四种计数', paragraphs: ['真正例 TP 是真实正类且预测正类；假正例 FP 是真实负类却预测正类；假负例 FN 是真实正类却预测负类；真负例 TN 则两者都负。不同应用对 FP 和 FN 的代价不同。', '当正类很少时，永远预测负类也可能获得很高准确率。精确率关注报出的正类里有多少是真的，召回率关注真正正类里找到了多少。分母为空时需要明确约定，本课返回 0。'] },
    ],
    math: [
      { title: '分数边界与输入边界', paragraphs: ['若 p=σ(wx+b)，则 p≥τ 等价于 wx+b≥log(τ/(1−τ))。当 w>0 时可解出 x 的下界；w<0 时不等号方向反转。w=0 时所有输入概率相同，可能没有有限边界。', '下一课会推导 Sigmoid 与交叉熵。本课先关注给定概率之后，阈值如何变成可解释的决策。'], formula: String.raw`\hat y=\mathbf1[p\ge\tau],\qquad x_{\mathrm{boundary}}=\frac{\log\frac{\tau}{1-\tau}-b}{w}\quad(w\ne0)` },
      { title: '三个指标回答不同问题', paragraphs: ['准确率统计所有判断中正确的比例；精确率只看预测为正的部分；召回率只看真实正类的部分。它们不等价，阈值移动时常会出现取舍。', '计数必须来自独立评估数据，并且类别方向保持一致。把“垃圾邮件”从正类改为负类后，精确率与召回率的含义也会改变。'], formula: String.raw`\mathrm{accuracy}=\frac{TP+TN}{n},\qquad\mathrm{precision}=\frac{TP}{TP+FP},\qquad\mathrm{recall}=\frac{TP}{TP+FN}` },
    ],
    deep: [
      { title: '分类边界不等于理解概念', paragraphs: ['模型找到一条能分开样本的边界，不代表它掌握了人类对垃圾邮件或疾病的定义。它可能利用数据中偶然的快捷特征。应查看错误案例和跨来源表现，并避免把图上可分的玩具数据当作真实任务难度的缩影。'] },
      { title: '阈值是一项部署决策', paragraphs: ['医疗筛查可能优先避免漏诊，人工审核队列则可能受到处理容量约束。阈值应结合错误成本、数据分布和后续流程选择。若部署时正类比例发生变化，过去的精确率可能改变，即使模型分数机制本身没有变化。'] },
    ],
    formula: String.raw`\text{score}\longrightarrow\text{threshold}\longrightarrow\text{class decision}`,
    formulaCaption: '训练分数与部署决策是相连但不同的步骤。', lab: 'machine-learning',
    labTask: '先训练逻辑模型，再把阈值从 0.2 移到 0.8。确认概率曲线保持不变，记录验证 TP、FP、FN、TN 和召回率的变化。再令 w=0，观察没有有限边界时页面如何解释，并说明为什么这不是除法故障。',
    starter: `def classification_report(probabilities, labels, threshold=0.5):
    # TODO: 统计 tp、fp、fn、tn，并计算 accuracy、precision、recall。
    return None

print(classification_report([0.9, 0.7, 0.2, 0.1], [1, 0, 1, 0]))
`,
    reference: `def classification_report(probabilities, labels, threshold=0.5):
    if not labels or len(probabilities) != len(labels):
        raise ValueError("需要等长非空输入")
    tp = fp = fn = tn = 0
    for p, y in zip(probabilities, labels):
        predicted = p >= threshold
        if predicted and y == 1:
            tp += 1
        elif predicted:
            fp += 1
        elif y == 1:
            fn += 1
        else:
            tn += 1
    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn,
            "accuracy": (tp + tn) / len(labels),
            "precision": tp / (tp + fp) if tp + fp else 0.0,
            "recall": tp / (tp + fn) if tp + fn else 0.0}

print(classification_report([0.9, 0.7, 0.2, 0.1], [1, 0, 1, 0]))
`,
    codeExplanation: '每个样本恰好进入四个分支之一。先计数再计算指标，便于用手工混淆矩阵独立核对。>= 明确规定恰好等于阈值时属于正类；分母为零时返回 0 是本练习的显示约定，不代表真实信息充分。',
    pythonTests: `r = classification_report([0.9, 0.7, 0.2, 0.1], [1, 0, 1, 0])
assert isinstance(r, dict) and {"tp", "fp", "fn", "tn", "accuracy", "precision", "recall"} <= set(r), "返回完整的分类指标字典"
assert [r[k] for k in ("tp", "fp", "fn", "tn")] == [1, 1, 1, 1]
assert r["accuracy"] == r["precision"] == r["recall"] == 0.5
r = classification_report([0.5, 0.1], [1, 0])
assert r["tp"] == 1 and r["tn"] == 1, "边界采用大于等于"
r = classification_report([0.1, 0.2], [0, 0])
assert r["precision"] == 0 and r["recall"] == 0 and r["accuracy"] == 1
r = classification_report([0.9, 0.7, 0.2], [1, 0, 1], 0.8)
assert r["tp"] == 1 and r["fp"] == 0 and r["fn"] == 1
`,
    misconceptions: ['概率分数与最终类别不是同一对象，改变阈值不需要重新训练权重。', '高准确率可能来自多数类，必须结合类别比例和其他指标理解。', '提高阈值通常减少报出的正类，但不保证精确率在每份有限数据上严格单调上升。'],
    exercise: '实现报告函数，手算四个样本的混淆矩阵。设想正例仅占 1% 的场景，说明永远预测负类的准确率和召回率。最后给“自动删除邮件”与“送人工复核”提出不同阈值偏好并说明原因。',
    quiz: { question: '模型概率不变，只提高正类阈值，哪件事一定不会发生？', options: ['预测为正的样本数增加', '某些真正例变成假负例', '某些假正例变成真负例', '召回率下降'], correct: 0, hint: '高阈值的正类集合，是低阈值正类集合的子集。', explanation: '当规则固定为 p≥阈值，提高阈值只会移除或保留正类预测，不会新增正类。它可能减少误报，也可能漏掉原来找出的正例。' },
    references: [learningSource, { title: 'Google ML Crash Course · Classification metrics', url: 'https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall', note: '混淆矩阵、类别不平衡和精确率召回率的取舍。' }],
  },
  {
    id: 'logistic-regression', number: '32', title: '逻辑回归与二元交叉熵', english: 'Probabilities from linear scores',
    subtitle: '让线性分数进入 0 到 1，并用正确标签的对数概率训练。', prerequisites: ['classification', 'logarithms', 'derivatives'],
    goals: ['计算数值稳定的 Sigmoid', '从伯努利似然理解二元交叉熵', '使用 p−y 梯度训练逻辑回归'],
    problem: '直线输出可能小于 0 或大于 1，不能直接当成概率。逻辑回归先计算线性分数，再通过 Sigmoid 映射到概率，使用二元交叉熵评价预测。它名字里虽然有“回归”，这里却是一个二分类模型，并将成为理解神经网络分类输出层的基础。',
    intuition: [
      { title: '分数可以无限，概率有边界', paragraphs: ['分数 z=wx+b 可以是任意实数，Sigmoid 把它平滑压到 0 和 1 之间。z=0 对应 p=0.5；正分数更偏向正类，负分数更偏向负类。改变 w 控制过渡方向和陡峭程度，b 平移边界。', '概率表达的是模型在当前表示和参数下的数值判断，并不自动校准。若模型说 0.8，想把它解释为长期 80% 的正确频率，还需要用独立数据检查校准。'] },
      { title: '自信地错，代价很高', paragraphs: ['目标为 1 时，交叉熵只剩 −log(p)：把正确类概率从 0.5 提高到 0.9 会降低损失；把它压到接近 0 则产生很大惩罚。目标为 0 时，关注的是 1−p。', '实验既显示实际概率和阈值分类，也显示训练与验证 BCE。阈值只改变离散决定，不进入 BCE 或参数梯度；因此拖动阈值时，BCE 应保持不变。'] },
    ],
    math: [
      { title: '伯努利概率与负对数似然', paragraphs: ['对于标签 y∈{0,1}，概率可以统一写成 pʸ(1−p)¹⁻ʸ。对所有独立样本的概率相乘，再取负对数和平均，就得到二元交叉熵。对数把连乘改成求和，也把极小概率转成可处理的损失。', '实际计算最好从分数 z 直接使用稳定形式，避免浮点下 p 被舍入为 0 或 1 后计算 log(0)。下面第二个等式使用自然对数。'], formula: String.raw`p=\sigma(z)=\frac1{1+e^{-z}},\quad\ell(z,y)=-y\log p-(1-y)\log(1-p)=\max(z,0)-yz+\log(1+e^{-|z|})` },
      { title: '链式法则带来简单梯度', paragraphs: ['Sigmoid 的导数是 p(1−p)，与交叉熵对 p 的导数组合后，分数梯度简化为 p−y。再乘 z 对参数的导数，就得到与线性回归结构相似的更新。', '这里 BCE 没有平方损失里的系数 2。用错这一点会改变步长尺度；更严重的是把分类阈值后的 0/1 输出拿来求梯度，那会丢掉平滑概率信息。'], formula: String.raw`\frac{\partial\ell}{\partial z}=p-y,\qquad g_w=\frac1n\sum_i(p_i-y_i)x_i,\qquad g_b=\frac1n\sum_i(p_i-y_i)` },
    ],
    deep: [
      { title: '完全可分数据的特殊现象', paragraphs: ['若数据能够被直线完全分开且没有正则化，逻辑回归的权重可能持续增大，损失不断降低却没有有限的最大似然参数解。分类已经全对并不代表权重已经收敛。实际训练可以使用正则化、早停和独立验证。'] },
      { title: '稳定公式与框架损失', paragraphs: ['标准框架常提供接收 logits 的 BCE 函数，在内部合并 Sigmoid 与对数运算以提高数值稳定性。本课直接实现同一个稳定恒等式，并用 ±1000 的输入检验。数值稳定保证计算不崩溃，不会自动保证概率校准或任务适用性。'] },
    ],
    formula: String.raw`L=\frac1n\sum_i\left[\max(z_i,0)-y_i z_i+\log(1+e^{-|z_i|})\right]`,
    formulaCaption: '从线性分数直接计算稳定 BCE，避免对已舍入的概率取 log。', lab: 'machine-learning',
    labTask: '先令 w=0、b=0，验证所有概率为 0.5、平均 BCE 约为 ln2。逐步训练并记录两组 BCE；然后只改变分类阈值，观察 BCE 不变但混淆矩阵改变。最后反转 w 的符号，解释为什么自信但方向错误会带来较大损失。',
    starter: `import math

def sigmoid(z):
    # TODO: 分正负分支，避免 exp 在极端输入上溢出。
    return None

def bce_from_logits(logits, labels):
    # TODO: 使用 max(z,0)-y*z+log1p(exp(-abs(z))) 求平均。
    return None

print(sigmoid(0), bce_from_logits([0, 0], [0, 1]))
`,
    reference: `import math

def sigmoid(z):
    if z >= 0:
        return 1 / (1 + math.exp(-z))
    ez = math.exp(z)
    return ez / (1 + ez)

def bce_from_logits(logits, labels):
    if not labels or len(logits) != len(labels):
        raise ValueError("需要等长非空输入")
    return sum(max(z, 0) - y * z + math.log1p(math.exp(-abs(z))) for z, y in zip(logits, labels)) / len(labels)

print(sigmoid(0), bce_from_logits([0, 0], [0, 1]))
`,
    codeExplanation: 'Sigmoid 的两条分支只对非正指数求 exp，避免上溢；BCE 使用 log1p 保留接近零时的精度。测试直接检查极端分数、对称性和解析损失，独立于训练过程，不用“训练好像下降了”代替数值正确性。',
    pythonTests: `assert sigmoid(0) == 0.5
assert abs(sigmoid(2) + sigmoid(-2) - 1) < 1e-12
assert sigmoid(1000) == 1 and sigmoid(-1000) == 0
assert abs(bce_from_logits([0, 0], [0, 1]) - math.log(2)) < 1e-12
assert bce_from_logits([1000, -1000], [1, 0]) < 1e-12
assert abs(bce_from_logits([1000, -1000], [0, 1]) - 1000) < 1e-9
h = 1e-6
numeric = (bce_from_logits([0.3+h], [1]) - bce_from_logits([0.3-h], [1])) / (2*h)
assert abs(numeric - (sigmoid(0.3)-1)) < 1e-7, "BCE 对 logit 的梯度应为 p-y"
`,
    misconceptions: ['逻辑回归用线性分数与 Sigmoid 做分类，名字中的回归不代表它输出无界房价。', '阈值后的类别不用于 BCE 求导，梯度来自连续概率。', 'BCE 下降不等于概率已经校准；完全可分数据的权重还可能持续增大。'],
    exercise: '实现稳定 Sigmoid 与 BCE，手算 z=0、y=1 的损失与分数梯度。验证 ±1000 不报溢出错误，再用中心有限差分检查 z=0.3、y=1 的梯度是否接近 p−y。解释阈值为何没有出现在训练公式中。',
    quiz: { question: '当 logit z=0、标签 y=1 时，BCE 对 z 的梯度是多少？', options: ['0', '0.5', '−0.5', '−1'], correct: 2, hint: '先算 Sigmoid(0)，然后把它代入交叉熵对分数的梯度 p−y。', explanation: 'Sigmoid(0)=0.5，因此梯度 p−y=−0.5。梯度下降减去负梯度会提高 z，使正类概率上升，方向符合目标标签。' },
    references: [learningSource, { title: 'Google ML Crash Course · Logistic regression', url: 'https://developers.google.com/machine-learning/crash-course/logistic-regression', note: 'Sigmoid、log loss 与线性分数到概率的联系。' }],
  },
];
