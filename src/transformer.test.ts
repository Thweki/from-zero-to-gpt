import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import katex from 'katex';
import graph from './data/knowledge-graph.json';
import { stage4Lessons } from './data/stage4';
import { attentionFromQKV, layerNormalize, multiply, sanitizeTransformerValues, sinusoidalPosition, stableSoftmax, tokenizeCharacters, TransformerLab, transformerDefaults } from './components/labs/TransformerLab';

describe('第四阶段教材与可执行练习', () => {
  it('16 节标题和先修与原始知识图逐项一致', () => {
    const expected = graph.nodes.filter(n => n.stage === 4);
    expect(stage4Lessons).toHaveLength(16);
    expect(stage4Lessons.map(l => l.id)).toEqual(expected.map(n => n.id));
    stage4Lessons.forEach((lesson, i) => {
      expect(lesson.title).toBe(expected[i].title);
      expect(lesson.prerequisites).toEqual(expected[i].prerequisites);
      expect(lesson.lab).toBe('transformer');
    });
  });
  it.each(stage4Lessons)('$id 包含独立解释与可解析公式', lesson => {
    expect(lesson.problem.length).toBeGreaterThan(50);
    expect(lesson.goals.length).toBeGreaterThanOrEqual(3);
    for (const sections of [lesson.intuition, lesson.math, lesson.deep]) {
      expect(sections.length).toBeGreaterThanOrEqual(2);
      for (const section of sections) expect(section.paragraphs.join('').length).toBeGreaterThan(60);
    }
    for (const formula of [lesson.formula, ...lesson.math.map(s => s.formula!)]) {
      expect(() => katex.renderToString(formula, { throwOnError: true, strict: 'error' })).not.toThrow();
      expect(formula).not.toMatch(/[\u0000-\u001f]/);
    }
    expect(lesson.misconceptions).toHaveLength(3);
    expect(lesson.references.length).toBeGreaterThanOrEqual(2);
    expect(lesson.quiz.options).toHaveLength(4);
    expect(lesson.quiz.hint.length).toBeGreaterThan(15);
    expect(lesson.quiz.explanation.length).toBeGreaterThan(25);
    expect(lesson.reference).not.toMatch(/TODO|\.\.\./);
  });
  it.each(stage4Lessons)('$id 的真实 CPython 参考实现通过，TODO 由断言检出', lesson => {
    const run = (code: string) => spawnSync('python3', ['-c', `${code}\n${lesson.pythonTests}`], { encoding: 'utf8', timeout: 5000 });
    const reference = run(lesson.reference);
    expect(reference.error, lesson.id).toBeUndefined();
    expect(reference.status, reference.stderr).toBe(0);
    const starter = run(lesson.starter);
    expect(starter.status).not.toBe(0);
    expect(starter.stderr).toContain('AssertionError');
  });
  it.each(stage4Lessons)('$id 的默认实验可渲染且明确标注边界', lesson => {
    const html = renderToStaticMarkup(createElement(TransformerLab, { lesson, values: {}, onChange: () => {} }));
    expect(html).toContain('未训练');
    expect(html).toContain('Unicode');
    expect(html).toContain('Transformer 样本文本');
    expect(html).toContain(lesson.labTask);
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });
});

describe('真实计算的文本与注意力实验', () => {
  it('字符分词确定、保留重复及空格，并按码点而非 UTF-16 单元截取', () => {
    const t = tokenizeCharacters('猫 猫😀');
    expect(t.tokens).toEqual(['猫', ' ', '猫', '😀']);
    expect(t.vocabulary).toEqual([' ', '猫', '😀']);
    expect(t.ids).toEqual([1, 0, 1, 2]);
    expect(tokenizeCharacters('猫 猫😀')).toEqual(t);
    expect(tokenizeCharacters('😀123456').omitted).toBe(1);
    expect(tokenizeCharacters('e\u0301').ids).toHaveLength(2);
    expect(tokenizeCharacters('').ids).toEqual([]);
  });
  it('投影严格按对应维求和并拒绝不兼容形状', () => {
    expect(multiply([[1, 2, 3], [-1, 0, 2]], [[1, 0], [0, 1], [1, 1]])).toEqual([[4, 5], [1, 2]]);
    expect(() => multiply([[1, 2]], [[1]])).toThrow(/形状/);
    expect(() => multiply([[1, 2]], [[1, 2], [3]])).toThrow(/形状/);
  });
  it('稳定 Softmax 不溢出且整体平移不变，屏蔽大分数仍严格为零', () => {
    const large = stableSoftmax([1000, 1001]);
    const small = stableSoftmax([0, 1]);
    large.forEach((p, i) => expect(p).toBeCloseTo(small[i], 12));
    expect(large.reduce((a, b) => a + b)).toBeCloseTo(1, 12);
    expect(stableSoftmax([0, 1, 99999], [true, true, false])).toEqual([...small, 0]);
    expect(() => stableSoftmax([1, 2], [false, false])).toThrow(/没有定义/);
  });
  it('一行注意力的点积、缩放、归一化和值汇聚符合手算', () => {
    const a = attentionFromQKV([[1, 0]], [[1, 0], [0, 1]], [[1, 2], [3, 4]], Math.SQRT2, false);
    const p = 1 / (1 + Math.exp(-1 / Math.SQRT2));
    expect(a.scores).toEqual([[1, 0]]);
    expect(a.scaled[0][0]).toBeCloseTo(1 / Math.SQRT2);
    expect(a.weights[0][0]).toBeCloseTo(p);
    expect(a.output[0][0]).toBeCloseTo(p + 3 * (1 - p));
    expect(a.output[0][1]).toBeCloseTo(2 * p + 4 * (1 - p));
  });
  it('因果屏蔽不受未来键和值的扰动影响，非因果结果则改变', () => {
    const q = [[1], [2], [3]], k = [[1], [2], [3]], v = [[1], [2], [3]];
    const a = attentionFromQKV(q, k, v, 1, true);
    const b = attentionFromQKV(q, [[1], [2], [9999]], [[1], [2], [-800]], 1, true);
    expect(a.weights[0]).toEqual([1, 0, 0]);
    expect(a.weights[1][2]).toBe(0);
    expect(a.output.slice(0, 2)).toEqual(b.output.slice(0, 2));
    expect(attentionFromQKV(q, k, v, 1, false).output[0]).not.toEqual(attentionFromQKV(q, k, [[1], [2], [-800]], 1, false).output[0]);
  });
  it('正缩放除数改变集中程度，矩形交叉注意力保留查询数', () => {
    const sharp = attentionFromQKV([[1]], [[1], [0]], [[0], [1]], .25, false);
    const flat = attentionFromQKV([[1]], [[1], [0]], [[0], [1]], 4, false);
    expect(sharp.weights[0][0]).toBeGreaterThan(flat.weights[0][0]);
    const cross = attentionFromQKV([[1], [-1]], [[0], [1], [2]], [[1, 2], [2, 3], [3, 4]], 1, false);
    expect(cross.weights.map(row => row.length)).toEqual([3, 3]);
    expect(cross.output.map(row => row.length)).toEqual([2, 2]);
  });
  it('无掩码且无位置的自注意力对位置反转等变', () => {
    const x = [[1, 2], [0, -1], [2, 1]];
    const q = multiply(x, [[1, .2], [.3, .5]]);
    const k = multiply(x, [[-.2, 1], [1, 0]]);
    const v = multiply(x, [[1], [-1]]);
    const a = attentionFromQKV(q, k, v, Math.SQRT2, false);
    const b = attentionFromQKV([...q].reverse(), [...k].reverse(), [...v].reverse(), Math.SQRT2, false);
    a.output.forEach((row, i) => expect(row[0]).toBeCloseTo(b.output[2 - i][0], 12));
  });
  it('LayerNorm 使用总体方差，明确正 epsilon 与常数输入行为', () => {
    const n = layerNormalize([1, 2, 3], .1);
    expect(n.mean).toBe(2);
    expect(n.variance).toBeCloseTo(2 / 3, 12);
    expect(n.output.reduce((a, b) => a + b)).toBeCloseTo(0, 12);
    expect(n.output.reduce((a, b) => a + b * b, 0) / 3).toBeCloseTo((2 / 3) / (2 / 3 + .1), 12);
    expect(layerNormalize([2, 2, 2], 1e-5, 7, 3).output).toEqual([3, 3, 3]);
    expect(() => layerNormalize([1], 0)).toThrow(/正 epsilon/);
    expect(layerNormalize([11, 12, 13], .1).output).toEqual(n.output);
  });
  it('正弦位置编码同频配对且保留奇数宽度', () => {
    expect(sinusoidalPosition(0, 4)).toEqual([0, 1, 0, 1]);
    const p = sinusoidalPosition(1, 4);
    expect(p[2]).toBeCloseTo(Math.sin(.01), 12);
    expect(p[2] ** 2 + p[3] ** 2).toBeCloseTo(1, 12);
    expect(sinusoidalPosition(2, 3)).toHaveLength(3);
    expect(Object.values(transformerDefaults).every(Number.isFinite)).toBe(true);
  });
  it('导入的数值被限制在合法范围，未知键和非有限值不进入计算', () => {
    expect(sanitizeTransformerValues({ tfEpsilon: -1, tfStep: 2.7, tfMode: 99, tfQ00: 12, tfScale: NaN, unknown: 1, constructor: 1 })).toEqual({ tfEpsilon: .00001, tfStep: 3, tfMode: 2, tfQ00: 5 });
    const lesson = stage4Lessons.find(l => l.id === 'decoder-only')!;
    expect(() => renderToStaticMarkup(createElement(TransformerLab, { lesson, values: { tfEpsilon: -100, tfScale: 0, tfHead: 99 }, onChange: () => {} }))).not.toThrow();
  });
});
