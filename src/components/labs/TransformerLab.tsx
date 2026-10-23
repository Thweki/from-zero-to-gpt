import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { ExtendedLabProps } from '../../types';
import './TransformerLab.css';

export type Matrix = number[][];
const initialEmbedding = [[1, 0, .5], [0, 1, -.5], [-1, .5, 1], [.5, -1, 0], [.2, .7, -.8], [-.6, -.4, .9]];
const initialQ = [[1, 0], [0, 1], [.5, -.5]];
const initialK = [[.7, -.2], [.3, 1], [-.5, .4]];
const initialV = [[1, .2], [-.3, 1], [.5, -.5]];
export const transformerDefaults: Record<string, number> = {
  tfScale: Math.SQRT2, tfMask: 0, tfPos: 0, tfHead: 0, tfStep: 4, tfRow: 0,
  tfEpsilon: .00001, tfGamma: 1, tfBeta: 0, tfRnn: .8, tfResidual: 1, tfMode: 0,
  tfNormSource: 0,
};
for (const [prefix, rows] of [['E', initialEmbedding], ['Q', initialQ], ['K', initialK], ['V', initialV]] as const) {
  rows.forEach((row, i) => row.forEach((x, j) => { transformerDefaults[`tf${prefix}${i}${j}`] = x; }));
}
export const transformerRanges: Record<string, readonly [number, number]> = Object.fromEntries(Object.keys(transformerDefaults).map(key => [key, [-5, 5]]));
Object.assign(transformerRanges, {
  tfScale: [.25, 4], tfMask: [0, 1], tfPos: [0, 1], tfHead: [0, 1], tfStep: [0, 8], tfRow: [0, 5],
  tfEpsilon: [.00001, 1], tfGamma: [-2, 2], tfBeta: [-2, 2], tfRnn: [-1, 1], tfResidual: [0, 2], tfMode: [0, 2], tfNormSource: [0, 1],
});
const integerKeys = new Set(['tfMask', 'tfPos', 'tfHead', 'tfStep', 'tfRow', 'tfMode', 'tfNormSource']);
export function sanitizeTransformerValues(values: Record<string, number>) {
  const result: Record<string, number> = {};
  for (const [key, x] of Object.entries(values)) {
    if (!Object.hasOwn(transformerDefaults, key) || !Number.isFinite(x)) continue;
    const [min, max] = transformerRanges[key];
    const bounded = Math.max(min, Math.min(max, x));
    result[key] = integerKeys.has(key) ? Math.round(bounded) : bounded;
  }
  return result;
}

/** A deterministic, sample-local Unicode code-point tokenizer, not a production tokenizer. */
export function tokenizeCharacters(text: string, limit = 6) {
  const all = Array.from(text);
  const tokens = all.slice(0, limit);
  const vocabulary = [...new Set(tokens)].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);
  return { tokens, vocabulary, ids: tokens.map(token => vocabulary.indexOf(token)), omitted: all.length - tokens.length };
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  if (!a.length) return [];
  if (!b.length || a.some(row => row.length !== b.length) || b.some(row => row.length !== b[0].length)) {
    throw new Error('矩阵乘法形状不匹配');
  }
  return a.map(row => b[0].map((_, j) => row.reduce((s, x, k) => s + x * b[k][j], 0)));
}

export function stableSoftmax(scores: number[], allowed = scores.map(() => true)): number[] {
  if (!scores.length || allowed.length !== scores.length || scores.some(x => !Number.isFinite(x))) throw new Error('需要有限分数与匹配掩码');
  const valid = scores.filter((_, j) => allowed[j]);
  if (!valid.length) throw new Error('所有位置均被屏蔽，分布没有定义');
  const maximum = Math.max(...valid);
  const exps = scores.map((s, j) => allowed[j] ? Math.exp(s - maximum) : 0);
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map(x => x / total);
}

export function attentionFromQKV(q: Matrix, k: Matrix, value: Matrix, divisor: number, causal: boolean) {
  if (!q.length || !k.length || k.length !== value.length || divisor <= 0 || !Number.isFinite(divisor)) throw new Error('注意力输入不合法');
  if (q.some(row => row.length !== k[0].length) || k.some(row => row.length !== k[0].length)) throw new Error('查询键宽度必须相同');
  const scores = q.map(query => k.map(key => query.reduce((s, x, d) => s + x * key[d], 0)));
  const scaled = scores.map(row => row.map(x => x / divisor));
  const weights = scaled.map((row, i) => stableSoftmax(row, row.map((_, j) => !causal || j <= i)));
  return { scores, scaled, weights, output: multiply(weights, value) };
}

export function layerNormalize(x: number[], epsilon = 1e-5, gamma = 1, beta = 0) {
  if (!x.length || epsilon <= 0 || !Number.isFinite(epsilon)) throw new Error('LayerNorm 需要非空向量和正 epsilon');
  const mean = x.reduce((a, b) => a + b, 0) / x.length;
  const variance = x.reduce((s, v) => s + (v - mean) ** 2, 0) / x.length;
  const normalized = x.map(v => (v - mean) / Math.sqrt(variance + epsilon));
  return { mean, variance, normalized, output: normalized.map(v => gamma * v + beta) };
}

export function sinusoidalPosition(position: number, width: number) {
  return Array.from({ length: width }, (_, j) => {
    const angle = position / 10000 ** (2 * Math.floor(j / 2) / width);
    return j % 2 === 0 ? Math.sin(angle) : Math.cos(angle);
  });
}

const rounded = (x: number) => Math.abs(x) < 1e-10 ? '0' : Number(x.toFixed(4)).toString();
const vector = (row: number[]) => `[${row.map(rounded).join(', ')}]`;
const labelToken = (t: string) => t === ' ' ? '空格' : t === '\n' ? '换行' : t === '\t' ? '制表' : t;
const steps = ['Token', 'Embedding', 'Q / K / V', '分数与缩放', 'Softmax', '汇聚与多头', '残差', 'LayerNorm', '玩具前馈与词表'];
const focus: Record<string, number> = { 'text-representation': 0, tokenization: 0, embeddings: 1, 'rnn-lstm': 1, softmax: 4, attention: 5, qkv: 2, 'scaled-attention': 3, 'self-attention': 4, 'multi-head': 5, positions: 1, residual: 6, layernorm: 7, 'encoder-decoder': 2, 'causal-mask': 4, 'decoder-only': 8 };

function MatrixView({ title, rows, rowLabels, columnLabels, heat = false, masked }: { title: string; rows: Matrix; rowLabels?: string[]; columnLabels?: string[]; heat?: boolean; masked?: boolean[][] }) {
  return <div className="tf-matrix"><div className="tf-matrix-heading"><strong>{title}</strong><span>[{rows.length}, {rows[0]?.length ?? 0}]</span></div><div className="tf-table-scroll" tabIndex={0} aria-label={`${title} 数据表，可横向滚动`}><table><caption className="visually-hidden">{title}，形状 {rows.length} 行 {rows[0]?.length ?? 0} 列</caption><thead><tr><th scope="col">位置</th>{rows[0]?.map((_, j) => <th scope="col" key={j}>{columnLabels?.[j] ?? `d${j}`}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}><th scope="row">{rowLabels?.[i] ?? i}</th>{row.map((x, j) => <td key={j} title={masked?.[i]?.[j] ? '未来位置，权重严格为 0' : String(x)} className={masked?.[i]?.[j] ? 'tf-masked' : heat ? 'tf-heat' : ''} style={heat && !masked?.[i]?.[j] ? { '--tf-weight': x } as CSSProperties : undefined}>{masked?.[i]?.[j] ? <><span>0</span><small>屏蔽</small></> : rounded(x)}</td>)}</tr>)}</tbody></table></div></div>;
}

export function TransformerLab({ lesson, values, onChange }: ExtendedLabProps) {
  const [text, setText] = useState('我爱学习');
  const causalLesson = lesson.id === 'causal-mask' || lesson.id === 'decoder-only';
  const defaults: Record<string, number> = { ...transformerDefaults, tfStep: focus[lesson.id] ?? 4, tfMask: causalLesson ? 1 : 0, tfPos: lesson.id === 'positions' ? 1 : 0, tfMode: lesson.id === 'encoder-decoder' ? 2 : causalLesson ? 1 : 0 };
  const v: Record<string, number> = { ...defaults, ...sanitizeTransformerValues(values) };
  const set = (key: string, n: number) => { if (Number.isFinite(n)) onChange({ ...v, [key]: n }); };
  const data = tokenizeCharacters(text);
  const embedding = initialEmbedding.map((row, i) => row.map((_, j) => v[`tfE${i}${j}`]));
  const readWeight = (prefix: string) => initialQ.map((row, i) => row.map((_, j) => v[`tf${prefix}${i}${j}`]));
  const wq = readWeight('Q'), wk = readWeight('K'), wv = readWeight('V');
  const x = data.ids.map((id, i) => embedding[id].map((e, j) => e + (v.tfPos ? sinusoidalPosition(i, 3)[j] : 0)));
  const cross = v.tfMode === 2;
  const source = x.length ? x : [[0, 0, 0]];
  const queryInput = cross ? source.slice(0, 2) : source;
  const headWeights = v.tfHead === 1 ? { q: wq.map(([a, b]) => [-b, a]), k: wk.map(([a, b]) => [b, a]), v: wv.map(([a, b]) => [b, -a]) } : { q: wq, k: wk, v: wv };
  const q = multiply(queryInput, headWeights.q), k = multiply(source, headWeights.k), val = multiply(source, headWeights.v);
  const causal = !cross && (v.tfMode === 1 || v.tfMask === 1);
  const result = attentionFromQKV(q, k, val, Math.max(.1, v.tfScale), causal);
  const computeHead = (second: boolean) => attentionFromQKV(multiply(queryInput, second ? wq.map(([a, b]) => [-b, a]) : wq), multiply(source, second ? wk.map(([a, b]) => [b, a]) : wk), multiply(source, second ? wv.map(([a, b]) => [b, -a]) : wv), Math.max(.1, v.tfScale), causal).output;
  const first = computeHead(false), second = computeHead(true);
  const joined = first.map((row, i) => [...row, ...second[i]]);
  const wo = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [.5, .5, .5]];
  const update = multiply(joined, wo);
  const residual = queryInput.map((row, i) => row.map((a, j) => a + v.tfResidual * update[i][j]));
  const normInput = v.tfNormSource === 1 ? residual : queryInput;
  const normalized = normInput.map(row => layerNormalize(row, v.tfEpsilon, v.tfGamma, v.tfBeta));
  const wi = [[1, 0, -1, .5], [0, 1, .5, -1], [.5, -.5, 1, 0]];
  const wf = [[.5, 0, 0], [0, .5, 0], [0, 0, .5], [.2, -.2, .2]];
  const blockNormalized = residual.map(r => layerNormalize(r, v.tfEpsilon, v.tfGamma, v.tfBeta).output);
  const ffn = multiply(multiply(blockNormalized, wi).map(row => row.map(a => Math.max(0, a))), wf);
  const finalHidden = residual.map((row, i) => row.map((a, j) => a + ffn[i][j]));
  const logits = finalHidden.map(row => data.vocabulary.map((_, id) => row.reduce((s, a, j) => s + a * embedding[id][j], 0)));
  const row = Math.max(0, Math.min(queryInput.length - 1, Math.round(v.tfRow)));
  const step = Math.max(0, Math.min(8, Math.round(v.tfStep)));
  const labels = data.tokens.map((t, i) => `${i}·${labelToken(t)}`);
  const queryLabels = labels.slice(0, queryInput.length);
  const masked = result.weights.map((r, i) => r.map((_, j) => causal && j > i));
  const range = (key: string, label: string, min: number, max: number, increment: number | 'any') => <label className="tf-range"><span>{label}<output>{rounded(v[key])}</output></span><input aria-label={label} type="range" min={min} max={max} step={increment} value={v[key]} onChange={e => set(key, Number(e.target.value))} /></label>;
  const editor = (prefix: string, title: string, matrix: Matrix, names?: string[]) => <fieldset className="tf-editor"><legend>{title} [{matrix.length}, {matrix[0].length}]</legend><div className="tf-table-scroll"><table><thead><tr><th scope="col">行</th>{matrix[0].map((_, j) => <th scope="col" key={j}>d{j}</th>)}</tr></thead><tbody>{matrix.map((r, i) => <tr key={i}><th scope="row">{names?.[i] ?? i}</th>{r.map((n, j) => <td key={j}><input aria-label={`${title} 第${i}行第${j}列`} type="number" min={-5} max={5} step={.1} value={n} onChange={e => { if (e.target.value !== '') set(`tf${prefix}${i}${j}`, Math.max(-5, Math.min(5, Number(e.target.value)))); }} /></td>)}</tr>)}</tbody></table></div></fieldset>;
  const extent = Math.max(1.5, ...embedding.slice(0, data.vocabulary.length).flatMap(e => e.slice(0, 2).map(Math.abs)));
  const px = (a: number) => 130 + a / extent * 100;
  const py = (a: number) => 100 - a / extent * 75;
  let h = 0;
  const states = x.map(r => { h = Math.tanh(r[0] + v.tfRnn * h); return [r[0], h]; });
  return <section className="tf-lab" aria-label={`${lesson.title} 的实时 Transformer 实验`}>
    <header className="tf-header"><div><strong>数值实验室</strong><span>LIVE · 所有矩阵实时计算</span></div><button type="button" onClick={() => { onChange({ ...defaults }); setText('我爱学习'); }}>重置实验</button></header>
    <div className="tf-content"><p className="tf-notice">这是未训练的三维玩具模型，用于检查计算。按当前样本的 Unicode 码点排序建立字符表，最多计算前 6 个码点；它不是任何商业模型的 Tokenizer，向量不带预训练语义。样本文本仅在本次页面内保留，数值参数随学习进度保存。</p>
      <label className="tf-text-label">样本文本<input type="text" aria-label="Transformer 样本文本" value={text} maxLength={80} onChange={e => setText(e.target.value)} /></label>
      {!data.tokens.length ? <p className="tf-empty">输入至少一个字符后计算。空序列没有可以归一化的注意力行。</p> : <>
      {data.omitted > 0 && <p className="tf-notice">为便于逐项核对，已截取前 6 个 Unicode 码点，另有 {data.omitted} 个未参与计算。</p>}
      <div className="tf-controls"><label>信息流<select aria-label="Transformer 信息流" value={v.tfMode} onChange={e => onChange({ ...v, tfMode: Number(e.target.value), tfMask: Number(e.target.value) === 1 ? 1 : 0 })}><option value={0}>源自注意力 · 所有位置</option><option value={1}>目标自注意力 · 因果前缀</option><option value={2}>交叉注意力 · 前两行查询读全部源</option></select></label><label>观察查询行<select aria-label="观察查询行" value={row} onChange={e => set('tfRow', Number(e.target.value))}>{queryLabels.map((s, i) => <option key={i} value={i}>{s}</option>)}</select></label><label>显示注意力头<select aria-label="显示注意力头" value={v.tfHead} onChange={e => set('tfHead', Number(e.target.value))}><option value={0}>头 1 · 基础投影</option><option value={1}>头 2 · 列变换投影</option></select></label></div>
      <div className="tf-toggles"><label><input type="checkbox" checked={v.tfPos === 1} onChange={e => set('tfPos', e.target.checked ? 1 : 0)} />加入正弦位置向量</label><label><input type="checkbox" checked={causal} disabled={cross || v.tfMode === 1} onChange={e => set('tfMask', e.target.checked ? 1 : 0)} />因果掩码（未来严格为零）</label></div>
      {cross && <p className="tf-notice">交叉示意：目标查询明确取 X 的前两行，源记忆取全部 X，数值同源只为便于核对；它不代表训练好的翻译编码器。交叉矩阵按源轴归一化，不使用因果三角形。</p>}
      <nav className="tf-flow" aria-label="选择 Transformer 计算步骤">{steps.map((s, i) => <button type="button" aria-pressed={step === i} key={s} onClick={() => set('tfStep', i)}><span>{i + 1}</span>{s}</button>)}</nav>
      <div className="tf-shapes" aria-label="本次计算张量形状"><span>I [{data.ids.length}]</span><span>X [{source.length},3]</span><span>Q [{q.length},2]</span><span>K/V [{k.length},2]</span><span>A [{q.length},{k.length}]</span><span>O [{q.length},2]</span><span>拼接 [{q.length},4]</span><span>投回 [{q.length},3]</span></div>
      <div className="tf-step" aria-live="polite">
        {step === 0 && <><h4>字符 → 身份编号</h4><div className="tf-tokens">{data.tokens.map((t, i) => <div key={i}><small>位置 {i}</small><strong>{labelToken(t)}</strong><span>ID {data.ids[i]}</span></div>)}</div><p>词表：{data.vocabulary.map((t, i) => `${labelToken(t)}→${i}`).join('，')}。同样文本稳定复现；新增字符可能重新编号，训练时必须另行冻结词表。</p><p>编号形状 [{data.ids.length}]；查表后才有特征轴 [{data.ids.length},3]。这里保留空格、顺序和重复项。</p></>}
        {step === 1 && <><h4>查表与位置</h4><div className="tf-two"><div>{editor('E', 'Embedding E', embedding.slice(0, data.vocabulary.length), data.vocabulary.map(labelToken))}<p>这张表未训练。编辑的行按 ID 保存；改变词表会让同一行对应不同字符。</p></div><div className="tf-projection"><svg viewBox="0 0 260 205" role="img" aria-label="可编辑 Embedding 前两个维度的投影"><path d="M15 100H245M130 12V190" stroke="var(--border)" /><text x="238" y="92">d0</text><text x="135" y="18">d1</text>{data.vocabulary.map((t, i) => <g key={t}><line x1="130" y1="100" x2={px(embedding[i][0])} y2={py(embedding[i][1])} stroke="var(--accent)" /><circle cx={px(embedding[i][0])} cy={py(embedding[i][1])} r="4" fill="var(--accent)" /><text x={px(embedding[i][0]) + 6} y={py(embedding[i][1]) - 6}>{labelToken(t)}</text></g>)}</svg><p>二维投影仅画 d0、d1；d2 仍参与计算。两轴刻度：横 ±{rounded(extent)}，纵 ±{rounded(extent * 4 / 3)}。</p></div></div><div className="tf-two"><MatrixView title="位置向量 PE" rows={source.map((_, i) => sinusoidalPosition(i, 3))} rowLabels={labels} /><MatrixView title={v.tfPos ? 'X = E[I] + PE' : 'X = E[I]（未加位置）'} rows={source} rowLabels={labels} /></div></>}
        {step === 2 && <><h4>三条并行投影</h4><p>可编辑基础 Wq、Wk、Wv 均为 [3,2]，逐位置共享。头 2 明确由基础矩阵得到：Q 列 [−q₁,q₀]，K 列 [k₁,k₀]，V 列 [v₁,−v₀]；不是预训练语义头。</p><div className="tf-three">{editor('Q', '基础 Wq', wq)}{editor('K', '基础 Wk', wk)}{editor('V', '基础 Wv', wv)}</div>{v.tfHead === 1 && <div className="tf-three"><MatrixView title="头2 Wq" rows={headWeights.q} /><MatrixView title="头2 Wk" rows={headWeights.k} /><MatrixView title="头2 Wv" rows={headWeights.v} /></div>}<div className="tf-three"><MatrixView title="Q = 查询输入 Wq" rows={q} rowLabels={queryLabels} /><MatrixView title="K = 源输入 Wk" rows={k} rowLabels={labels} /><MatrixView title="V = 源输入 Wv" rows={val} rowLabels={labels} /></div></>}
        {step === 3 && <><h4>位置点积与缩放</h4><p>当前键宽 dₖ=2，标准除数为 √2。除数滑块用于观察尺度，Softmax 还未执行。</p>{range('tfScale', 'Softmax 前缩放除数', .25, 4, 'any')}<button className="tf-inline-button" onClick={() => set('tfScale', Math.SQRT2)} type="button">设为标准 √2</button><div className="tf-two"><MatrixView title="原始 QKᵀ" rows={result.scores} rowLabels={queryLabels} columnLabels={labels} /><MatrixView title="缩放分数 QKᵀ / 除数" rows={result.scaled} rowLabels={queryLabels} columnLabels={labels} /></div><p>查询 {row} 与键 0：{vector(q[row])} · {vector(k[0])} = {rounded(result.scores[row][0])}，再除 {rounded(v.tfScale)} 得到 {rounded(result.scaled[row][0])}。</p></>}
        {step === 4 && <><h4>稳定 Softmax · 每行在键位置上归一化</h4>{range('tfScale', 'Softmax 前缩放除数', .25, 4, 'any')}<MatrixView title={`头 ${v.tfHead + 1} 的实时注意力权重`} rows={result.weights} heat rowLabels={queryLabels} columnLabels={labels} masked={masked} /><p className="tf-result">查询 {row} 的权重 {vector(result.weights[row])}；行和 = {rounded(result.weights[row].reduce((a, b) => a + b, 0))}。</p><p>合法分数先减去本行合法最大值再取指数。屏蔽格计算值严格为零；普通格显示 0 也可能只是四舍五入。未训练热图只反映当前数值。</p><MatrixView title="Softmax 前的缩放分数（屏蔽另处理）" rows={[result.scaled[row]]} rowLabels={[queryLabels[row]]} columnLabels={labels} /></>}
        {step === 5 && <><h4>按权重读取内容，沿特征轴合并头</h4><div className="tf-two"><MatrixView title={`当前头 V`} rows={val} rowLabels={labels} /><MatrixView title="当前头 O = AV" rows={result.output} rowLabels={queryLabels} /></div><p className="tf-result">查询 {row}：{result.weights[row].map((a, j) => `${rounded(a)}×${vector(val[j])}`).join(' + ')} = {vector(result.output[row])}</p><div className="tf-two"><MatrixView title="头1与头2拼接" rows={joined} rowLabels={queryLabels} columnLabels={['头1·0', '头1·1', '头2·0', '头2·1']} /><MatrixView title="固定 Wₒ（本实验未训练）" rows={wo} /></div><MatrixView title="拼接 × Wₒ，投回三维" rows={update} rowLabels={queryLabels} /><p>两个头分别归一化后计算输出，再拼接；这里没有平均热图。固定输出矩阵明确列出，避免把二维头直接加到三维残差。</p></>}
        {step === 6 && <><h4>保留输入，加上同宽更新</h4>{range('tfResidual', '残差更新系数', 0, 2, .1)}<div className="tf-three"><MatrixView title="查询输入 X" rows={queryInput} rowLabels={queryLabels} /><MatrixView title="F(X) = 合并注意力" rows={update} rowLabels={queryLabels} /><MatrixView title="U = X + 系数 F(X)" rows={residual} rowLabels={queryLabels} /></div><p className="tf-result">位置 {row}：{vector(queryInput[row])} + {rounded(v.tfResidual)} × {vector(update[row])} = {vector(residual[row])}。</p><p>系数为 0 时 U 精确等于 X。此处单独展示加法；它不是一个完整 Pre-LN 模型训练。</p></>}
        {step === 7 && <><h4>每个位置内的真实 LayerNorm</h4><label className="tf-select">归一化来源<select aria-label="LayerNorm 输入来源" value={v.tfNormSource} onChange={e => set('tfNormSource', Number(e.target.value))}><option value={0}>X · 直接查表输入，适合验证常数行</option><option value={1}>U · 注意力残差之后（Post-LN 示意）</option></select></label>{range('tfEpsilon', 'ε（平方根内，严格为正）', .00001, 1, .00001)}{range('tfGamma', '共享标量 γ', -2, 2, .1)}{range('tfBeta', '共享标量 β', -2, 2, .1)}<p className="tf-result">位置 {row} 输入 {vector(normInput[row])}；均值 μ={rounded(normalized[row].mean)}；总体方差 σ²={rounded(normalized[row].variance)}。</p><div className="tf-two"><MatrixView title="去均值 / √(方差+ε)" rows={normalized.map(n => n.normalized)} rowLabels={queryLabels} /><MatrixView title="γ × 标准化 + β" rows={normalized.map(n => n.output)} rowLabels={queryLabels} /></div><p>本实验 γ、β 是共享标量，标准 LayerNorm 通常每特征有参数。零方差时标准化部分全零、输出为 β；正 ε 下归一化方差是 σ²/(σ²+ε)，不保证精确为 1。</p><details><summary>编辑 Embedding，检验 [2,2,2] 的零方差</summary>{editor('E', 'Embedding E', embedding.slice(0, data.vocabulary.length), data.vocabulary.map(labelToken))}</details></>}
        {step === 8 && <><h4>未训练前馈示意与共享词表头</h4><p>这里演示一个明确的玩具顺序：U=X+MHA(X)，Z=U+ReLU(LN(U)W₁)W₂，再用 Z Eᵀ 生成词表分数。本步固定归一化 U，独立于上一面板的探索来源选择；这不是标准 Pre-LN 块，也没有训练或真实语言生成。</p><div className="tf-two"><MatrixView title="固定 W₁ [3,4]" rows={wi} /><MatrixView title="固定 W₂ [4,3]" rows={wf} /></div><MatrixView title="Z = U + 玩具 FFN" rows={finalHidden} rowLabels={queryLabels} /><MatrixView title="未训练词表 logits = Z Eᵀ" rows={logits} rowLabels={queryLabels} columnLabels={data.vocabulary.map(labelToken)} /><MatrixView title="词表概率（沿词表轴）" rows={logits.map(r => stableSoftmax(r))} rowLabels={queryLabels} columnLabels={data.vocabulary.map(labelToken)} /><p>当前词表只有 {data.vocabulary.length} 个样本字符，候选概率没有语言质量含义。注意力 A 的列是位置，词表概率的列是字符身份。</p></>}
      </div>
      {lesson.id === 'rnn-lstm' && <div className="tf-context"><h4>对照：逐步递归的标量状态</h4><p>h₀=0，hₜ=tanh(Xₜ,₀+ρhₜ₋₁)。这是真实计算的标量 RNN 示例，不是 LSTM；必须先有旧状态才能计算下一步。</p>{range('tfRnn', '历史系数 ρ', -1, 1, .05)}<MatrixView title="输入第一分量与逐步状态" rows={states} rowLabels={labels} columnLabels={['输入 x', '更新后 h']} /></div>}
      <details className="tf-parameters"><summary>随时编辑 Embedding 与基础 QKV 参数</summary>{editor('E', 'Embedding E', embedding.slice(0, data.vocabulary.length), data.vocabulary.map(labelToken))}<div className="tf-three">{editor('Q', '基础 Wq', wq)}{editor('K', '基础 Wk', wk)}{editor('V', '基础 Wv', wv)}</div></details>
      </>}
    </div><footer className="tf-task"><strong>本节实验任务</strong><p>{lesson.labTask}</p></footer>
  </section>;
}
