import { useEffect, useState } from 'react';
import { Download, RotateCcw, StepForward } from 'lucide-react';
import type { ExtendedLabProps } from '../../types';
import './GPTLab.css';

export const toyVocabulary = ['〈起始〉', '春', '风', '吹', '过', '山', '海', '。'];
// Authored transition scores. These are fixed pedagogical numbers, never trained weights.
const transition = [
  [-5, 3, 1, 0, 0, 1, 1, -1], [-5, 0, 4, 1, 0, 1, 0, -1],
  [-5, 1, 0, 4, 2, 0, 1, 0], [-5, 0, 1, 0, 4, 2, 1, 1],
  [-5, 0, 0, 1, 0, 3, 3, 1], [-5, 0, 1, 0, 1, 0, 1, 4],
  [-5, 0, 2, 1, 0, 1, 0, 4], [-5, 4, 2, 0, 0, 1, 1, -2],
];
export interface SamplingDistribution {
  logits: number[]; base: number[]; tempered: number[]; final: number[]; kept: number[];
}
function softmax(scores: number[]): number[] {
  const maximum = Math.max(...scores);
  const weights = scores.map(z => Math.exp(z - maximum));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map(w => w / sum);
}
/** Temperature -> top-k -> renormalize -> top-p (including crossing token) -> renormalize. */
export function samplingDistribution(logits: number[], temperature: number, topK: number, topP: number): SamplingDistribution {
  if (!logits.length || logits.some(z => !Number.isFinite(z)) || !Number.isFinite(temperature) || temperature <= 0 || !Number.isInteger(topK) || topK < 0 || !(topP > 0 && topP <= 1)) {
    throw new Error('分数须有限，温度为正，top-k 为非负整数，0 < top-p ≤ 1');
  }
  const tempered = softmax(logits.map(z => z / temperature));
  let order = logits.map((_, i) => i).sort((a, b) => tempered[b] - tempered[a] || a - b);
  if (topK > 0) order = order.slice(0, topK);
  const mass = order.reduce((sum, i) => sum + tempered[i], 0);
  let cumulative = 0;
  const kept: number[] = [];
  for (const i of order) {
    kept.push(i);
    cumulative += tempered[i] / mass;
    if (cumulative >= topP) break;
  }
  const retainedMass = kept.reduce((sum, i) => sum + tempered[i], 0);
  return { logits, base: softmax(logits), tempered, kept, final: tempered.map((p, i) => kept.includes(i) ? p / retainedMass : 0) };
}
export function seededUniform(seed: number, step: number): number {
  let x = ((Math.trunc(seed) >>> 0) + Math.imul(step + 1, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}
export function sampleIndex(probabilities: number[], uniform: number): number {
  if (!(uniform >= 0 && uniform < 1)) throw new Error('随机数必须在 [0,1)');
  let cumulative = 0;
  let lastPositive = 0;
  for (let i = 0; i < probabilities.length; i++) {
    if (probabilities[i] > 0) lastPositive = i;
    cumulative += probabilities[i];
    if (uniform < cumulative) return i;
  }
  return lastPositive;
}
type Trace = { token: number; probability: number; random: number; context: string; temperature: number; topK: number; topP: number };
const percentage = (p: number) => `${(p * 100).toFixed(2)}%`;

export function GPTLab({ lesson, values, onChange }: ExtendedLabProps) {
  const [prompt, setPrompt] = useState('春风');
  const [generated, setGenerated] = useState<number[]>([]);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [openDetails, setOpenDetails] = useState(false);
  useEffect(() => { setPrompt('春风'); setGenerated([]); setTraces([]); }, [lesson.id]);
  const temperature = Math.max(.1, Math.min(2, values.gptTemperature ?? .8));
  const topK = Math.max(0, Math.min(8, Math.round(values.gptTopK ?? 0)));
  const topP = Math.max(.05, Math.min(1, values.gptTopP ?? 1));
  const seed = Math.max(0, Math.min(999999, Math.round(values.gptSeed ?? 42)));
  const target = Math.max(1, Math.min(7, Math.round(values.gptTarget ?? 3)));
  const set = (key: string, value: number) => onChange({ ...values, [key]: value });
  const chars = Array.from(prompt).filter(c => !/\s/u.test(c));
  const unknown = chars.filter(c => !toyVocabulary.includes(c));
  const ids = chars.map(c => Math.max(0, toyVocabulary.indexOf(c)));
  const context = [...(ids.length ? ids : [0]), ...generated];
  const lastId = context.at(-1)!;
  const distribution = samplingDistribution(transition[lastId], temperature, topK, topP);
  const targetProbability = distribution.base[target];
  const adjustedProbability = distribution.final[target];
  const resetSequence = () => { setGenerated([]); setTraces([]); };
  const generateOne = () => {
    if (generated.length >= 40) return;
    const random = seededUniform(seed, generated.length);
    const token = sampleIndex(distribution.final, random);
    setGenerated([...generated, token]);
    setTraces([...traces, { token, probability: distribution.final[token], random,
      context: context.map(id => toyVocabulary[id]).join(''), temperature, topK, topP }]);
  };
  const idPrefix = `gpt-${lesson.id}`;
  return <section className="gpt-lab" aria-label="GPT 生成与采样实验">
    <div className="gpt-heading"><div><span className="gpt-eyebrow">生成实验 · 概率可追踪</span><h3>一步一步，看见下一个 token</h3></div><button className="gpt-icon" aria-label="重置 GPT 实验" onClick={() => { onChange({ ...values, gptTemperature: .8, gptTopK: 0, gptTopP: 1, gptSeed: 42, gptTarget: 3 }); setPrompt('春风'); resetSequence(); }}><RotateCcw size={17} /></button></div>
    <p className="gpt-disclosure"><strong>浏览器：固定概率表玩具模型。</strong>仅按最后一个 token 查 8×8 分数表；这里没有训练 Transformer，没有 GPT 权重，也不会理解任意提示。采样计算与真实生成使用相同的概率规则。</p>
    <div className="gpt-prompt"><label htmlFor={`${idPrefix}-prompt`}>编辑提示词 <small>词表：春 · 风 · 吹 · 过 · 山 · 海 · 。</small></label><input id={`${idPrefix}-prompt`} value={prompt} maxLength={40} onChange={event => { setPrompt(event.target.value); resetSequence(); }} placeholder="春风" /><p className="gpt-tokenization">提示 ID：{ids.length ? ids.join(' · ') : '0（空提示使用起始符）'}{unknown.length > 0 && <span role="status"> · 未知字符 {Array.from(new Set(unknown)).join('、')} 映射为 0，空白忽略</span>}</p></div>
    <div className="gpt-controls">
      <label htmlFor={`${idPrefix}-temperature`}><span>温度 τ <output>{temperature.toFixed(2)}</output></span><input id={`${idPrefix}-temperature`} aria-label="GPT 温度" type="range" min="0.1" max="2" step="0.05" value={temperature} onChange={event => set('gptTemperature', Number(event.target.value))} /></label>
      <label htmlFor={`${idPrefix}-k`}><span>Top-k <output>{topK === 0 ? '关闭' : topK}</output></span><input id={`${idPrefix}-k`} aria-label="GPT Top-k" type="range" min="0" max="8" step="1" value={topK} onChange={event => set('gptTopK', Number(event.target.value))} /></label>
      <label htmlFor={`${idPrefix}-p`}><span>Top-p <output>{topP.toFixed(2)}</output></span><input id={`${idPrefix}-p`} aria-label="GPT Top-p" type="range" min="0.05" max="1" step="0.05" value={topP} onChange={event => set('gptTopP', Number(event.target.value))} /></label>
      <label htmlFor={`${idPrefix}-seed`}><span>采样 seed</span><input id={`${idPrefix}-seed`} type="number" min="0" max="999999" step="1" value={seed} onChange={event => { set('gptSeed', Number(event.target.value)); resetSequence(); }} /></label>
    </div>
    <p className="gpt-order">实际顺序：logits ÷ τ → softmax → top-k → 归一化 → top-p（包含跨阈值项）→ 再归一化。参数调整从下一步生效。</p>
    <div className="gpt-output" aria-live="polite" aria-atomic="true"><span className="gpt-output-label">当前序列 · {generated.length}/40 个新增 token</span><div><span>{prompt || '〈起始〉'}</span><strong data-testid="gpt-generated">{generated.map(i => toyVocabulary[i]).join('')}</strong><span className="gpt-caret" aria-hidden="true">▍</span></div><small>下一步仅看最后一个 token：{toyVocabulary[lastId]}（ID {lastId}）</small></div>
    <div className="gpt-actions"><button className="gpt-primary" onClick={generateOne} disabled={generated.length >= 40}><StepForward size={16} />生成一步</button><button onClick={resetSequence}>重置序列与随机步数</button></div>
    <div className="gpt-distribution"><div className="gpt-table-caption"><h4>下一步候选分布</h4><span data-testid="gpt-probability-sum">Σ q = {distribution.final.reduce((a, b) => a + b, 0).toFixed(6)} · 保留 {distribution.kept.length}/8</span></div><div className="gpt-table-scroll"><table><caption className="gpt-sr-only">固定玩具模型的原分数、温度概率和过滤后采样概率</caption><thead><tr><th scope="col">Token / ID</th><th scope="col">Logit</th><th scope="col">温度概率</th><th scope="col">采样概率 q</th></tr></thead><tbody>{toyVocabulary.map((token, i) => <tr key={token} className={distribution.kept.includes(i) ? '' : 'gpt-filtered'}><th scope="row">{token} <small>{i}</small></th><td>{distribution.logits[i].toFixed(1)}</td><td>{percentage(distribution.tempered[i])}</td><td><div className="gpt-bar-track"><span style={{ width: `${distribution.final[i] * 100}%` }} /></div><span>{percentage(distribution.final[i])}{!distribution.kept.includes(i) && ' · 过滤'}</span></td></tr>)}</tbody></table></div></div>
    <div className="gpt-loss"><label htmlFor={`${idPrefix}-target`}>假设真实下一个 token 是 <select id={`${idPrefix}-target`} value={target} onChange={event => set('gptTarget', Number(event.target.value))}>{toyVocabulary.slice(1).map((token, i) => <option key={token} value={i + 1}>{token}</option>)}</select></label><p>原模型 p = <strong>{targetProbability.toFixed(6)}</strong>，训练式损失 −ln p = <strong data-testid="gpt-loss">{(-Math.log(targetProbability)).toFixed(4)} nats</strong></p><p>解码后 q = {adjustedProbability.toFixed(6)}，−ln q = {adjustedProbability === 0 ? '∞（被过滤）' : (-Math.log(adjustedProbability)).toFixed(4)}。<small>解码过滤不改变原模型参数；训练损失用未加温、未截断的 p。</small></p></div>
    {traces.length > 0 && <div className="gpt-trace"><h4>最近生成记录 <small>最新在上，保留完整前缀快照</small></h4><ol reversed start={traces.length}>{traces.slice(-4).reverse().map((trace, i) => <li key={traces.length - i}><strong>{toyVocabulary[trace.token]}</strong><span>q={trace.probability.toFixed(5)} · r={trace.random.toFixed(5)} · τ={trace.temperature.toFixed(2)} · k={trace.topK} · p={trace.topP.toFixed(2)}</span><small>前缀：{trace.context}</small></li>)}</ol></div>}
    <button className="gpt-details-toggle" aria-expanded={openDetails} aria-controls={`${idPrefix}-shapes`} onClick={() => setOpenDetails(!openDetails)}>{openDetails ? '收起' : '展开'}真实 GPT 的张量形状对照</button>
    {openDetails && <div id={`${idPrefix}-shapes`} className="gpt-shapes"><h4>下载工程的前向形状示意</h4><p>这张图对应真实 PyTorch 模型；上面的固定表没有这些层。取 B=1、C=48、H=3、d=16，T 为可见长度，V 为训练字符词表大小。</p><div className="gpt-shape-flow"><span>ID<br /><code>[1,T]</code></span><b aria-hidden="true">→</b><span>Token + Position<br /><code>[1,T,48]</code></span><b aria-hidden="true">→</b><span>Q / K / V<br /><code>[1,3,T,16]</code></span><b aria-hidden="true">→</b><span>因果分数<br /><code>[1,3,T,T]</code></span><b aria-hidden="true">→</b><span>残差 + MLP<br /><code>[1,T,48]</code></span><b aria-hidden="true">→</b><span>LM head<br /><code>[1,T,V]</code></span></div><p>训练：对齐 [1,T] 的右移标签算交叉熵。生成：取最后位置 [V]，采样一个 ID 再追加。工程每步重算上下文，无 KV cache。</p></div>}
    <a className="gpt-download" href="/downloads/tiny-gpt.zip" download><Download size={17} /><span><strong>下载真正可训练的本地微型 GPT</strong><small>自定义因果多头注意力 · CPU PyTorch · 原创 CC0 语料 · README 与 8 项自检</small></span></a>
    <p className="gpt-project-note">本地运行：<code>python tiny_gpt.py train --steps 250</code>，随后 <code>evaluate</code>、<code>generate</code>、<code>inspect</code>。仅能学习小语料的局部句式，不能提供可靠知识问答。</p>
    <div className="gpt-task"><strong>本章任务</strong><p>{lesson.labTask}</p></div>
  </section>;
}
