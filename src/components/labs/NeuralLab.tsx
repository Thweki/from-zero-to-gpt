import type { ExtendedLabProps } from '../../types';
import './NeuralLab.css';

export const neuralDefaults = { x: 1, w: .7, b: .2, activation: 1, w2: -1, v1: 1, v2: -.8, c: .1, nnStep: 0, lr: .05, lambda: .1, optimizer: 0, velocity: 0, moment: 0, secondMoment: 0, iteration: 0, dropout: .5, mask: 1 };
export const activationValue = (z: number, kind: number) => kind === 0 ? Math.max(0, z) : kind === 1 ? Math.tanh(z) : 1 / (1 + Math.exp(-z));
export const activationDerivative = (z: number, kind: number) => kind === 0 ? Number(z > 0) : kind === 1 ? 1 - Math.tanh(z) ** 2 : activationValue(z, 2) * (1 - activationValue(z, 2));
export function networkForward(x: number, w: number, b: number, w2: number, v1: number, v2: number, c: number) {
  const h1 = Math.tanh(w * x + b), h2 = Math.tanh(w2 * x - b);
  return { h1, h2, y: v1 * h1 + v2 * h2 + c };
}
export function graphGradients(x: number, w: number, b: number) {
  const product = w * x, u = product + b;
  return { product, u, loss: u * u, du: 2 * u, dw: 2 * u * x, dx: 2 * u * w, db: 2 * u };
}
export const numericalGradient = (f: (x: number) => number, x: number, epsilon = 1e-5) => (f(x + epsilon) - f(x - epsilon)) / (2 * epsilon);
export function optimizerUpdate(w: number, gradient: number, lr: number, kind: number, velocity = 0, moment = 0, secondMoment = 0, iteration = 0) {
  const t = iteration + 1;
  const newVelocity = .9 * velocity + gradient;
  const m = .9 * moment + .1 * gradient, s = .999 * secondMoment + .001 * gradient ** 2;
  const direction = kind === 0 ? gradient : kind === 1 ? newVelocity : (m / (1 - .9 ** t)) / (Math.sqrt(s / (1 - .999 ** t)) + 1e-8);
  return { w: w - lr * direction, velocity: newVelocity, moment: m, secondMoment: s, iteration: t, direction };
}
const fmt = (n: number) => Math.abs(n) < 1e-9 ? '0' : Number(n.toFixed(5)).toString();

export function NeuralLab({ lesson, values, onChange }: ExtendedLabProps) {
  const v = { ...neuralDefaults, ...values };
  const set = (key: keyof typeof neuralDefaults, value: number) => onChange({ ...v, [key]: value });
  const neuron = ['neurons', 'activations'].includes(lesson.id);
  const network = ['mlp', 'forward-pass', 'pytorch', 'nn-project'].includes(lesson.id);
  const graph = ['computation-graph', 'backprop', 'autodiff', 'nn-project'].includes(lesson.id);
  const training = ['optimizers', 'regularization', 'nn-project'].includes(lesson.id);
  const g = graphGradients(v.x, v.w, v.b), f = networkForward(v.x, v.w, v.b, v.w2, v.v1, v.v2, v.c);
  const z = v.w * v.x + v.b, activation = activationValue(z, v.activation);
  const objective = (w: number) => (w * v.x + v.b) ** 2 + v.lambda * w * w / 2;
  const gradient = g.dw + v.lambda * v.w;
  const proposed = optimizerUpdate(v.w, gradient, v.lr, v.optimizer, v.velocity, v.moment, v.secondMoment, v.iteration);
  const slider = (key: keyof typeof neuralDefaults, label: string, min = -3, max = 3, step = .1) => <label className="nn-slider"><span>{label}<output>{fmt(v[key])}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={v[key]} onChange={e => set(key, Number(e.target.value))} /></label>;
  const samples = Array.from({ length: 101 }, (_, i) => { const x = -3 + i * .06; return { x, y: neuron ? activationValue(v.w * x + v.b, v.activation) : networkForward(x, v.w, v.b, v.w2, v.v1, v.v2, v.c).y }; });
  const plotMax = Math.max(1, ...samples.map(p => Math.abs(p.y)));
  const plotY = (y: number) => 125 - y * 100 / plotMax;
  const curve = samples.map(p => `${30 + (p.x + 3) * 70},${plotY(p.y)}`).join(' ');
  const displayMask = v.dropout === 0 ? 1 : v.mask;
  return <section className="nn-lab" aria-label="神经网络与梯度流交互实验">
    <header className="nn-header"><h3>神经网络与梯度流</h3><button type="button" onClick={() => onChange({ ...neuralDefaults })}>重置实验</button></header>
    <p className="nn-note">教学缩小模型：单输入、两隐藏单元与标量计算图；这里每个数都由当前参数实时计算。参数保存在本章。</p>
    <div className="nn-controls">{slider('x', '输入 x')}{slider('w', '权重 w')}{slider('b', '偏置 b')}</div>
    {(neuron || network) && <div className="nn-card">
      <h4>{neuron ? '一个可微神经元' : '1 → 2 → 1 多层前向传播'}</h4>
      {neuron ? <><label className="nn-select">激活函数<select aria-label="神经元激活函数" value={v.activation} onChange={e => set('activation', Number(e.target.value))}><option value={0}>ReLU</option><option value={1}>tanh</option><option value={2}>sigmoid</option></select></label><p>z = wx + b = <strong>{fmt(z)}</strong> → a = <strong data-testid="nn-activation">{fmt(activation)}</strong></p><p>局部导数 da/dz = {fmt(activationDerivative(z, v.activation))}；da/dw = {fmt(activationDerivative(z, v.activation) * v.x)}</p><p className="nn-note">ReLU 在 0 不可微，实验采用框架常用的导数约定 0。感知机硬阈值与这里的连续激活不同。</p></> : <><div className="nn-controls">{slider('w2', '第二单元权重 w₂')}{slider('v1', '输出权重 v₁')}{slider('v2', '输出权重 v₂')}{slider('c', '输出偏置 c')}</div><p>h₁ = tanh(wx+b) = {fmt(f.h1)}；h₂ = tanh(w₂x−b) = {fmt(f.h2)}</p><p>y = v₁h₁ + v₂h₂ + c = <strong data-testid="nn-forward">{fmt(f.y)}</strong></p><p className="nn-note">为了减少滑块，两个隐藏单元共用符号相反的 b；实际 MLP 通常为每个单元设置独立偏置。输出层是恒等映射，数值不是概率。</p></>}
      <svg className="nn-plot" viewBox="0 0 480 250" role="img" aria-label={`输入从负三到三时模型输出的实时曲线，纵轴自动缩放到正负 ${fmt(plotMax)}`}><path d="M30 125H450M240 20V230" stroke="var(--axis)" /><polyline points={curve} fill="none" stroke="var(--accent)" strokeWidth="3" /><circle cx={30 + (v.x + 3) * 70} cy={plotY(neuron ? activation : f.y)} r="5" fill="var(--accent)" /><text x="30" y="245">−3</text><text x="240" y="245">0</text><text x="445" y="245">3 x</text><text x="4" y="16">{fmt(plotMax)}</text><text x="0" y="225">−{fmt(plotMax)}</text></svg>
      {!neuron && <div className="nn-table-wrap"><table><caption>批次 X 的形状 (3,1)，隐藏层 (3,2)，输出 (3,1)</caption><thead><tr><th>x</th><th>h₁</th><th>h₂</th><th>y</th></tr></thead><tbody>{[-1, 0, 1].map(x => { const r = networkForward(x, v.w, v.b, v.w2, v.v1, v.v2, v.c); return <tr key={x}><td>{x}</td><td>{fmt(r.h1)}</td><td>{fmt(r.h2)}</td><td>{fmt(r.y)}</td></tr>; })}</tbody></table></div>}
      {lesson.id === 'pytorch' && <p className="nn-note">这是 JavaScript 实际前向计算与张量形状演示。浏览器 Python 练习只用标准库；真实 torch/autograd 请运行项目 README 的本地命令。</p>}
    </div>}
    {graph && <div className="nn-card"><h4>计算图 z = (w × x + b)²</h4><div className="nn-graph" aria-label="按逆拓扑顺序传播梯度"><div className={v.nnStep >= 3 ? 'nn-active' : ''}>w × x<br /><strong>{fmt(g.product)}</strong><small>乘法节点</small></div><span aria-hidden="true">→</span><div className={v.nnStep >= 2 ? 'nn-active' : ''}>u = wx + b<br /><strong>{fmt(g.u)}</strong><small>加法节点</small></div><span aria-hidden="true">→</span><div className={v.nnStep >= 1 ? 'nn-active' : ''}>z = u²<br /><strong>{fmt(g.loss)}</strong><small>平方节点</small></div></div>
      <div className="nn-actions"><button type="button" disabled={v.nnStep >= 3} onClick={() => set('nnStep', v.nnStep + 1)}>反传一步</button><button type="button" onClick={() => set('nnStep', 0)}>清除反传显示</button></div>
      <p className="nn-status" aria-live="polite">{['先前向保存每个中间值。点击反传一步，把终点种子梯度 ∂z/∂z 设为 1。', `平方节点：∂z/∂u = 2u × 1 = ${fmt(g.du)}。`, `加法节点把上游梯度分别传给乘积与 b：∂z/∂b = ${fmt(g.db)}。`, `乘法节点：∂z/∂w = x × 2u = ${fmt(g.dw)}；∂z/∂x = w × 2u = ${fmt(g.dx)}。`][Math.min(3, v.nnStep)]}</p>
      <div className="nn-table-wrap"><table><caption>解析梯度与中心差分校验（ε = 10⁻⁵；始终随参数更新）</caption><thead><tr><th>变量</th><th>解析梯度</th><th>有限差分</th><th>绝对误差</th></tr></thead><tbody>{(['w', 'x', 'b'] as const).map(key => { const exact = key === 'w' ? g.dw : key === 'x' ? g.dx : g.db; const numeric = numericalGradient(t => { const a = { x: v.x, w: v.w, b: v.b, [key]: t }; return (a.w * a.x + a.b) ** 2; }, v[key]); return <tr key={key}><td>{key}</td><td>{fmt(exact)}</td><td>{fmt(numeric)}</td><td>{Math.abs(exact - numeric).toExponential(2)}</td></tr>; })}</tbody></table></div><p className="nn-note">反传动画只控制哪些节点被讲解；表中校验不会等待动画。把平方展开为 u×u 时，两条入边各贡献 u，必须相加为 2u。</p></div>}
    {training && <div className="nn-card"><h4>真正执行一次参数更新</h4><p>固定输入和偏置，最小化 J(w) = (wx+b)² + λw²/2。只更新 w，便于追踪每个梯度。</p><div className="nn-controls">{slider('lr', '学习率 η', .001, .3, .001)}{slider('lambda', 'L2 系数 λ', 0, 2, .05)}<label className="nn-select">优化器<select aria-label="选择优化器" value={v.optimizer} onChange={e => onChange({ ...v, optimizer: Number(e.target.value), velocity: 0, moment: 0, secondMoment: 0, iteration: 0 })}><option value={0}>SGD</option><option value={1}>Momentum（β=0.9）</option><option value={2}>Adam（β₁=0.9, β₂=0.999）</option></select></label></div><p>数据梯度 {fmt(g.dw)} + L2 梯度 {fmt(v.lambda * v.w)} = <strong>{fmt(gradient)}</strong></p><p>当前 J = {fmt(objective(v.w))} → 下一步 J = <strong data-testid="nn-next-loss">{fmt(objective(proposed.w))}</strong></p><p>w: {fmt(v.w)} → {fmt(proposed.w)}；更新方向 {fmt(proposed.direction)}；已执行 {v.iteration} 步</p><div className="nn-actions"><button type="button" disabled={!Number.isFinite(proposed.w) || Math.abs(proposed.w) > 10} onClick={() => onChange({ ...v, w: proposed.w, velocity: proposed.velocity, moment: proposed.moment, secondMoment: proposed.secondMoment, iteration: proposed.iteration })}>应用一次更新</button></div><p className="nn-note">Momentum 使用 v←0.9v+g；Adam 显式保存一、二阶矩并做偏差校正。切换优化器会清空状态。手动改 w 后如需全新实验，请重置。学习率过大可能使损失升高。</p>
      {lesson.id === 'regularization' && <><h4>倒置 Dropout：保留后放大</h4>{slider('dropout', '丢弃概率 p', 0, .9, .1)}<div className="nn-actions"><button type="button" disabled={v.dropout === 0} onClick={() => set('mask', v.mask === 1 ? 0 : 1)}>切换演示掩码：当前 {displayMask === 1 ? '保留' : '丢弃'}</button></div><p>原激活 h = {fmt(f.h1)}；训练输出 m·h/(1−p) = <strong>{fmt(displayMask * f.h1 / (1 - v.dropout))}</strong>；推理输出 h = {fmt(f.h1)}</p><p className="nn-note">按钮手动选掩码，方便核算，未模拟随机采样。真正训练每次独立采样 m∼Bernoulli(1−p)，期望激活为 h；这不保证非线性网络的期望输出或损失不变。</p></>}
    </div>}
    <p className="nn-task"><strong>本章实验：</strong>{lesson.labTask}</p>
  </section>;
}
