// @vitest-environment jsdom
import { spawnSync } from 'node:child_process';
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import katex from 'katex';
import graph from './data/knowledge-graph.json';
import { stage6Lessons } from './data/stage6';
import {
  ModernLLMLab, attentionRow, compareAttentionCache, decodeDistribution, dpoPreference,
  exactMatchAudit, factualitySamples, lowRankExample, memoryAccounting, modernLabDefaults,
  pairedSummary, quantizeSymmetric, scalingSurrogate, selectiveCounts, sftMaskedExample,
  stableSoftmax, wilsonInterval,
} from './components/labs/ModernLLMLab';

describe('阶段六完整教材与可运行练习', () => {
  it('十一课按知识图顺序覆盖真实标题和依赖', () => {
    const nodes = graph.nodes.filter(n => n.stage === 6);
    expect(stage6Lessons).toHaveLength(11);
    expect(stage6Lessons.map(l => l.id)).toEqual(nodes.map(n => n.id));
    for (const lesson of stage6Lessons) {
      const node = nodes.find(n => n.id === lesson.id)!;
      expect(lesson.title).toBe(node.title);
      expect(lesson.prerequisites).toEqual(node.prerequisites);
      expect(lesson.lab).toBe('modern-llm');
    }
  });

  it.each(stage6Lessons)('$id 拥有实质讲解、公式、实验、四选自测与原始来源', lesson => {
    expect(lesson.problem.length).toBeGreaterThan(50);
    expect(lesson.goals.length).toBeGreaterThanOrEqual(3);
    for (const sections of [lesson.intuition, lesson.math, lesson.deep]) {
      expect(sections.length).toBeGreaterThanOrEqual(2);
      for (const section of sections) expect(section.paragraphs.join('').length).toBeGreaterThan(60);
    }
    const formulas = [lesson.formula, ...lesson.math.flatMap(s => s.formula ? [s.formula] : [])];
    expect(formulas.length).toBeGreaterThanOrEqual(3);
    for (const formula of formulas) {
      expect(formula).not.toMatch(/[\u0000-\u001f]/);
      expect(() => katex.renderToString(formula, { throwOnError: true, strict: 'error' })).not.toThrow();
    }
    for (const text of [lesson.labTask, lesson.exercise, lesson.codeExplanation]) expect(text.length).toBeGreaterThan(30);
    expect(lesson.misconceptions.length).toBeGreaterThanOrEqual(3);
    expect(lesson.starter).toContain('TODO');
    expect(lesson.reference).not.toMatch(/TODO|\.\.\./);
    expect(lesson.quiz.options).toHaveLength(4);
    expect(new Set(lesson.quiz.options).size).toBe(4);
    expect(lesson.quiz.correct).toBeGreaterThanOrEqual(0);
    expect(lesson.quiz.correct).toBeLessThan(4);
    expect(lesson.quiz.hint.length).toBeGreaterThan(15);
    expect(lesson.quiz.explanation.length).toBeGreaterThan(25);
    expect(lesson.references.length).toBeGreaterThanOrEqual(2);
    for (const source of lesson.references) expect(new URL(source.url).protocol).toBe('https:');
  });

  it.each(stage6Lessons)('$id 的 CPython 参考通过，TODO 被断言检出', lesson => {
    const run = (code: string) => spawnSync('python3', ['-c', `${code}\n${lesson.pythonTests}`], { encoding: 'utf8', timeout: 5000 });
    const complete = run(lesson.reference);
    expect(complete.error, complete.stderr).toBeUndefined();
    expect(complete.status, complete.stderr).toBe(0);
    const incomplete = run(lesson.starter);
    expect(incomplete.status).not.toBe(0);
    expect(incomplete.stderr).toContain('AssertionError');
    expect(incomplete.stderr).not.toContain('SyntaxError');
  });
});

describe('现代 LLM 算例的独立数学检查', () => {
  it('预算守恒，代理最优点满足局部极小条件', () => {
    const small = scalingSurrogate(6, 2), large = scalingSurrogate(6, 8);
    expect(6 * 2e9 * small.tokensB * 1e9).toBeCloseTo(6e21, -6);
    expect(small.tokensB / large.tokensB).toBe(4);
    expect(scalingSurrogate(12, 8).tokensB).toBe(2 * large.tokensB);
    const n = large.optimumB;
    const center = scalingSurrogate(6, n).loss;
    expect(scalingSurrogate(6, n * 0.99).loss).toBeGreaterThan(center);
    expect(scalingSurrogate(6, n * 1.01).loss).toBeGreaterThan(center);
  });

  it('回复损失不受提示长度影响，梯度与有限差分一致', () => {
    const short = sftMaskedExample(0.7, 2), long = sftMaskedExample(0.7, 20);
    expect(long.masked).toBe(short.masked);
    expect(long.unmasked).toBeLessThan(short.unmasked);
    const h = 1e-6;
    const derivative = (sftMaskedExample(0.7 + h, 2).masked - sftMaskedExample(0.7 - h, 2).masked) / (2 * h);
    expect(short.gradient[0]).toBeCloseTo(derivative, 8);
    expect(short.gradient.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 12);
  });

  it('DPO 零 margin、平移不变性、梯度及极值数值稳定', () => {
    expect(dpoPreference(0, 0, 0.5)).toMatchObject({ margin: 0, logistic: 0.5, gradient: -0.25 });
    expect(dpoPreference(0, 0, 0.5).loss).toBeCloseTo(Math.log(2), 12);
    expect(dpoPreference(2, 1, 0.7)).toEqual(dpoPreference(1, 0, 0.7));
    for (const m of [-3, -0.2, 0, 2, 10]) {
      const h = 1e-6;
      const derivative = (dpoPreference(m + h, 0, 0.8).loss - dpoPreference(m - h, 0, 0.8).loss) / (2 * h);
      const r = dpoPreference(m, 0, 0.8);
      expect(r.gradient).toBeCloseTo(derivative, 7);
      expect(dpoPreference(m - 0.5 * r.gradient, 0, 0.8).loss).toBeLessThanOrEqual(r.loss);
    }
    for (const m of [-10000, 10000]) {
      const r = dpoPreference(m, 0, 2);
      expect(Number.isFinite(r.loss)).toBe(true);
      expect(Number.isFinite(r.gradient)).toBe(true);
    }
  });

  it('温度变换稳定，top-k 归一化且均匀数实际改变选择', () => {
    expect(stableSoftmax([1000, 1000])).toEqual([0.5, 0.5]);
    expect(decodeDistribution([0, 0], 1, 2, 0.1).selected).toBe(0);
    expect(decodeDistribution([0, 0], 1, 2, 0.9).selected).toBe(1);
    const r = decodeDistribution([2, 1, 0, -1], 0.7, 2, 0.9);
    expect(r.probabilities[2]).toBe(0);
    expect(r.probabilities[3]).toBe(0);
    expect(r.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(decodeDistribution([2, 1], 0.2, 2, 0).entropy).toBeLessThan(decodeDistribution([2, 1], 2, 2, 0).entropy);
  });

  it('缓存每步与完整因果注意力一致，计数符合独立闭式公式', () => {
    expect(attentionRow([0, 0], [[1, 0], [0, 1]], [[2, 0], [0, 2]])).toEqual([1, 1]);
    for (const t of [1, 2, 6, 12]) {
      const r = compareAttentionCache(t);
      expect(r.steps).toHaveLength(t);
      expect(r.maxError).toBeLessThan(1e-12);
      expect(r.fullProjectionPositions).toBe(t * (t + 1) / 2);
      expect(r.cacheProjectionPositions).toBe(t);
      expect(r.fullScores).toBe(t * (t + 1) * (t + 2) / 6);
      expect(r.cacheScores).toBe(t * (t + 1) / 2);
    }
    // For nonzero Q, a direct two-key hand calculation catches a uniform-only implementation.
    const p = 1 / (1 + Math.exp(-1 / Math.sqrt(2)));
    expect(attentionRow([1, 0], [[1, 0], [0, 1]], [[2, 0], [0, 2]])[0]).toBeCloseTo(2 * p, 12);
  });

  it('量化真实重建零值、端点与格点误差界，异常值可改变小数编码', () => {
    expect(quantizeSymmetric([0, 0], 4)).toMatchObject({ codes: [0, 0], restored: [0, 0], scale: 0, mse: 0 });
    expect(quantizeSymmetric([-1, 0, 1], 3)).toMatchObject({ codes: [-3, 0, 3], restored: [-1, 0, 1] });
    const xs = [-1.2, -0.65, -0.12, 0.05, 0.33, 0.8, 1.25];
    for (let bits = 2; bits <= 8; bits++) {
      const r = quantizeSymmetric(xs, bits);
      expect(r.codes.every(q => Number.isInteger(q) && Math.abs(q) <= r.qmax)).toBe(true);
      expect(r.maxError).toBeLessThanOrEqual(r.scale / 2 + 1e-12);
      const independentMse = xs.reduce((sum, x, i) => sum + (x - r.restored[i]) ** 2, 0) / xs.length;
      expect(r.mse).toBe(independentMse);
    }
    expect(quantizeSymmetric([0.33, 1.25], 4).codes[0]).toBe(2);
    expect(quantizeSymmetric([0.33, 12.5], 4).codes[0]).toBe(0);
  });

  it('LoRA 分支与合并相等，零缩放恢复基座，小矩阵高秩不节省', () => {
    for (const rank of [1, 2, 3]) {
      const r = lowRankExample(rank, 2.5);
      expect(r.a).toHaveLength(rank);
      expect(r.b).toHaveLength(4);
      expect(r.delta[0]).toHaveLength(6);
      expect(r.adapterParameters).toBe(10 * rank);
      expect(r.maxError).toBeLessThan(1e-12);
      expect(lowRankExample(rank, 0).merged).toEqual(r.base);
    }
    expect(lowRankExample(3, 2).adapterParameters).toBeGreaterThan(24);
    const a = lowRankExample(2, 1).delta, b = lowRankExample(2, 2).delta;
    expect(b[1][3]).toBeCloseTo(2 * a[1][3], 12);
  });

  it('权重和缓存使用独立字节公式，位数与长度只改变对应项', () => {
    const config = { parameters: 1000, weightBits: 8, layers: 2, batch: 1, length: 10, kvHeads: 2, headDim: 4, kvBytes: 2, bandwidthGBps: 100 };
    const r = memoryAccounting(config);
    expect(r.weights).toBe(1000);
    expect(r.cache).toBe(640);
    expect(memoryAccounting({ ...config, weightBits: 4 })).toMatchObject({ weights: 500, cache: 640 });
    expect(memoryAccounting({ ...config, length: 20 })).toMatchObject({ weights: 1000, cache: 1280 });
    expect(memoryAccounting({ ...config, kvHeads: 1 }).cache).toBe(320);
    expect(r.lowerGiB).toBe(1640 / 2 ** 30);
    expect(memoryAccounting({ ...config, bandwidthGBps: 200 }).idealSeconds).toBe(r.idealSeconds / 2);
  });

  it('事实性混淆计数守恒，空回答没有虚假的 100% 精度', () => {
    const r = selectiveCounts(0.6);
    expect(r).toMatchObject({ tp: 3, fp: 2, fn: 2, tn: 1, total: 8, answered: 5, precision: 0.6, coverage: 5 / 8 });
    expect(selectiveCounts(1).precision).toBeNull();
    expect(selectiveCounts(1).coverage).toBe(0);
    expect(selectiveCounts(0).answered).toBe(factualitySamples.length);
    expect(selectiveCounts(0.9).precision).toBeLessThan(selectiveCounts(0.85).precision!);
    expect(selectiveCounts(0.5, [{ score: 0.5, correct: true }]).tp).toBe(1);
  });

  it('评估显式规范化与子集分母，Wilson 小样本区间不退化', () => {
    const all = exactMatchAudit(0), clean = exactMatchAudit(3);
    expect(all).toMatchObject({ totalHits: 5, hits: 5, count: 8, cleanScore: 5 / 8 });
    expect(clean).toMatchObject({ hits: 2, count: 5, cleanScore: 2 / 5 });
    expect(all.rows[1].correct).toBe(true);
    expect(all.rows[6].correct).toBe(true);
    expect(exactMatchAudit(8)).toMatchObject({ hits: 0, count: 0, cleanScore: null, interval: null });
    const perfect = wilsonInterval(2, 2)!;
    expect(perfect[0]).toBeLessThan(0.5);
    expect(perfect[1]).toBeCloseTo(1, 12);
    expect(wilsonInterval(1, 2)).toEqual([1 - wilsonInterval(1, 2)![1], wilsonInterval(1, 2)![1]]);
  });

  it('配对差的均值、样本方差与共同平移不变性', () => {
    const r = pairedSummary([10, 20, 30], [11, 22, 33]);
    expect(r.mean).toBe(2);
    expect(r.se).toBeCloseTo(Math.sqrt(1 / 3), 12);
    expect(pairedSummary([11, 21, 31], [12, 23, 34])).toEqual(r);
    expect(pairedSummary([1, 3, 7], [3, 5, 9])).toMatchObject({ mean: 2, se: 0, interval: [2, 2] });
    expect(() => pairedSummary([1], [2])).toThrow();
  });
});

describe('现代 LLM 实验的可操作界面', () => {
  it.each(stage6Lessons)('$id 展示对应实验、控件与明确假设', lesson => {
    const html = renderToStaticMarkup(createElement(ModernLLMLab, { lesson, values: {}, onChange: () => {} }));
    expect(html).toContain(`data-modern-lesson="${lesson.id}"`);
    expect(html).toContain('type="range"');
    expect(html).toContain('data-testid="modern-lab-results"');
    expect(html).toContain('试一试');
    expect(html).not.toContain('NaN');
    expect(html).toMatch(/教学|合成|非实测/);
  });

  it('阈值控件实际改变计数并保存数值，重置恢复默认', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const lesson = stage6Lessons.find(l => l.id === 'hallucination')!;
    let saved: Record<string, number> = {};
    function Harness() {
      const [values, setValues] = useState<Record<string, number>>({});
      return createElement(ModernLLMLab, { lesson, values, onChange: next => { saved = next; setValues(next); } });
    }
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => { root.render(createElement(Harness)); });
    expect(container.textContent).toContain('TP=3');
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { setter.call(slider, '1'); slider.dispatchEvent(new Event('input', { bubbles: true })); slider.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(saved.factualityThreshold).toBe(1);
    expect(container.textContent).toContain('TP=0');
    expect(container.textContent).toContain('无回答');
    await act(async () => { (container.querySelector('button[aria-label="重置现代 LLM 实验参数"]') as HTMLButtonElement).click(); });
    expect(saved).toEqual(modernLabDefaults);
    expect(container.textContent).toContain('TP=3');
    await act(async () => { root.unmount(); });
  });
});
