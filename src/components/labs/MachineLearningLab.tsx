import { useEffect, useMemo, useState } from 'react';
import type { ExtendedLabProps } from '../../types';
import './MachineLearningLab.css';

export type MLPoint = { x: number; y: number; id: number };
export type MLTask = 'regression' | 'polynomial' | 'classification';
export const ML_DEFAULTS = {
  mlWeight: 0, mlBias: 0, mlLearningRate: 0.15, mlNoise: 0.4,
  mlTrainFraction: 0.65, mlSeed: 7, mlDegree: 2, mlThreshold: 0.5, mlRuleMode: 0,
};

/** Local seeded generator: changing other page state cannot change the samples. */
function randomGenerator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return (state + 0.5) / 4294967296;
  };
}

export function sigmoid(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

export function bceFromLogit(z: number, y: number): number {
  return Math.max(z, 0) - y * z + Math.log1p(Math.exp(-Math.abs(z)));
}

export function makeMLData(task: MLTask, noise: number, seed: number): MLPoint[] {
  const random = randomGenerator(seed);
  return Array.from({ length: 32 }, (_, id) => {
    const x = -1 + 2 * id / 31;
    const u = random();
    const gaussian = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
    const y = task === 'classification'
      ? Number(random() < (1 - noise * 0.5) * sigmoid(5 * x - 0.2) + noise * 0.25)
      : (task === 'polynomial' ? 0.25 + 0.8 * x + 1.5 * x * x : 0.35 + 1.6 * x) + noise * gaussian;
    return { x, y, id };
  });
}

export function splitMLData(points: MLPoint[], fraction: number, seed: number) {
  const random = randomGenerator(seed + 104729);
  const shuffled = [...points];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const count = Math.max(1, Math.min(points.length - 1, Math.floor(points.length * fraction)));
  return { train: shuffled.slice(0, count), validation: shuffled.slice(count) };
}

export function regressionMetrics(points: MLPoint[], predict: (x: number) => number) {
  if (!points.length) throw new Error('指标需要非空样本');
  const errors = points.map(point => predict(point.x) - point.y);
  const mse = errors.reduce((sum, error) => sum + error * error, 0) / errors.length;
  return { mse, rmse: Math.sqrt(mse), mae: errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length };
}

export function modelLoss(points: MLPoint[], w: number, b: number, classification = false) {
  if (!points.length) throw new Error('损失需要非空样本');
  return points.reduce((sum, p) => sum + (classification
    ? bceFromLogit(w * p.x + b, p.y) : (w * p.x + b - p.y) ** 2), 0) / points.length;
}

export function gradientStep(points: MLPoint[], w: number, b: number, lr: number, classification = false) {
  if (!points.length) throw new Error('梯度需要非空样本');
  let gw = 0, gb = 0;
  for (const p of points) {
    const error = classification ? sigmoid(w * p.x + b) - p.y : 2 * (w * p.x + b - p.y);
    gw += error * p.x / points.length;
    gb += error / points.length;
  }
  return { w: w - lr * gw, b: b - lr * gb, gw, gb };
}

export function polynomialPredict(coefficients: number[], x: number): number {
  return coefficients.reduceRight((value, coefficient) => value * x + coefficient, 0);
}

/** Unregularized least squares using reorthogonalized modified Gram–Schmidt QR.
 * Avoids forming A^T A, which squares the condition number of a Vandermonde matrix. */
export function fitPolynomial(points: MLPoint[], degree: number): number[] {
  const columns = degree + 1;
  if (points.length < columns) throw new Error('样本数少于参数数');
  const q: number[][] = [];
  const r = Array.from({ length: columns }, () => Array(columns).fill(0) as number[]);
  for (let j = 0; j < columns; j++) {
    const v = points.map(p => p.x ** j);
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < j; k++) {
        const projection = q[k].reduce((sum, value, i) => sum + value * v[i], 0);
        r[k][j] += projection;
        for (let i = 0; i < v.length; i++) v[i] -= projection * q[k][i];
      }
    }
    r[j][j] = Math.hypot(...v);
    if (r[j][j] < 1e-12) throw new Error('输入不能唯一确定该次数模型');
    q.push(v.map(value => value / r[j][j]));
  }
  const coefficients = q.map(column => column.reduce((sum, value, i) => sum + value * points[i].y, 0));
  for (let i = columns - 1; i >= 0; i--) {
    for (let j = i + 1; j < columns; j++) coefficients[i] -= r[i][j] * coefficients[j];
    coefficients[i] /= r[i][i];
  }
  return coefficients;
}

export function classificationMetrics(points: MLPoint[], w: number, b: number, threshold: number) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const point of points) {
    const positive = sigmoid(w * point.x + b) >= threshold;
    if (positive && point.y === 1) tp++;
    else if (positive) fp++;
    else if (point.y === 1) fn++;
    else tn++;
  }
  return { tp, fp, fn, tn, accuracy: (tp + tn) / points.length,
    precision: tp + fp ? tp / (tp + fp) : 0, recall: tp + fn ? tp / (tp + fn) : 0 };
}

type LossEntry = { step: number; train: number; validation: number };
const f = (value: number, digits = 3) => Number.isFinite(value) ? value.toFixed(digits) : '超出数值范围';

function LossChart({ history, classification }: { history: LossEntry[]; classification: boolean }) {
  if (history.length < 2) return <p className="ml-history-empty">单步或连续训练后，这里会显示每次更新真实计算的两组损失。</p>;
  const max = Math.max(0.01, ...history.flatMap(entry => [entry.train, entry.validation]));
  const last = history.at(-1)!.step;
  const points = (key: 'train' | 'validation') => history.map(entry => `${40 + entry.step / Math.max(1, last) * 490},${111 - entry[key] / max * 92}`).join(' ');
  return <div className="ml-loss-chart"><svg viewBox="0 0 550 145" role="img" aria-label={`实际${classification ? 'BCE' : 'MSE'}训练曲线：实线训练，虚线验证；横轴更新步数`}>
    <path d="M40 15V111H533" className="ml-axis"/><text x="35" y="18" textAnchor="end">{f(max, 2)}</text><text x="35" y="115" textAnchor="end">0</text>
    <text x="40" y="133">0 步</text><text x="530" y="133" textAnchor="end">{last} 步</text>
    <polyline className="ml-train-line" points={points('train')}/><polyline className="ml-validation-line" points={points('validation')}/>
  </svg><p>实线：训练损失 · 虚线：验证损失 · 同一纵轴，从 0 起</p></div>;
}

export function MachineLearningLab({ lesson, values, onChange }: ExtendedLabProps) {
  const v = { ...ML_DEFAULTS, ...values };
  const classification = lesson.id === 'classification' || lesson.id === 'logistic-regression';
  const polynomial = lesson.id === 'generalization';
  const task: MLTask = classification ? 'classification' : polynomial ? 'polynomial' : 'regression';
  const [history, setHistory] = useState<LossEntry[]>([]);
  const [notice, setNotice] = useState('所有样本由固定公式和种子生成；验证点不参与参数更新。');
  const data = useMemo(() => makeMLData(task, v.mlNoise, v.mlSeed), [task, v.mlNoise, v.mlSeed]);
  const { train, validation } = useMemo(() => splitMLData(data, v.mlTrainFraction, v.mlSeed), [data, v.mlTrainFraction, v.mlSeed]);
  const coefficients = useMemo(() => polynomial ? fitPolynomial(train, v.mlDegree) : [], [polynomial, train, v.mlDegree]);
  useEffect(() => { setHistory([]); }, [lesson.id, data, v.mlTrainFraction]);
  const fixedRule = lesson.id === 'rules-vs-learning' && v.mlRuleMode === 0;
  const w = fixedRule ? 1 : v.mlWeight, b = fixedRule ? 0 : v.mlBias;
  const predict = (x: number) => polynomial ? polynomialPredict(coefficients, x) : classification ? sigmoid(w * x + b) : w * x + b;
  const trainMetrics = regressionMetrics(train, predict), validationMetrics = regressionMetrics(validation, predict);
  const trainLoss = polynomial ? trainMetrics.mse : modelLoss(train, w, b, classification);
  const validationLoss = polynomial ? validationMetrics.mse : modelLoss(validation, w, b, classification);
  const confusion = classificationMetrics(validation, w, b, v.mlThreshold);
  const boundary = w === 0 ? undefined : (Math.log(v.mlThreshold / (1 - v.mlThreshold)) - b) / w;
  const currentStep = history.at(-1)?.step ?? 0;

  const set = (key: keyof typeof ML_DEFAULTS, value: number) => {
    onChange({ ...v, [key]: value });
    if (key !== 'mlThreshold' && key !== 'mlLearningRate') setHistory([]);
    setNotice(key === 'mlThreshold' ? '阈值已改变；模型概率、BCE 与权重保持原值。' : '参数已保存；图像和两组指标根据当前数值重新计算。');
  };
  const run = (steps: number) => {
    let nextW = w, nextB = b;
    const entries: LossEntry[] = history.length ? [...history] : [{ step: 0, train: trainLoss, validation: validationLoss }];
    let completed = 0;
    for (let i = 0; i < steps; i++) {
      const next = gradientStep(train, nextW, nextB, v.mlLearningRate, classification);
      if (!Number.isFinite(next.w + next.b) || Math.max(Math.abs(next.w), Math.abs(next.b)) > 20) break;
      nextW = next.w; nextB = next.b; completed++;
      entries.push({ step: currentStep + completed, train: modelLoss(train, nextW, nextB, classification), validation: modelLoss(validation, nextW, nextB, classification) });
    }
    onChange({ ...v, mlWeight: nextW, mlBias: nextB, mlRuleMode: 1 });
    setHistory(entries);
    setNotice(completed === steps ? `完成 ${completed} 次全批量更新；梯度只读取 ${train.length} 个训练点。` : `在参数越过 ±20 前停止；已完成 ${completed} 步。当前学习率可能造成震荡，请重置并减小学习率。`);
  };
  const fit = () => {
    const [nextB, nextW] = fitPolynomial(train, 1);
    onChange({ ...v, mlWeight: nextW, mlBias: nextB, mlRuleMode: 1 });
    setHistory([]);
    setNotice('最小二乘已只根据训练点求解。验证点随后用于独立计算误差。');
  };
  const reset = () => {
    onChange({ ...ML_DEFAULTS }); setHistory([]);
    setNotice('已恢复种子 7、噪声 0.4 和初始参数；可以重复同一次实验。');
  };
  const slider = (key: keyof typeof ML_DEFAULTS, label: string, min: number, max: number, step: number) => <label className="ml-slider" key={key}>
    <span>{label}<output>{f(v[key], step >= 1 ? 0 : 2)}</output></span>
    <input type="range" aria-label={label} min={min} max={max} step={step} value={v[key]} onChange={event => set(key, Number(event.target.value))}/>
    <small>{min} <span>{max}</span></small>
  </label>;

  const xMin = -1.12, xMax = 1.12;
  const yMin = classification ? -0.14 : Math.min(-2.2, ...data.map(p => p.y)) - 0.2;
  const yMax = classification ? 1.14 : Math.max(2.5, ...data.map(p => p.y)) + 0.2;
  const px = (x: number) => 47 + (x - xMin) / (xMax - xMin) * 496;
  const py = (y: number) => 252 - (y - yMin) / (yMax - yMin) * 229;
  const path = Array.from({ length: 241 }, (_, i) => { const x = xMin + i / 240 * (xMax - xMin); return `${px(x)},${py(predict(x))}`; }).join(' ');
  const first = train[0];
  const error = predict(first.x) - first.y;
  const clipId = `ml-plot-${lesson.id}`;
  const showDataControls = ['datasets', 'generalization', 'loss-functions'].includes(lesson.id);

  return <section className="ml-lab" aria-label="机器学习交互实验">
    <div className="ml-header"><div><span className="ml-live-dot"/> 实时计算实验 <small>{polynomial ? '最小二乘 · QR 求解' : classification ? 'SIGMOID / BCE' : 'LINEAR REGRESSION'}</small></div><button type="button" onClick={reset}>重置实验</button></div>
    <div className="ml-main"><div className="ml-visual">
      <div className="ml-equation">{polynomial ? `${v.mlDegree} 次多项式 · ${coefficients.length} 个系数` : classification ? `p = sigmoid(${f(w, 2)}x ${b >= 0 ? '+' : '−'} ${f(Math.abs(b), 2)})` : `ŷ = ${f(w, 2)}x ${b >= 0 ? '+' : '−'} ${f(Math.abs(b), 2)}`}</div>
      <svg className="ml-plot" viewBox="0 0 580 290" role="img" aria-label={polynomial ? '多项式拟合与训练验证样本图' : classification ? 'Sigmoid 概率曲线、类别点和决策边界' : '回归直线、训练验证点及纵向残差'}>
        <defs><clipPath id={clipId}><rect x="43" y="19" width="505" height="237"/></clipPath></defs>
        {[-1, -0.5, 0, 0.5, 1].map(x => <g key={x}><path d={`M${px(x)} 23V252`} className="ml-grid"/><text x={px(x)} y="273" textAnchor="middle">{x}</text></g>)}
        {(classification ? [0, 0.5, 1] : [-2, -1, 0, 1, 2, 3]).filter(y => y >= yMin && y <= yMax).map(y => <g key={y}><path d={`M47 ${py(y)}H543`} className="ml-grid"/><text x="39" y={py(y) + 4} textAnchor="end">{y}</text></g>)}
        <path d="M47 23V252H543" className="ml-axis"/><text x="555" y="256">x</text><text x="44" y="13">{classification ? 'p / y' : 'ŷ / y'}</text>
        <g clipPath={`url(#${clipId})`}>
          {classification && <><path d={`M47 ${py(v.mlThreshold)}H543`} className="ml-threshold"/>{boundary !== undefined && <path d={`M${px(boundary)} 23V252`} className="ml-boundary"/>}</>}
          {!classification && train.map(point => <path key={`e${point.id}`} d={`M${px(point.x)} ${py(point.y)}V${py(predict(point.x))}`} className="ml-residual"/>)}
          <polyline points={path} className="ml-model-line"/>
          {train.map(point => <circle key={point.id} cx={px(point.x)} cy={py(point.y)} r="4.7" className={classification && point.y === 0 ? 'ml-point ml-negative' : 'ml-point ml-positive'}/>)}
          {validation.map(point => <rect key={point.id} x={px(point.x) - 4} y={py(point.y) - 4} width="8" height="8" className={classification && point.y === 0 ? 'ml-validation-point ml-negative' : 'ml-validation-point ml-positive'}/>)}
        </g>
      </svg>
      <p className="ml-legend"><span>● 训练 {train.length} 点</span><span>□ 验证 {validation.length} 点</span><span>{classification ? '绿：标签1 · 金：标签0' : '竖细线：训练残差'}</span></p>
      {classification && <p className="ml-boundary-note">阈值 {f(v.mlThreshold, 2)} · {boundary === undefined ? `w=0：所有输入概率相同，全部预测${sigmoid(b) >= v.mlThreshold ? '正类' : '负类'}，没有唯一有限边界。` : `边界 x=${f(boundary)}；${w > 0 ? '右侧' : '左侧'}预测正类${boundary < xMin || boundary > xMax ? '（边界在图外）' : ''}。`}</p>}
      {polynomial && <p className="ml-coefficients">系数 c₀…c{v.mlDegree}：{coefficients.map(c => f(c, 2)).join('，')}<br/>仅用训练点求解；每次修改次数、噪声或划分会重新拟合。</p>}
      {!polynomial && <div className="ml-actions"><button type="button" disabled={fixedRule} onClick={() => run(1)}>单步训练</button><button type="button" disabled={fixedRule} onClick={() => run(60)}>连续训练 60 步</button>{!classification && <button type="button" disabled={fixedRule} onClick={fit}>最小二乘拟合</button>}<span>已更新 {currentStep} 步</span></div>}
    </div>
    <div className="ml-controls">
      {lesson.id === 'rules-vs-learning' && <label className="ml-select">规则来源<select value={v.mlRuleMode} onChange={event => set('mlRuleMode', Number(event.target.value))}><option value={0}>手写固定规则：ŷ=x</option><option value={1}>从样本学习：ŷ=wx+b</option></select></label>}
      {polynomial ? slider('mlDegree', '多项式次数 d', 1, 9, 1) : <>{slider('mlWeight', '权重 w', -20, 20, 0.1)}{slider('mlBias', '偏置 b', -20, 20, 0.1)}{slider('mlLearningRate', '学习率 η', 0.01, 1.5, 0.01)}</>}
      {fixedRule && <p className="ml-control-note">当前使用固定规则 ŷ=x。切换到“从样本学习”后，w、b 与训练按钮生效。</p>}
      {(showDataControls || polynomial) && <>{slider('mlNoise', '标签噪声强度', 0, 1, 0.05)}{slider('mlTrainFraction', '训练集比例', 0.5, 0.85, 0.05)}{slider('mlSeed', '数据与划分种子', 1, 31, 1)}</>}
      {classification && slider('mlThreshold', '正类决策阈值 τ', 0.1, 0.9, 0.05)}
      <p className="ml-control-note">合成数据 · 共 32 点 · 种子 {v.mlSeed}<br/>{polynomial ? '真实趋势：0.25 + 0.8x + 1.5x²' : classification ? '标签：按 sigmoid(5x−0.2) 随机采样，并混入噪声' : '真实趋势：0.35 + 1.6x'}<br/>{classification ? '同一标签用于 BCE 和混淆矩阵。' : '噪声为固定种子的高斯采样。'}本实验没有最终测试集。</p>
    </div></div>
    <div className="ml-metrics" aria-live="polite"><div><small>训练 {classification ? 'BCE' : 'MSE'}</small><strong data-testid="ml-train-loss">{f(trainLoss, 4)}</strong></div><div><small>验证 {classification ? 'BCE' : 'MSE'}</small><strong data-testid="ml-validation-loss">{f(validationLoss, 4)}</strong></div><div><small>{classification ? '验证准确率' : '验证 RMSE'}</small><strong>{classification ? `${f(confusion.accuracy * 100, 1)}%` : f(validationMetrics.rmse, 4)}</strong></div><div><small>{classification ? '验证召回率' : '验证 MAE'}</small><strong>{classification ? `${f(confusion.recall * 100, 1)}%` : f(validationMetrics.mae, 4)}</strong></div></div>
    {classification ? <div className="ml-confusion"><table><caption>验证集混淆矩阵 · 阈值 {f(v.mlThreshold, 2)}</caption><thead><tr><th scope="col">实际 / 预测</th><th scope="col">正类</th><th scope="col">负类</th></tr></thead><tbody><tr><th scope="row">正类</th><td>TP {confusion.tp}</td><td>FN {confusion.fn}</td></tr><tr><th scope="row">负类</th><td>FP {confusion.fp}</td><td>TN {confusion.tn}</td></tr></tbody></table><p>精确率：{f(confusion.precision * 100, 1)}%<br/>召回率：{f(confusion.recall * 100, 1)}%<br/>分母为 0 时，指标显示 0。</p></div>
      : lesson.id === 'loss-functions' && <div className="ml-residual-example">首个训练点：x={f(first.x)}，y={f(first.y)}，ŷ={f(predict(first.x))}。<br/>残差 e=ŷ−y={f(error)}；平方 e²={f(error * error)}。训练 MSE 是所有 {train.length} 个训练点平方残差的平均。</div>}
    {!polynomial && <LossChart history={history} classification={classification}/>}
    <p className="ml-notice" role="status">{notice}</p>
    <div className="ml-task"><strong>试一试</strong><p>{lesson.labTask}</p></div>
  </section>;
}
