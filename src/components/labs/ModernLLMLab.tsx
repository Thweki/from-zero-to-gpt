import { useRef, type ReactNode } from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';
import type { ExtendedLabProps } from '../../types';
import './ModernLLMLab.css';
import {FullscreenButton} from '../FullscreenButton';

export const modernLabDefaults: Record<string, number> = {
  scalingBudget: 6, scalingParameters: 8,
  sftLogit: 1.2, sftPromptTokens: 8,
  dpoPolicyMargin: 0.5, dpoReferenceMargin: 0, dpoBeta: 0.5,
  inferenceTemperature: 1, inferenceTopK: 4, inferenceUniform: 0.8,
  cacheLength: 6, quantBits: 4, quantOutlier: 1,
  loraRank: 2, loraAlpha: 2,
  memoryParameters: 7, memoryWeightBits: 16, memoryBatch: 1, memoryContext: 2048, memoryKVHeads: 8, memoryBandwidth: 800,
  factualityThreshold: 0.6, evaluationSeen: 2, paperRuns: 5, paperEffect: 0.5,
};

const fixed = (n: number, digits = 3) => Number.isFinite(n) ? n.toFixed(digits) : '—';
const percent = (n: number | null) => n === null ? '无回答 / 无样本' : `${fixed(n * 100, 1)}%`;
const vectorText = (x: number[]) => `[${x.map(n => fixed(n, 4)).join(', ')}]`;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function stableSoftmax(logits: number[], temperature = 1): number[] {
  if (!logits.length || temperature <= 0) throw new Error('需要非空 logits 与正温度');
  const peak = Math.max(...logits);
  const weights = logits.map(z => Math.exp((z - peak) / temperature));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map(w => w / sum);
}

/** Deliberately chosen proxy coefficients; these are not measured model losses. */
export function scalingSurrogate(budgetE21: number, parametersB: number) {
  const tokensB = 1000 * budgetE21 / (6 * parametersB);
  const capacityTerm = 2.5 / parametersB ** 0.35;
  const dataTerm = 3 / tokensB ** 0.30;
  const optimumB = ((0.35 * 2.5) / (0.30 * 3) * (1000 * budgetE21 / 6) ** 0.30) ** (1 / 0.65);
  return { tokensB, capacityTerm, dataTerm, loss: 1.5 + capacityTerm + dataTerm, optimumB };
}

export function sftMaskedExample(logit: number, promptTokens: number) {
  const probabilities = stableSoftmax([logit, 0.3, -0.7]);
  const targets = [0, 1, 0];
  const losses = targets.map(t => -Math.log(probabilities[t]));
  const masked = losses.reduce((a, b) => a + b, 0) / targets.length;
  const unmasked = (masked * targets.length - promptTokens * Math.log(0.95)) / (promptTokens + targets.length);
  return { probabilities, targets, losses, masked, unmasked, gradient: probabilities.map((p, i) => p - [2 / 3, 1 / 3, 0][i]) };
}

export function dpoPreference(policyMargin: number, referenceMargin: number, beta: number) {
  const margin = policyMargin - referenceMargin;
  const z = beta * margin;
  const logistic = z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
  const loss = Math.max(-z, 0) + Math.log1p(Math.exp(-Math.abs(z)));
  const gradient = z >= 0 ? -beta * Math.exp(-z) / (1 + Math.exp(-z)) : -beta / (1 + Math.exp(z));
  return { margin, logistic, loss, gradient };
}

export function decodeDistribution(logits: number[], temperature: number, k: number, uniform: number) {
  const base = stableSoftmax(logits, temperature);
  const keep = logits.map((_, i) => i).sort((a, b) => logits[b] - logits[a]).slice(0, k);
  const mass = base.reduce((sum, p, i) => sum + (keep.includes(i) ? p : 0), 0);
  const probabilities = base.map((p, i) => keep.includes(i) ? p / mass : 0);
  let cumulative = 0;
  let selected = keep[keep.length - 1];
  for (let i = 0; i < probabilities.length; i++) {
    cumulative += probabilities[i];
    if (uniform < cumulative) { selected = i; break; }
  }
  const entropy = -probabilities.reduce((sum, p) => sum + (p > 0 ? p * Math.log(p) : 0), 0);
  return { probabilities, base, selected, entropy };
}

export function attentionRow(query: number[], keys: number[][], values: number[][]): number[] {
  const scores = keys.map(k => query.reduce((sum, q, i) => sum + q * k[i], 0) / Math.sqrt(query.length));
  const probabilities = stableSoftmax(scores);
  return values[0].map((_, j) => values.reduce((sum, v, i) => sum + probabilities[i] * v[j], 0));
}

/** Both paths really execute; full recomputes every causal row at each prefix. */
export function compareAttentionCache(length: number) {
  if (!Number.isInteger(length) || length < 1) throw new Error('长度必须为正整数');
  const inputs = Array.from({ length }, (_, i) => [Math.sin(i + 0.2), Math.cos(i + 0.7)]);
  const project = ([x, y]: number[]) => ({ q: [x + 0.2 * y, 0.5 * x - y], k: [0.7 * x + 0.1 * y, 0.3 * x + 0.9 * y], v: [x - 0.4 * y, 0.2 * x + 0.8 * y] });
  const cacheKeys: number[][] = [], cacheValues: number[][] = [];
  const steps: { position: number; full: number[]; cached: number[]; error: number }[] = [];
  let fullProjectionPositions = 0, cacheProjectionPositions = 0, fullScores = 0, cacheScores = 0;
  for (let t = 1; t <= length; t++) {
    const complete = inputs.slice(0, t).map(project);
    fullProjectionPositions += complete.length;
    const allRows = complete.map((p, j) => {
      fullScores += j + 1;
      const prefix = complete.slice(0, j + 1);
      return attentionRow(p.q, prefix.map(p => p.k), prefix.map(p => p.v));
    });
    const fresh = project(inputs[t - 1]);
    cacheProjectionPositions++;
    cacheKeys.push(fresh.k); cacheValues.push(fresh.v);
    cacheScores += cacheKeys.length;
    const cached = attentionRow(fresh.q, cacheKeys, cacheValues);
    const full = allRows[t - 1];
    const error = Math.max(...full.map((n, j) => Math.abs(n - cached[j])));
    steps.push({ position: t, full, cached, error });
  }
  return { steps, maxError: Math.max(...steps.map(s => s.error)), fullProjectionPositions, cacheProjectionPositions, fullScores, cacheScores, full: steps[length - 1].full, cached: steps[length - 1].cached };
}

export function quantizeSymmetric(values: number[], bits: number) {
  if (!Number.isInteger(bits) || bits < 2 || bits > 16) throw new Error('需要 2–16 位整数');
  const qmax = 2 ** (bits - 1) - 1;
  const peak = Math.max(0, ...values.map(Math.abs));
  const scale = peak === 0 ? 0 : peak / qmax;
  const codes = values.map(x => scale === 0 ? 0 : clamp(Math.floor(x / scale + 0.5), -qmax, qmax));
  const restored = codes.map(q => q * scale);
  const errors = values.map((x, i) => restored[i] - x);
  const mse = values.length ? errors.reduce((sum, e) => sum + e * e, 0) / values.length : 0;
  return { codes, restored, scale, errors, mse, maxError: Math.max(0, ...errors.map(Math.abs)), qmax };
}

export function matvec(matrix: number[][], x: number[]) {
  return matrix.map(row => row.reduce((sum, w, j) => sum + w * x[j], 0));
}

export function lowRankExample(rank: number, alpha: number) {
  const d = 4, k = 6;
  const a = Array.from({ length: rank }, (_, t) => Array.from({ length: k }, (_, j) => 0.25 * Math.cos((t + 1) * (j + 1))));
  const b = Array.from({ length: d }, (_, i) => Array.from({ length: rank }, (_, t) => 0.2 * Math.sin((i + 1) * (t + 1))));
  const w = Array.from({ length: d }, (_, i) => Array.from({ length: k }, (_, j) => (((i + 2) * (j + 1)) % 7 - 3) * 0.1));
  const delta = b.map(row => Array.from({ length: k }, (_, j) => alpha / rank * row.reduce((sum, v, t) => sum + v * a[t][j], 0)));
  const x = [1, -1, 0.5, 2, 0, -0.5];
  const base = matvec(w, x);
  const branch = matvec(b, matvec(a, x)).map((v, i) => base[i] + alpha / rank * v);
  const merged = matvec(w.map((row, i) => row.map((v, j) => v + delta[i][j])), x);
  const deltaOutput = matvec(delta, x);
  return { a, b, w, delta, x, base, branch, merged, deltaOutput, fullParameters: d * k, adapterParameters: rank * (d + k), maxError: Math.max(...branch.map((n, i) => Math.abs(n - merged[i]))) };
}

export interface MemoryConfig { parameters: number; weightBits: number; layers: number; batch: number; length: number; kvHeads: number; headDim: number; kvBytes: number; bandwidthGBps: number }
export function memoryAccounting(c: MemoryConfig) {
  const weights = c.parameters * c.weightBits / 8;
  const cache = 2 * c.layers * c.batch * c.length * c.kvHeads * c.headDim * c.kvBytes;
  const lowerBytes = weights + cache;
  const idealSeconds = lowerBytes / (c.bandwidthGBps * 1e9);
  return { weights, cache, lowerBytes, weightsGiB: weights / 2 ** 30, cacheGiB: cache / 2 ** 30, lowerGiB: lowerBytes / 2 ** 30, idealSeconds, idealTokensPerSecond: c.batch / idealSeconds };
}

export const factualitySamples = [
  { question: '法国首都', answer: '巴黎', key: '巴黎', score: 0.95, correct: true },
  { question: '水的化学式', answer: 'CO₂', key: 'H₂O', score: 0.90, correct: false },
  { question: '7 × 8', answer: '56', key: '56', score: 0.85, correct: true },
  { question: '太阳系最大行星', answer: '地球', key: '木星', score: 0.75, correct: false },
  { question: '一年通常几个月', answer: '12', key: '12', score: 0.65, correct: true },
  { question: 'Python 列表的括号', answer: '方括号', key: '方括号', score: 0.55, correct: true },
  { question: '2 的 5 次方', answer: '16', key: '32', score: 0.40, correct: false },
  { question: '英语 cat 的常见含义', answer: '猫', key: '猫', score: 0.20, correct: true },
];
export function selectiveCounts(threshold: number, samples: { score: number; correct: boolean }[] = factualitySamples) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const s of samples) {
    if (s.score >= threshold) { if (s.correct) tp++; else fp++; }
    else if (s.correct) fn++; else tn++;
  }
  const total = samples.length, answered = tp + fp;
  return { tp, fp, fn, tn, total, answered, precision: answered ? tp / answered : null, coverage: total ? answered / total : 0, completion: total ? tp / total : 0 };
}

export function wilsonInterval(hits: number, count: number): [number, number] | null {
  if (count === 0) return null;
  const z = 1.96, p = hits / count, denominator = 1 + z * z / count;
  const center = (p + z * z / (2 * count)) / denominator;
  const radius = z * Math.sqrt(p * (1 - p) / count + z * z / (4 * count * count)) / denominator;
  return [Math.max(0, center - radius), Math.min(1, center + radius)];
}

export function exactMatchAudit(seenCount: number) {
  const predictions = ['Paris', ' 4 ', '北京', '1939', 'unknown', 'blue', 'Tokyo', '8'];
  const targets = ['paris', '4', '北京', '1945', '42', 'blue', 'tokyo', '9'];
  const normalize = (s: string) => s.trim().toLowerCase();
  const rows = predictions.map((prediction, i) => ({ prediction, target: targets[i], seen: i < seenCount, correct: normalize(prediction) === normalize(targets[i]) }));
  const clean = rows.filter(r => !r.seen);
  const hits = clean.filter(r => r.correct).length;
  return { rows, totalHits: rows.filter(r => r.correct).length, hits, count: clean.length, cleanScore: clean.length ? hits / clean.length : null, interval: wilsonInterval(hits, clean.length) };
}

export function pairedSummary(baseline: number[], treatment: number[]) {
  if (baseline.length !== treatment.length || baseline.length < 2) throw new Error('需要至少两组对应运行');
  const differences = treatment.map((a, i) => a - baseline[i]);
  const mean = differences.reduce((sum, d) => sum + d, 0) / differences.length;
  const variance = differences.reduce((sum, d) => sum + (d - mean) ** 2, 0) / (differences.length - 1);
  const se = Math.sqrt(variance / differences.length);
  return { differences, mean, se, interval: [mean - 1.96 * se, mean + 1.96 * se] as [number, number] };
}

function Metrics({ children }: { children: ReactNode }) { return <div className="modern-metrics" aria-live="polite">{children}</div>; }
function Metric({ label, children }: { label: string; children: ReactNode }) { return <div className="modern-metric"><span>{label}</span><strong>{children}</strong></div>; }
function Table({ caption, headings, rows }: { caption: string; headings: string[]; rows: ReactNode[][] }) {
  return <div className="modern-table-wrap"><table className="modern-table"><caption>{caption}</caption><thead><tr>{headings.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
function Distribution({ values, labels }: { values: number[]; labels: string[] }) {
  return <div className="modern-distribution" aria-label="归一化概率分布">{values.map((p, i) => <div className="modern-probability" key={labels[i]}><span>{labels[i]}</span><div className="modern-bar-track"><div className="modern-bar-fill" style={{ width: `${100 * p}%` }} /></div><output>{percent(p)}</output></div>)}</div>;
}

export function ModernLLMLab({ lesson, values, onChange }: ExtendedLabProps) {
  const ref = useRef<HTMLElement>(null);
  const v = { ...modernLabDefaults };
  for (const [key, fallback] of Object.entries(v)) if (Number.isFinite(values[key])) v[key] = values[key] ?? fallback;
  const set = (key: string, value: number) => onChange({ ...values, [key]: value });
  const range = (key: string, label: string, min: number, max: number, step = 1) => {
    const current = Number((min + Math.round((clamp(v[key], min, max) - min) / step) * step).toFixed(6));
    v[key] = current;
    return <label className="modern-range" key={key}><span>{label}<output>{Number(current.toFixed(3))}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={current} onChange={e => set(key, Number(e.target.value))} /><small>{min} — {max}</small></label>;
  };
  const select = (key: string, label: string, choices: number[]) => {
    if (!choices.includes(v[key])) v[key] = modernLabDefaults[key];
    return <label className="modern-select" key={key}><span>{label}</span><select aria-label={label} value={v[key]} onChange={e => set(key, Number(e.target.value))}>{choices.map(n => <option value={n} key={n}>{n}</option>)}</select></label>;
  };
  let title = '', assumption = '', controls: ReactNode = null, content: ReactNode = null;

  if (lesson.id === 'pretraining-scaling') {
    title = '预算约束下的教学代理曲线';
    assumption = '非实测：C≈6ND；代理 L=1.5+2.5/N^0.35+3/D^0.30。N、D 用十亿单位，常数仅为教学选择。';
    controls = <>{range('scalingBudget', '计算预算 / 10²¹ FLOPs', 1, 24, 0.5)}{range('scalingParameters', '参数量 / 十亿', 0.5, 32, 0.5)}</>;
    const r = scalingSurrogate(v.scalingBudget, v.scalingParameters);
    const samples = Array.from({ length: 100 }, (_, i) => ({ n: 0.5 + i * 31.5 / 99, loss: scalingSurrogate(v.scalingBudget, 0.5 + i * 31.5 / 99).loss }));
    const low = Math.min(...samples.map(p => p.loss)) - 0.05, high = Math.max(...samples.map(p => p.loss)) + 0.05;
    const x = (n: number) => 45 + (n - 0.5) / 31.5 * 495, y = (loss: number) => 175 - (loss - low) / (high - low) * 140;
    content = <><svg className="modern-chart" viewBox="0 0 580 225" role="img" aria-label={`代理损失曲线，当前参数 ${v.scalingParameters}B，代理值 ${fixed(r.loss)}`}><path d="M45 25V175H550" className="modern-axis" /><polyline className="modern-curve" points={samples.map(p => `${x(p.n)},${y(p.loss)}`).join(' ')} /><circle cx={x(v.scalingParameters)} cy={y(r.loss)} r="5" className="modern-dot" /><text x="45" y="200">0.5B</text><text x="500" y="200">32B 参数</text><text x="48" y="19">代理损失（越低越好）</text><text x="48" y="218">仅在假设公式内比较；曲线不是模型测量。</text></svg><Metrics><Metric label="可训练 Token / 十亿">{fixed(r.tokensB, 1)}</Metric><Metric label="代理损失">{fixed(r.loss, 4)}</Metric><Metric label="容量项 + 数据项">{fixed(r.capacityTerm)} + {fixed(r.dataTerm)}</Metric><Metric label="公式内部最优参数 / B">{fixed(r.optimumB, 2)}</Metric></Metrics></>;
  } else if (lesson.id === 'instruction-sft') {
    title = '回复标签与掩码交叉熵';
    assumption = '精确教学小算例：共享 logits=[z,0.3,−0.7]，回复目标=[0,1,0]；提示正确概率预设为 0.95。没有训练模型。';
    controls = <>{range('sftLogit', '候选 0 的 logit z', -2, 4, 0.1)}{range('sftPromptTokens', '提示 Token 数', 2, 20)}</>;
    const r = sftMaskedExample(v.sftLogit, v.sftPromptTokens);
    content = <><Distribution values={r.probabilities} labels={['候选 0', '候选 1', '候选 2']} /><Table caption="三个受监督回复位置（提示位置 mask=0）" headings={['回复位置', '目标编号', '目标概率', '负对数损失']} rows={r.targets.map((t, i) => [i + 1, t, fixed(r.probabilities[t]), fixed(r.losses[i])])} /><Metrics><Metric label="回复掩码平均 NLL">{fixed(r.masked, 4)}</Metric><Metric label="全序列未掩码平均 NLL">{fixed(r.unmasked, 4)}</Metric><Metric label="回复平均 logit 梯度 p−频率">{vectorText(r.gradient)}</Metric></Metrics></>;
  } else if (lesson.id === 'rlhf-dpo') {
    title = 'DPO 偏好损失与真实标量梯度';
    assumption = '教学算例精确计算 logistic 目标，输入是序列对数比；一步标量更新不是实际语言模型训练，也不表示事实正确率。';
    controls = <>{range('dpoPolicyMargin', '当前 chosen/rejected 对数比', -4, 4, 0.1)}{range('dpoReferenceMargin', '参考 chosen/rejected 对数比', -4, 4, 0.1)}{range('dpoBeta', 'β', 0.1, 2, 0.1)}</>;
    const r = dpoPreference(v.dpoPolicyMargin, v.dpoReferenceMargin, v.dpoBeta);
    const nextPolicy = v.dpoPolicyMargin - 0.5 * r.gradient;
    const next = dpoPreference(nextPolicy, v.dpoReferenceMargin, v.dpoBeta);
    content = <><Distribution values={[r.logistic, 1 - r.logistic]} labels={['偏好模型 P(chosen)', '偏好模型 P(rejected)']} /><Metrics><Metric label="调整后 margin">{fixed(r.margin)}</Metric><Metric label="DPO 损失">{fixed(r.loss, 5)}</Metric><Metric label="∂损失 / ∂当前对数比">{fixed(r.gradient, 5)}</Metric><Metric label="η=0.5 一步后损失">{fixed(next.loss, 5)}</Metric></Metrics><p className="modern-detail">一步更新：当前对数比 {fixed(v.dpoPolicyMargin)} − 0.5 × ({fixed(r.gradient)}) = {fixed(nextPolicy)}。参考保持固定。显示的是目标的偏好概率，不是答案真实质量。</p></>;
  } else if (lesson.id === 'inference') {
    title = '固定 logits 的解码与采样';
    assumption = '教学候选 logits=[2,1,0.2,−0.7]，未调用模型；u 是显式均匀数，所有概率与选择由当前设置重新计算。';
    controls = <>{range('inferenceTemperature', '温度 T', 0.1, 2, 0.1)}{range('inferenceTopK', '保留候选 k', 1, 4)}{range('inferenceUniform', '采样均匀数 u', 0, 0.999, 0.001)}</>;
    const r = decodeDistribution([2, 1, 0.2, -0.7], v.inferenceTemperature, v.inferenceTopK, v.inferenceUniform);
    const labels = ['候选甲', '候选乙', '候选丙', '候选丁'];
    content = <><div className="modern-flow"><span>提示 → prefill</span><span>最后位置 logits</span><span>温度 → top-k → 采样</span><span>追加 Token → decode ↻</span></div><Distribution values={r.probabilities} labels={labels} /><Metrics><Metric label="本步选中">{labels[r.selected]}</Metric><Metric label="截断后概率和">{fixed(r.probabilities.reduce((a, b) => a + b, 0), 6)}</Metric><Metric label="分布熵 / nats">{fixed(r.entropy, 4)}</Metric></Metrics><Table caption="温度变换与 top-k 截断前后" headings={['候选', 'logit', '截断前概率', '截断后概率']} rows={labels.map((label, i) => [label, [2, 1, 0.2, -0.7][i], percent(r.base[i]), percent(r.probabilities[i])])} /></>;
  } else if (lesson.id === 'kv-cache') {
    title = '完整因果前缀 vs 增量 K/V 缓存';
    assumption = '实际执行二维、单层、单头教学注意力；固定投影与输入，完整路径每个前缀重算全部因果行。计数是算法操作次数，不是时间。';
    controls = range('cacheLength', '连续增量位置 T', 2, 12);
    const r = compareAttentionCache(v.cacheLength);
    content = <><Metrics><Metric label="所有步最大输出绝对差">{r.maxError.toExponential(2)}</Metric><Metric label="完整 / 缓存 投影位置数">{r.fullProjectionPositions} / {r.cacheProjectionPositions}</Metric><Metric label="完整 / 缓存 分数点积次数">{r.fullScores} / {r.cacheScores}</Metric></Metrics><Table caption="每个前缀最后位置的输出（每位置各计算 Q/K/V 一次）" headings={['位置', '完整输出', '缓存输出', '最大绝对差']} rows={r.steps.map(s => [s.position, vectorText(s.full), vectorText(s.cached), s.error.toExponential(1)])} /><p className="modern-detail">完整版本反复计算旧输出；缓存版本只算新 Query，但仍需读取所有历史 Key、Value。两条路径确实分别运行，输出相同是本例的正确性检查。</p></>;
  } else if (lesson.id === 'quantization') {
    title = '对称量化、重建与异常值';
    assumption = '教学算例实际量化七个数；共享 absmax 尺度，整数范围 ±(2^(b−1)−1)，半格舍入采用 floor(x/s+0.5)。MSE 不是模型任务得分。';
    controls = <>{range('quantBits', '权重位数 b', 2, 8)}{range('quantOutlier', '最后一项的异常值倍率', 1, 10, 0.5)}</>;
    const xs = [-1.2, -0.65, -0.12, 0.05, 0.33, 0.8, 1.25 * v.quantOutlier];
    const r = quantizeSymmetric(xs, v.quantBits);
    content = <><Metrics><Metric label="共享尺度 s">{fixed(r.scale, 5)}</Metric><Metric label="重建 MSE">{fixed(r.mse, 6)}</Metric><Metric label="最大误差 / s÷2">{fixed(r.maxError, 4)} / {fixed(r.scale / 2, 4)}</Metric><Metric label="编码格点数">{2 * r.qmax + 1}</Metric></Metrics><Table caption="每个原值真实量化后再重建" headings={['原值 x', '整数 q', '反量化 x̂', 'x̂−x']} rows={xs.map((x, i) => [fixed(x), r.codes[i], fixed(r.restored[i], 5), fixed(r.errors[i], 5)])} /><div className="modern-error-bars" aria-label="各元素绝对重建误差">{r.errors.map((e, i) => <div key={i}><span>x{i + 1}</span><div className="modern-bar-track"><div className="modern-bar-fill" style={{ width: `${r.scale ? 100 * Math.abs(e) / (r.scale / 2) : 0}%` }} /></div><output>{fixed(Math.abs(e), 4)}</output></div>)}</div><p className="modern-detail">条长以理论误差界 s/2 为 100%。量化尺度、元数据、实际整数内核和端到端质量不在这个七元素算例中。</p></>;
  } else if (lesson.id === 'lora') {
    title = '实际低秩矩阵增量与合并检查';
    assumption = '教学矩阵 W 为 4×6，A、B 由确定函数生成，输入固定；没有训练或任务质量测量。ΔW=(α/r)BA。';
    controls = <>{range('loraRank', '适配器秩 r', 1, 3)}{range('loraAlpha', '缩放 α', 0, 8, 0.5)}</>;
    const r = lowRankExample(v.loraRank, v.loraAlpha);
    content = <><div className="modern-matrix" role="img" aria-label="4 行 6 列的低秩增量矩阵">{r.delta.map((row, i) => <div key={i}>{row.map((value, j) => <span key={j} style={{ backgroundColor: `color-mix(in srgb, var(--accent) ${Math.min(75, Math.abs(value) * 160 + 5)}%, var(--panel))` }}>{fixed(value, 3)}</span>)}</div>)}</div><Metrics><Metric label="完整 / 适配器可训练参数">{r.fullParameters} / {r.adapterParameters}</Metric><Metric label="适配器参数相对完整矩阵">{percent(r.adapterParameters / r.fullParameters)}</Metric><Metric label="合并与支路最大输出差">{r.maxError.toExponential(2)}</Metric></Metrics><Table caption={`输入 x=${vectorText(r.x)}；矩阵格子展示 ΔW 的真实元素`} headings={['输出维', '基座 Wx', '增量 ΔWx', '合并输出', '分支输出']} rows={r.base.map((n, i) => [i + 1, fixed(n, 4), fixed(r.deltaOutput[i], 4), fixed(r.merged[i], 4), fixed(r.branch[i], 4)])} /><p className="modern-detail">节省条件 r &lt; dk/(d+k)=2.4。本例 r=3 时适配器反而更多；冻结基座仍需保存原权重。</p></>;
  } else if (lesson.id === 'memory-performance') {
    title = '推理字节账单与理想带宽界';
    assumption = '容量下界：独立教学架构 L=32、头维=128、KV 每元素 2 字节。忽略量化元数据、临时激活、碎片和运行时空间；无硬件计时。';
    controls = <>{range('memoryParameters', '参数量 / 十亿', 1, 32)}{select('memoryWeightBits', '权重位数', [4, 8, 16])}{range('memoryBatch', '批量 B', 1, 16)}{range('memoryContext', '上下文长度 T', 128, 8192, 128)}{range('memoryKVHeads', 'KV 头数', 1, 16)}{range('memoryBandwidth', '假设有效带宽 / GB/s', 100, 2000, 50)}</>;
    const r = memoryAccounting({ parameters: v.memoryParameters * 1e9, weightBits: v.memoryWeightBits, layers: 32, batch: v.memoryBatch, length: v.memoryContext, kvHeads: v.memoryKVHeads, headDim: 128, kvBytes: 2, bandwidthGBps: v.memoryBandwidth });
    content = <><Metrics><Metric label="理想权重 / GiB">{fixed(r.weightsGiB, 3)}</Metric><Metric label="KV 缓存 / GiB">{fixed(r.cacheGiB, 3)}</Metric><Metric label="两项容量下界 / GiB">{fixed(r.lowerGiB, 3)}</Metric><Metric label="理想字节传输时间下界 / ms">{fixed(r.idealSeconds * 1000, 3)}</Metric><Metric label="该访存假设的吞吐上界 / tok/s">{fixed(r.idealTokensPerSecond, 1)}</Metric></Metrics><Distribution values={[r.weights / r.lowerBytes, r.cache / r.lowerBytes]} labels={['权重字节占两项比例', 'KV 字节占两项比例']} /><Table caption="原始字节数，1 GiB=2³⁰ 字节；带宽使用 10⁹ 字节/s" headings={['项目', '字节', '公式']} rows={[[`权重 ${v.memoryWeightBits} 位`, r.weights.toLocaleString('en-US'), '参数 × 位数 ÷ 8'], ['KV 16 位', r.cache.toLocaleString('en-US'), `2 × 32 × ${v.memoryBatch} × ${v.memoryContext} × ${v.memoryKVHeads} × 128 × 2`]]} /><p className="modern-detail">理想 decode 每步读一次全部权重和当前 KV，产生 B 枚 Token。真实时间还受计算、缓存命中、调度和通信影响，页面数字不能用作 GPU 性能测量。</p></>;
  } else if (lesson.id === 'hallucination') {
    title = '预设候选的回答覆盖率与事实精度';
    assumption = '八条教学候选的对错有显式答案键；分数为人为预设且未校准，不是任何语言模型输出。拒答样本的潜在对错由本例 oracle 提供。';
    controls = range('factualityThreshold', '回答阈值（分数 ≥ 阈值）', 0, 1, 0.05);
    const r = selectiveCounts(v.factualityThreshold);
    content = <><Metrics><Metric label="回答精度">{percent(r.precision)}</Metric><Metric label="回答覆盖率">{percent(r.coverage)}</Metric><Metric label="正确完成 / 全部样本">{percent(r.completion)}</Metric></Metrics><Table caption="选择器混淆表（正类=预设潜在正确）" headings={['动作', '潜在正确', '潜在错误']} rows={[["回答", `TP=${r.tp}`, `FP=${r.fp}`], ['拒答', `FN=${r.fn}`, `TN=${r.tn}`]]} /><Table caption="预设候选逐条审计；高分也可能错误" headings={['问题', '候选 → 答案键', '预设分数', '潜在对错', '动作']} rows={factualitySamples.map(s => [s.question, `${s.answer} → ${s.key}`, s.score.toFixed(2), s.correct ? '对' : '错', s.score >= v.factualityThreshold ? '回答' : '拒答'])} /></>;
  } else if (lesson.id === 'llm-evaluation') {
    title = '评估分组、简单匹配与小样本区间';
    assumption = '八组预测与答案均为预设教学记录；标记前 n 条为疑似已见，仅改变审计子集，不模拟训练污染的因果效应。';
    controls = range('evaluationSeen', '疑似已见样本数（从表头起）', 0, 8);
    const r = exactMatchAudit(v.evaluationSeen);
    content = <><Metrics><Metric label="全部样本精确匹配">{r.totalHits}/8 = {percent(r.totalHits / 8)}</Metric><Metric label="清洁子集精确匹配">{r.hits}/{r.count} = {percent(r.cleanScore)}</Metric><Metric label="清洁子集 Wilson 95% 区间">{r.interval ? `${percent(r.interval[0])} ～ ${percent(r.interval[1])}` : '无清洁样本'}</Metric></Metrics><Table caption="规范化规则：去首尾空白 + 转小写，不是语义或事实判断器" headings={['编号', '预测（引号保留空白）', '参考', '匹配', '审计分组']} rows={r.rows.map((s, i) => [i + 1, `“${s.prediction}”`, s.target, s.correct ? '1' : '0', s.seen ? '疑似已见，移出子集' : '清洁子集'])} /><p className="modern-detail">区间假设独立、代表性二项样本。子集分差可能来自题目组成和难度，不能直接解释为记忆收益；未标记不代表已证明无污染。</p></>;
  } else {
    title = '合成配对消融记录与不确定性';
    assumption = '全部是明确构造的合成分数，非任何论文或模型测量；95% 区间只用 Δ±1.96SE 的正态近似，小样本正式分析需更适合的方法。';
    controls = <>{range('paperRuns', '配对记录数 n', 2, 8)}{range('paperEffect', '教学附加效应 / 分', -2, 4, 0.25)}</>;
    const baseline = [68, 72, 71, 69, 73, 70, 74, 68].slice(0, v.paperRuns);
    const noise = [0.5, 1, -0.5, 2, 0, 1.5, -1, 0.5];
    const treatment = baseline.map((b, i) => b + v.paperEffect + noise[i]);
    const r = pairedSummary(baseline, treatment);
    content = <><Metrics><Metric label="配对均值差 / 分">{fixed(r.mean, 4)}</Metric><Metric label="差值均值的标准误">{fixed(r.se, 4)}</Metric><Metric label="正态近似教学区间">[{fixed(r.interval[0], 3)}, {fixed(r.interval[1], 3)}]</Metric></Metrics><Table caption="合成配对记录：共享运行条件，一次只比较一项改动" headings={['记录', '基线分数', '改动分数', '配对差']} rows={baseline.map((b, i) => [i + 1, b, treatment[i], fixed(r.differences[i], 3)])} /><p className="modern-detail">没有真实实验被执行。正式复现还需固定数据、模型版本、预算、随机种子、评测脚本，并记录每次运行日志与失败案例。</p></>;
  }

  return <section ref={ref} className="modern-lab" aria-label={`${lesson.title}交互实验`} data-modern-lesson={lesson.id}>
    <div className="modern-header"><span><FlaskConical size={16} />计算实验 <small>LIVE</small></span><div><button type="button" aria-label="重置现代 LLM 实验参数" onClick={() => onChange({ ...modernLabDefaults })}><RotateCcw size={16} /></button><FullscreenButton target={ref} label="全屏现代 LLM 实验"/></div></div>
    <div className="modern-heading"><h3>{title}</h3><p>{assumption}</p></div>
    <div className="modern-layout"><div className="modern-controls">{controls}</div><div className="modern-results" data-testid="modern-lab-results">{content}</div></div>
    <div className="modern-task"><strong>试一试</strong><p>{lesson.labTask}</p></div>
  </section>;
}
