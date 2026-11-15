import type {LessonId} from '../types';

export interface ExerciseHints {
  concept: string;
  plan: string;
  check: string;
  checkCode: string;
}

// A deliberately small pilot: authored for these exercises, not generated from answers.
export const exerciseHints: Partial<Record<LessonId, ExerciseHints>> = {
  functions: {
    concept: '把输入当作一个可以重复使用的值。平方不是乘以 2，也不是只处理正整数。',
    plan: '保留 square 的参数，用同一个输入构造乘法表达式，替换 return 后的占位值。先在纸上代入负数和小数。',
    check: '把下面的检查放在自己的实现之后运行。若负数失败，检查是否丢掉了括号；若小数失败，检查是否把输入转成了整数。',
    checkCode: 'assert square(-3) == 9\nassert square(0.5) == 0.25\nassert square(0) == 0',
  },
  linear: {
    concept: '斜率描述输入每增加 1 时输出的变化；截距描述输入为 0 时的输出。先用两点求变化量之比。',
    plan: '经过 (0,−1) 的直线先确定截距。再比较 (2,3) 与起点的纵向、横向变化。实现时先缩放输入，再加截距；乘法要显式写出。',
    check: '分别检查穿过给定两点与斜率为零的情形。水平线的输出不应随输入变化。',
    checkCode: 'assert linear(0, 2, -1) == -1\nassert linear(2, 2, -1) == 3\nassert linear(100, 0, 3) == 3',
  },
  vectors: {
    concept: '向量相加仍然返回向量，长度则返回一个数。Python 的列表加号会拼接列表，并不会逐分量相加。',
    plan: 'add 按相同下标取两个分量，构造一个新列表。length 先把每个分量平方，再把总和开平方；先平方能避免正负分量互相抵消。',
    check: '检查输出维数、相反向量相加、零向量长度和负分量。add 不应该修改原来的输入列表。',
    checkCode: 'u = [2, -1]\nassert add(u, [-3, 4]) == [-1, 3]\nassert u == [2, -1]\nassert add(u, [-2, 1]) == [0, 0]\nassert length([-3, 4]) == 5\nassert length([0, 0]) == 0',
  },
  'dot-product': {
    concept: '点积把两个同维向量压成一个数。每一项只与另一个向量的对应分量配对，不能把所有分量交叉相乘。',
    plan: '保留维数检查。从零开始累加，循环次数由输入长度决定，每次加入一对分量的乘积。不要把二维图形的限制写死在实现里。',
    check: '用三维输入发现写死下标的问题，用负结果发现误取绝对值的问题。另试维数不匹配的输入，应该抛出 ValueError。',
    checkCode: 'assert dot([1, 2], [3, -1]) == 1\nassert dot([1, 2, 3], [4, 5, 6]) == 32\nassert dot([1, 0], [-2, 0]) == -2\nassert dot([2, 0], [0, 2]) == 0',
  },
  'gradient-descent': {
    concept: '梯度指向损失上升最快的方向，下降要沿反方向走。分别对损失中的两个平方项求偏导，留意第二项还有系数 2。',
    plan: '每轮先在当前位置计算两个偏导，再各自减去学习率乘偏导。更新后把新的坐标列表加入 history；开始的位置也要保留。',
    check: '先核对一步，而不是只看终点。零步应只返回起点；在极小点继续走，位置应该保持不变。浮点坐标用容差比较。',
    checkCode: 'path = descend([3, 2], 0.1, 1)\nassert len(path) == 2 and path[0] == [3, 2]\nassert abs(path[1][0] - 2.6) < 1e-10\nassert abs(path[1][1] - 0.8) < 1e-10\nassert descend([3, 2], 0.1, 0) == [[3, 2]]\nassert descend([1, -1], 0.1, 2) == [[1, -1]] * 3',
  },
  softmax: {
    concept: '概率需要非负且总和为 1。直接把原始分数除以总和不满足这个目标；直接对大分数求指数又可能溢出。',
    plan: '先找最大分数，让每个分数减去它，再求指数。保存这些指数值，求它们的总和，最后用同一个总和归一化每一项。',
    check: '相同分数应等概率。把所有分数同时加上 1000 后，概率应保持不变且不溢出；原始分数列表也应保留。',
    checkCode: 'scores = [0., 1.]\np = softmax(scores)\nq = softmax([1000., 1001.])\nassert scores == [0., 1.]\nassert abs(sum(p) - 1) < 1e-10\nassert all(abs(a - b) < 1e-10 for a, b in zip(p, q))\nassert softmax([0., 0.]) == [0.5, 0.5]',
  },
  attention: {
    concept: '注意力汇聚混合的是值向量。输出的长度等于每个值向量的宽度，而不是参与混合的位置数。',
    plan: '外层逐个构造输出特征，内层遍历所有位置，把该位置的权重乘以该特征的值再累加。返回新列表，保留输入矩阵。',
    check: '先手算两个分量，再用“两个位置、三个特征”检查是否混淆了两个轴。相反的值向量也可能相互抵消。',
    checkCode: 'out = weighted_sum([0.2, 0.8], [[2., 0.], [0., 3.]])\nassert len(out) == 2\nassert abs(out[0] - 0.4) < 1e-10\nassert abs(out[1] - 2.4) < 1e-10\nassert weighted_sum([1., 0.], [[2., 3., 4.], [8., 9., 10.]]) == [2., 3., 4.]\nassert weighted_sum([0.5, 0.5], [[2., -1.], [-2., 1.]]) == [0., 0.]',
  },
  'cross-entropy': {
    concept: '损失只对真实目标的概率取负对数，但归一化需要所有候选分数。target 是下标，不是目标的概率。',
    plan: '用最大 logit 平移所有分数，计算指数和的自然对数，再补回平移量。最后减去 target 对应的原始 logit，避免先得到极小概率再取对数。',
    check: '两个等分候选的损失应为 ln 2。整体平移不应改变损失；高置信度猜错的损失应显著大于猜对。',
    checkCode: 'import math\nassert abs(cross_entropy([0., 0.], 0) - math.log(2)) < 1e-10\nassert abs(cross_entropy([1000., 1000.], 1) - math.log(2)) < 1e-10\nassert cross_entropy([8., -8.], 0) < 1e-6\nassert cross_entropy([8., -8.], 1) > 15',
  },
};
