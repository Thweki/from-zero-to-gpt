import type {LessonId} from '../types';

export interface GlossaryTerm {
  id: string;
  name: string;
  english: string;
  definition: string;
  example: string;
  lessons: readonly LessonId[];
}

// Explicit associations keep short terms (e.g. Token or loss) from producing
// accidental prose matches. This reference is independent of lesson content.
export const glossary: readonly GlossaryTerm[] = [
  {id:'function',name:'函数',english:'Function',definition:'把每个允许的输入对应到唯一输出的规则。输入集合叫定义域，实际得到的输出组成值域。',example:'f(x)=x² 时，输入 −2 和 2 都得到 4；不同输入可以有相同输出。',lessons:['functions','python','algebra','coordinates']},
  {id:'parameter',name:'参数与偏置',english:'Parameter / Bias',definition:'参数决定模型采用哪条计算规则；训练会调整参数。偏置是不随当前输入变化的可学习加项。',example:'y=kx+b 中，x 是输入，k 和 b 是参数；b=0 时才是严格的线性映射。',lessons:['linear','parameters','neurons','rules-vs-learning','linear-geometry']},
  {id:'vector',name:'向量',english:'Vector',definition:'按顺序排列的一组数，可以表示方向，也可以表示一个样本的多个特征；位置和维度都有意义。',example:'[身高, 体重] 与 [体重, 身高] 虽然含相同的数，却不是同一种特征表示。',lessons:['vectors','coordinates','embeddings']},
  {id:'dot-product',name:'点积',english:'Dot product',definition:'两个等长向量对应元素相乘后求和，得到一个标量。常用于计算加权和或相似程度，但大小也受向量长度影响。',example:'[1, 2]·[3, 4]=1×3+2×4=11。',lessons:['dot-product','neurons','qkv']},
  {id:'matrix',name:'矩阵与张量',english:'Matrix / Tensor',definition:'矩阵是二维数表，张量是可有任意轴数的数组。形状描述每条轴的长度，计算时必须核对轴的含义。',example:'(2, 3) 矩阵乘 (3, 4) 矩阵得到 (2, 4)；矩阵乘法不是逐元素相乘。',lessons:['matrices','matrix-multiplication','linear-geometry','pytorch','memory-performance']},
  {id:'logarithm',name:'指数与对数',english:'Exponent / Logarithm',definition:'指数描述重复乘法的推广；对数回答“底数要取几次幂才得到这个数”。对数的底须为正且不等于 1，真数须为正。',example:'2³=8，所以 log₂(8)=3。对数把乘法转成加法，便于计算概率乘积。',lessons:['powers','logarithms']},
  {id:'probability',name:'概率与分布',english:'Probability / Distribution',definition:'概率描述事件的不确定性，分布给出各个可能结果如何分配概率。离散分布的概率非负且总和为 1。',example:'公平硬币的正反面概率各为 0.5；连续变量的概率要在区间上计算，密度不是单点概率。',lessons:['probability','distributions','classification']},
  {id:'expectation',name:'期望与方差',english:'Expectation / Variance',definition:'期望是按概率加权的平均值；方差是偏离期望的平方的期望，用来描述波动大小。',example:'以相同概率取 0 或 2，期望为 1，方差为 1；期望不一定是能取到的结果。',lessons:['expectation','variance']},
  {id:'derivative',name:'导数与偏导数',english:'Derivative / Partial derivative',definition:'导数是输入微小变化时输出变化率的极限。多变量函数中，只改变一个变量并固定其他变量，得到偏导数。',example:'f(x)=x² 在 x=3 处的导数为 6；这描述附近变化，不表示函数值等于 6。',lessons:['limits','derivatives','partial-derivatives']},
  {id:'gradient',name:'梯度',english:'Gradient',definition:'由各参数的偏导数组成的向量。在通常的欧氏距离下，它指向局部上升最快的方向。',example:'L(x,y)=x²+y² 在 (1,2) 的梯度为 (2,4)；沿负梯度小步移动可以降低损失。',lessons:['gradients','optimization']},
  {id:'gradient-descent',name:'梯度下降与学习率',english:'Gradient descent / Learning rate',definition:'用“参数减去学习率乘梯度”反复更新参数。学习率控制步长；一步下降不保证找到全局最优。',example:'参数为 3、梯度为 6、学习率为 0.1 时，新参数为 2.4；步长过大可能越走越远。',lessons:['gradient-descent','training-regression','optimizers','gpt-training']},
  {id:'loss',name:'损失函数',english:'Loss function',definition:'把预测与训练目标的差异变成可优化的数值。训练尝试降低这个数，但训练损失低不代表在新数据上表现好。',example:'预测 3、目标 5 时，平方误差为 (3−5)²=4。',lessons:['loss-functions','linear-regression','training-regression']},
  {id:'generalization',name:'泛化与过拟合',english:'Generalization / Overfitting',definition:'泛化是模型在未参与训练的数据上仍然有效；过拟合指模型过度适应训练数据，难以迁移到新样本。',example:'训练误差不断下降、验证误差却上升，是过拟合的常见信号。测试集应留到最终评估。',lessons:['datasets','generalization','regularization','corpus','gpt-evaluation','llm-evaluation','paper-reading']},
  {id:'activation',name:'激活函数',english:'Activation function',definition:'神经层中对数值施加的非线性变换。没有非线性，多层仿射变换仍可合成一个仿射变换。',example:'ReLU(x)=max(0,x)；Sigmoid 把实数映射到 0 与 1 之间，可用于二分类概率。',lessons:['activations','mlp','logistic-regression']},
  {id:'backprop',name:'链式法则与反向传播',english:'Chain rule / Backpropagation',definition:'链式法则把复合函数的导数连接起来。反向传播从损失沿计算图向后应用它，累加各条路径对参数梯度的贡献。',example:'z=3x，L=z²，则 dL/dx=(2z)×3。自动微分记录运算关系，不是靠微小扰动估计导数。',lessons:['chain-rule','computation-graph','forward-pass','backprop','autodiff','nn-project']},
  {id:'token',name:'词元',english:'Token',definition:'分词器把文本切成的基本单位，可以是字、词、子词或字节。Token ID 是词表索引，本身没有语义距离。',example:'一个汉字不保证对应一个 Token；分词规则决定文本如何变成 ID 序列。',lessons:['text-representation','tokenization','gpt-tokenizer']},
  {id:'embedding',name:'嵌入',english:'Embedding',definition:'把离散 ID 查表映射为可学习向量，让模型能够在连续空间中计算。输入嵌入会随训练更新。',example:'词表大小为 100、向量维度为 16 时，嵌入表形状是 (100,16)，每个 Token ID 取出一行。',lessons:['embeddings','gpt-embedding','rnn-lstm']},
  {id:'softmax',name:'Softmax',english:'Softmax',definition:'把一组实数分数指数化并归一化，得到和为 1 的正数。输出之间相互关联，某项分数变大通常会压低其他项的概率。',example:'分数 [0,0] 得到 [0.5,0.5]；实现时先减去最大分数可提高数值稳定性。',lessons:['softmax','scaled-attention','lm-head']},
  {id:'attention',name:'注意力与 Q/K/V',english:'Attention / Query, Key, Value',definition:'Query 与 Key 比较得到匹配分数，经归一化成为权重，再对 Value 加权求和。自注意力的 Q/K/V 来自同一输入序列。',example:'读到代词时，一个位置可以从前文多个位置汇总信息；权重是计算结果，不等同于人类的解释。',lessons:['attention','qkv','scaled-attention','self-attention','multi-head','encoder-decoder']},
  {id:'position',name:'位置信息',english:'Positional information',definition:'向模型提供 Token 的顺序或相对位置。单靠不含位置信息的全连接自注意力，不能表达完整的序列顺序。',example:'“猫追狗”和“狗追猫”包含相同的词，但顺序不同；位置表示帮助模型区分它们。',lessons:['positions']},
  {id:'residual',name:'残差连接',english:'Residual connection',definition:'把子层输入与其变换结果相加，让信息和梯度有一条直接通路；相加的张量形状必须兼容。',example:'y=x+F(x)，即使 F(x) 接近零，输入 x 仍能向后传递。',lessons:['residual','transformer-block']},
  {id:'layernorm',name:'层归一化',english:'Layer normalization',definition:'通常在单个 Token 的特征维度上计算均值与方差，再归一化并应用可学习的缩放与偏移。',example:'它不需要跨样本统计，因此同一句话不必依赖同批次其他句子的均值。',lessons:['layernorm','transformer-block']},
  {id:'causal-mask',name:'因果遮罩',english:'Causal mask',definition:'在注意力中屏蔽未来位置，使当前位置的预测只能使用自身及前文信息，防止训练时偷看答案。',example:'长度为 4 的序列中，第 2 个位置只能关注第 1、2 个位置；被屏蔽位置的注意力权重为零。',lessons:['causal-mask','decoder-only','tiny-gpt']},
  {id:'cross-entropy',name:'交叉熵',english:'Cross-entropy',definition:'衡量预测分布与目标分布的差异。目标为单个正确类别时，损失等于该类别预测概率的负对数。',example:'给正确 Token 的概率从 0.1 升到 0.8 时，负对数损失下降；语言模型对许多位置的损失取平均。',lessons:['cross-entropy','lm-head','gpt-training']},
  {id:'checkpoint',name:'模型检查点',english:'Model checkpoint',definition:'训练过程中保存的模型状态。继续训练通常还需要优化器、训练步数等信息；仅保存权重可能不足以原样续训。',example:'本地 GPT 工程的模型检查点与应用里的“保存学习断点”不同，后者保存的是你的学习现场。',lessons:['checkpoints']},
  {id:'autoregressive',name:'自回归生成',english:'Autoregressive generation',definition:'根据已有序列预测下一个 Token，把生成结果接回输入，再重复这个过程。',example:'从提示词开始，每轮只采样一个新 Token；训练时可并行计算多个位置的预测。',lessons:['autoregressive','inference','decoder-only']},
  {id:'sampling',name:'温度与截断采样',english:'Temperature / Top-k / Top-p',definition:'温度缩放输出分数，正温度越低通常越集中。Top-k 保留分数最高的 k 项；Top-p 保留累计概率达到阈值的高概率候选。',example:'Top-p 的候选数量随分布变化；提高温度增加多样性，但不保证生成内容更正确。',lessons:['temperature','top-k-p']},
  {id:'pretraining',name:'预训练与指令微调',english:'Pretraining / SFT',definition:'预训练从大规模数据学习通用预测规律；监督指令微调（SFT）继续用指令与示范回答训练，使模型更适合按指令作答。',example:'预测网页的下一个 Token 与学习“问题→示范回答”是不同的数据组织方式；都不保证事实正确。',lessons:['pretraining-scaling','instruction-sft']},
  {id:'preference',name:'偏好优化',english:'RLHF / DPO',definition:'用对回答的偏好来调整模型。RLHF 常先训练奖励模型再做强化学习；DPO 直接利用成对偏好优化策略，无需单独训练奖励模型。',example:'同一问题有“更偏好”和“较不偏好”的回答；偏好标签不等同于可靠的事实标签。',lessons:['rlhf-dpo']},
  {id:'kv-cache',name:'KV 缓存',english:'KV cache',definition:'自回归推理时保存历史 Token 在各层的 Key 与 Value，供新 Token 复用，减少重复计算。缓存会占用显存。',example:'序列越长，通常要保存的 K/V 越多；缓存提升效率，不会增加模型可支持的上下文长度。',lessons:['kv-cache','inference','memory-performance']},
  {id:'quantization',name:'量化',english:'Quantization',definition:'用更少位数近似表示权重或激活，以降低存储与带宽成本。精度损失和速度收益取决于方法、数据与硬件。',example:'把浮点权重映射到 int8 时需要比例因子；离群值可能让多数值的表示更粗糙。',lessons:['quantization','memory-performance']},
  {id:'lora',name:'低秩适配',english:'LoRA',definition:'冻结原始权重，用两个较小矩阵的乘积表示可训练的权重增量，减少微调时需要训练的参数。',example:'对 d×d 矩阵使用秩 r 的增量，仅需约 2dr 个可训练参数；低秩不意味着模型全部计算都消失。',lessons:['lora']},
  {id:'hallucination',name:'幻觉与评估',english:'Hallucination / Evaluation',definition:'模型可能生成流畅却不真实或不受证据支持的内容。评估要区分语言预测、任务表现和事实可靠性。',example:'困惑度更低不保证引用的论文存在；事实性问题需要核对原始证据，并检查测试数据是否泄漏。',lessons:['hallucination','llm-evaluation','gpt-evaluation','paper-reading']},
];

export function glossaryForLesson(id: LessonId): readonly GlossaryTerm[] {
  return glossary.filter(term => term.lessons.includes(id));
}

export function isGlossaryTermId(value: unknown): value is string {
  return typeof value === 'string' && glossary.some(term => term.id === value);
}
