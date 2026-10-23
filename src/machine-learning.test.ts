// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import katex from 'katex';
import graph from './data/knowledge-graph.json';
import { stage2Lessons } from './data/stage2';
import { ML_DEFAULTS, MachineLearningLab, bceFromLogit, classificationMetrics, fitPolynomial, gradientStep, makeMLData, modelLoss, polynomialPredict, regressionMetrics, sigmoid, splitMLData } from './components/labs/MachineLearningLab';

describe('阶段二教材', () => {
  it('九课与知识图中的名称、标识和依赖完全一致', () => {
    const nodes = graph.nodes.filter(node => node.stage === 2);
    expect(stage2Lessons).toHaveLength(9);
    expect(stage2Lessons.map(lesson => lesson.id)).toEqual(nodes.map(node => node.id));
    for (const lesson of stage2Lessons) {
      const node = nodes.find(candidate => candidate.id === lesson.id)!;
      expect(lesson.title).toBe(node.title);
      expect(lesson.prerequisites).toEqual(node.prerequisites);
      expect(lesson.lab).toBe('machine-learning');
    }
  });
  it.each(stage2Lessons)('$id 拥有独立教学与可渲染公式', lesson => {
    expect(lesson.problem.length).toBeGreaterThan(60);
    expect(lesson.goals).toHaveLength(3);
    for (const sections of [lesson.intuition, lesson.math, lesson.deep]) {
      expect(sections.length).toBeGreaterThanOrEqual(2);
      for (const section of sections) expect(section.paragraphs.join('').length).toBeGreaterThan(60);
    }
    for (const formula of [lesson.formula, ...lesson.math.map(section => section.formula!)]) {
      expect(formula).not.toMatch(/[\u0000-\u001f]/);
      expect(() => katex.renderToString(formula, { throwOnError: true, strict: 'error' })).not.toThrow();
    }
    expect(lesson.starter).toContain('TODO');
    expect(lesson.reference).not.toMatch(/TODO|\.\.\./);
    expect(lesson.pythonTests).toContain('assert ');
    expect(lesson.quiz.options).toHaveLength(4);
    expect(lesson.quiz.correct).toBeGreaterThanOrEqual(0);
    expect(lesson.quiz.correct).toBeLessThan(4);
    expect(lesson.references.length).toBeGreaterThanOrEqual(2);
  });
});

describe('真实机器学习计算', () => {
  it('局部种子可重现，划分完整且不重叠，生成没有修改输入', () => {
    const data = makeMLData('regression', 0.4, 7);
    expect(data).toEqual(makeMLData('regression', 0.4, 7));
    expect(data).not.toEqual(makeMLData('regression', 0.4, 8));
    const before = JSON.stringify(data);
    const { train, validation } = splitMLData(data, 0.65, 7);
    expect(train).toHaveLength(20);
    expect(validation).toHaveLength(12);
    expect(new Set([...train, ...validation].map(p => p.id)).size).toBe(32);
    expect(train.every(p => validation.every(q => p.id !== q.id))).toBe(true);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('MSE/RMSE/MAE 与独立手算一致', () => {
    expect(regressionMetrics([{ x: 0, y: 1, id: 0 }, { x: 1, y: 5, id: 1 }], () => 3)).toEqual({ mse: 4, rmse: 2, mae: 2 });
    expect(modelLoss([{ x: 0, y: 1, id: 0 }, { x: 1, y: 4, id: 1 }], 2, 0)).toBe(2.5);
  });

  it.each([false, true])('梯度用有限差分独立验证，classification=%s', classification => {
    const data = makeMLData(classification ? 'classification' : 'regression', 0.4, 7);
    const w = 0.3, b = -0.2, h = 1e-6;
    const actual = gradientStep(data, w, b, 0.1, classification);
    const numericalW = (modelLoss(data, w + h, b, classification) - modelLoss(data, w - h, b, classification)) / (2 * h);
    const numericalB = (modelLoss(data, w, b + h, classification) - modelLoss(data, w, b - h, classification)) / (2 * h);
    expect(actual.gw).toBeCloseTo(numericalW, 7);
    expect(actual.gb).toBeCloseTo(numericalB, 7);
    expect(actual.w).toBeCloseTo(w - 0.1 * numericalW, 7);
    expect(actual.b).toBeCloseTo(b - 0.1 * numericalB, 7);
  });

  it('回归训练接近独立最小二乘解', () => {
    const { train, validation } = splitMLData(makeMLData('regression', 0.2, 7), 0.65, 7);
    const [expectedB, expectedW] = fitPolynomial(train, 1);
    let w = 0, b = 0;
    const start = modelLoss(validation, w, b);
    for (let i = 0; i < 400; i++) ({ w, b } = gradientStep(train, w, b, 0.15));
    expect(w).toBeCloseTo(expectedW, 8);
    expect(b).toBeCloseTo(expectedB, 8);
    expect(modelLoss(validation, w, b)).toBeLessThan(start / 10);
  });

  it('QR 恢复已知多项式，并以实际未见样本揭示噪声过拟合', () => {
    const exact = [-1, -0.5, 0, 0.5, 1].map((x, id) => ({ x, id, y: 1 - 2 * x + 0.5 * x * x }));
    const coefficients = fitPolynomial(exact, 2);
    coefficients.forEach((coefficient, i) => expect(coefficient).toBeCloseTo([1, -2, 0.5][i], 10));
    expect(polynomialPredict(coefficients, 0.3)).toBeCloseTo(0.445, 10);
    const { train, validation } = splitMLData(makeMLData('polynomial', 0.4, 7), 0.5, 7);
    const quadratic = fitPolynomial(train, 2), complex = fitPolynomial(train, 9);
    const loss = (points: typeof train, cs: number[]) => regressionMetrics(points, x => polynomialPredict(cs, x)).mse;
    expect(loss(train, complex)).toBeLessThan(loss(train, quadratic));
    expect(loss(validation, complex)).toBeGreaterThan(loss(validation, quadratic));
    expect(() => fitPolynomial([{ x: 1, y: 2, id: 0 }, { x: 1, y: 3, id: 1 }], 1)).toThrow();
  });

  it('Sigmoid/BCE 极端数值稳定，阈值改变决策而不改变损失', () => {
    expect(sigmoid(0)).toBe(0.5);
    expect(sigmoid(1000)).toBe(1);
    expect(sigmoid(-1000)).toBe(0);
    expect(bceFromLogit(0, 1)).toBeCloseTo(Math.log(2), 12);
    expect(bceFromLogit(-1000, 1)).toBe(1000);
    expect(bceFromLogit(1000, 1)).toBe(0);
    const points = [{ x: -1, y: 0, id: 0 }, { x: 0, y: 1, id: 1 }, { x: 1, y: 1, id: 2 }];
    const low = classificationMetrics(points, 1, 0, 0.2), high = classificationMetrics(points, 1, 0, 0.8);
    expect(high.tp + high.fp).toBeLessThanOrEqual(low.tp + low.fp);
    expect(classificationMetrics(points, 1, 0, 0.5)).toMatchObject({ tp: 2, fp: 0, fn: 0, tn: 1 });
  });
});

describe('实验界面与真实操作', () => {
  it('所有分支均有原生有名控件与两组独立指标', () => {
    for (const lesson of stage2Lessons) {
      const html = renderToStaticMarkup(createElement(MachineLearningLab, { lesson, values: {}, onChange: () => {} }));
      expect(html).toContain('aria-label="机器学习交互实验"');
      expect(html).toContain('data-testid="ml-train-loss"');
      expect(html).toContain('data-testid="ml-validation-loss"');
      expect(html).toContain('type="range"');
      expect(html).toContain('验证');
    }
  });

  it('单步按钮实际更新参数并通过 onChange 保存，重置恢复可复现状态', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const lesson = stage2Lessons.find(candidate => candidate.id === 'training-regression')!;
    let saved: Record<string, number> = {};
    function Harness() {
      const [values, setValues] = useState<Record<string, number>>({});
      return createElement(MachineLearningLab, { lesson, values, onChange: next => { saved = next; setValues(next); } });
    }
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => { root.render(createElement(Harness)); });
    const firstLoss = Number(container.querySelector('[data-testid="ml-train-loss"]')!.textContent);
    const step = [...container.querySelectorAll('button')].find(button => button.textContent === '单步训练')!;
    await act(async () => { step.click(); });
    expect(saved.mlWeight).not.toBe(0);
    expect(saved.mlBias).not.toBe(0);
    expect(Number(container.querySelector('[data-testid="ml-train-loss"]')!.textContent)).toBeLessThan(firstLoss);
    expect(container.textContent).toContain('已更新 1 步');
    await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent === '重置实验')!.click(); });
    expect(saved).toEqual(ML_DEFAULTS);
    expect(Number(container.querySelector('[data-testid="ml-train-loss"]')!.textContent)).toBe(firstLoss);
    await act(async () => { root.unmount(); });
  });
});
