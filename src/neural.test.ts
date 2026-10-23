import { describe, expect, it } from 'vitest';
import katex from 'katex';
import graph from './data/knowledge-graph.json';
import { stage3Lessons } from './data/stage3';
import { activationDerivative, activationValue, graphGradients, networkForward, numericalGradient, optimizerUpdate } from './components/labs/NeuralLab';

// Node-only test helper; the production browser source needs no Node typings.
const processModule = 'node:child_process';
const { execFileSync } = await import(processModule);

describe('第三阶段教材与真实 Python 练习', () => {
  it('11 个章节与知识图的标题、顺序和先修一致', () => {
    const nodes = graph.nodes.filter(n => n.stage === 3);
    expect(stage3Lessons.map(l => l.id)).toEqual(nodes.map(n => n.id));
    for (const lesson of stage3Lessons) {
      const node = nodes.find(n => n.id === lesson.id)!;
      expect(lesson.title).toBe(node.title);
      expect(lesson.prerequisites).toEqual(node.prerequisites);
      expect(lesson.lab).toBe('neural-network');
      expect(lesson.quiz.options).toHaveLength(4);
      expect(lesson.problem.length).toBeGreaterThan(50);
      expect(lesson.goals.length).toBeGreaterThanOrEqual(3);
      expect(lesson.misconceptions.length).toBeGreaterThanOrEqual(3);
      expect(lesson.references.length).toBeGreaterThanOrEqual(2);
      for (const text of [lesson.labTask, lesson.exercise, lesson.codeExplanation]) expect(text.length).toBeGreaterThan(30);
      expect(lesson.quiz.hint.length).toBeGreaterThan(15);
      expect(lesson.quiz.explanation.length).toBeGreaterThan(25);
      expect(lesson.reference).not.toMatch(/TODO|\.\.\./);
      for (const sections of [lesson.intuition, lesson.math, lesson.deep]) {
        expect(sections.length).toBeGreaterThanOrEqual(2);
        for (const section of sections) expect(section.paragraphs.join('').length).toBeGreaterThan(60);
      }
    }
  });

  it.each(stage3Lessons)('$id 的所有公式严格渲染', lesson => {
    for (const formula of [lesson.formula, ...lesson.math.map(s => s.formula).filter(Boolean)]) {
      expect(formula).not.toMatch(/[\u0000-\u001f]/);
      expect(() => katex.renderToString(formula!, { throwOnError: true, strict: 'error' })).not.toThrow();
    }
  });

  it.each(stage3Lessons)('$id 参考程序在真实 CPython 中通过章节断言', lesson => {
    const output = execFileSync('python3', ['-c', lesson.reference + '\n' + lesson.pythonTests + '\nprint("CHECK_OK")'], { encoding: 'utf8', timeout: 10000 });
    expect(output).toContain('CHECK_OK');
  });

  it.each(stage3Lessons)('$id 起始程序由断言指出待完成的任务', lesson => {
    try {
      execFileSync('python3', ['-c', lesson.starter + '\n' + lesson.pythonTests], { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] });
      throw new Error('起始程序不应在尚未完成任务时通过全部测试');
    } catch (error) {
      expect(String((error as { stderr?: string }).stderr)).toContain('AssertionError');
    }
  });

  it('完整标准库引擎的共享节点、数值梯度与 XOR 训练测试通过', () => {
    const output = execFileSync('python3', ['-m', 'unittest', '-v'], { cwd: 'projects/micrograd', encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
    expect(typeof output).toBe('string');
  });
});

describe('真实神经网络与梯度流计算', () => {
  it('激活斜率与独立差分相符，饱和与 ReLU 零点约定明确', () => {
    for (const kind of [0, 1, 2]) for (const z of [-2.1, -.4, .8, 2.7]) {
      expect(activationDerivative(z, kind)).toBeCloseTo(numericalGradient(x => activationValue(x, kind), z), 7);
    }
    expect(activationDerivative(0, 0)).toBe(0);
    expect(activationDerivative(6, 1)).toBeLessThan(.0001);
    expect(activationValue(0, 2)).toBe(.5);
  });

  it('所有叶子梯度匹配正负输入下的中心差分', () => {
    for (const [x, w, b] of [[2, .5, 1], [-.7, .3, -.2], [0, -2, .4], [1.3, -.8, 1.04]]) {
      const r = graphGradients(x, w, b);
      expect(r.dw).toBeCloseTo(numericalGradient(a => (a * x + b) ** 2, w), 7);
      expect(r.dx).toBeCloseTo(numericalGradient(a => (w * a + b) ** 2, x), 7);
      expect(r.db).toBeCloseTo(numericalGradient(a => (w * x + a) ** 2, b), 7);
    }
    expect(graphGradients(2, .5, 1)).toMatchObject({ loss: 4, dw: 8, db: 4, dx: 2 });
  });

  it('多层网络遵循输出权重线性与隐藏层非线性，参数真实改变输出', () => {
    const a = networkForward(.7, .8, .2, -1, 1.3, -.4, .1);
    const withoutSecond = networkForward(.7, .8, .2, -1, 1.3, 0, .1);
    expect(a.y - withoutSecond.y).toBeCloseTo(-.4 * a.h2);
    const derivative = numericalGradient(w => networkForward(.7, w, .2, -1, 1.3, -.4, .1).y, .8);
    expect(derivative).toBeCloseTo(1.3 * (1 - a.h1 ** 2) * .7, 7);
    expect(networkForward(.7, -.8, .2, -1, 1.3, -.4, .1).y).not.toBeCloseTo(a.y);
  });

  it('小学习率 SGD 降低真实正则目标，大步可增大目标', () => {
    const loss = (w: number) => (2 * w + .2) ** 2 + .1 * w * w / 2;
    const w = .7, gradient = graphGradients(2, w, .2).dw + .1 * w;
    expect(loss(optimizerUpdate(w, gradient, .05, 0).w)).toBeLessThan(loss(w));
    expect(loss(optimizerUpdate(w, gradient, 1, 0).w)).toBeGreaterThan(loss(w));
  });

  it('Momentum 保留方向，Adam 校正首步并保存后续状态', () => {
    const first = optimizerUpdate(1, 2, .1, 1);
    const second = optimizerUpdate(first.w, 2, .1, 1, first.velocity);
    expect(first.w).toBeCloseTo(.8);
    expect(second.w).toBeCloseTo(.42);
    const adam = optimizerUpdate(1, 2, .1, 2);
    expect(adam.w).toBeCloseTo(.9, 7);
    const next = optimizerUpdate(adam.w, -1, .1, 2, adam.velocity, adam.moment, adam.secondMoment, adam.iteration);
    const reset = optimizerUpdate(adam.w, -1, .1, 2);
    expect(next.w).not.toBeCloseTo(reset.w);
    expect(next.iteration).toBe(2);
  });
});
