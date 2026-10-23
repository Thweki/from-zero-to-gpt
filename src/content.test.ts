import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import katex from 'katex';
import graph from './data/knowledge-graph.json';
import { lessons, lessonById } from './data/lessons';
import { dot, format, linear, norm } from './math';
import { emptyProgress, initialState, lessonIds, readState, validateImport, writeState } from './storage';
import type { LearningState, LessonId } from './types';

describe('课程依赖图', () => {
  it('83 个节点拥有唯一标识，六个阶段完整且每个依赖都存在', () => {
    const ids = new Set(graph.nodes.map(node => node.id));
    expect(graph.nodes).toHaveLength(83);
    expect(ids.size).toBe(graph.nodes.length);
    expect([...new Set(graph.nodes.map(node => node.stage))].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    for (const node of graph.nodes) {
      expect(node.title.trim().length).toBeGreaterThan(1);
      expect(node.prerequisites).not.toContain(node.id);
      expect(new Set(node.prerequisites).size).toBe(node.prerequisites.length);
      for (const dependency of node.prerequisites) {
        expect(ids.has(dependency), `${node.id} 的先修 ${dependency} 不存在`).toBe(true);
        const prerequisite = graph.nodes.find(other => other.id === dependency)!;
        expect(prerequisite.stage).toBeLessThanOrEqual(node.stage);
      }
    }
  });

  it('依赖是无环图，允许按先修顺序到达每个知识点', () => {
    const nodes = new Map(graph.nodes.map(node => [node.id, node]));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw new Error(`先修关系形成环：${[...visiting, id].join(' → ')}`);
      visiting.add(id);
      for (const dependency of nodes.get(id)!.prerequisites) visit(dependency);
      visiting.delete(id);
      visited.add(id);
    };
    for (const node of graph.nodes) visit(node.id);
    expect(visited.size).toBe(graph.nodes.length);
  });

  it('83个真实课程可进入，课程的先修关系与知识图同步', () => {
    const available = graph.nodes.filter(node => node.available);
    expect(available).toHaveLength(83);
    expect(available.map(node => node.id).sort()).toEqual(lessons.map(lesson => lesson.id).sort());
    expect(lessons.map(lesson => lesson.id).sort()).toEqual([...lessonIds].sort());
    for (const node of available) {
      const lesson = lessonById[node.id as LessonId];
      expect(lesson.title).toBe(node.title);
      expect([...lesson.prerequisites].sort()).toEqual([...node.prerequisites].sort());
      for (const prerequisite of lesson.prerequisites) expect(lessonById[prerequisite]).toBeDefined();
    }
  });
});

describe('教材验收', () => {
  it.each(lessons)('$title 包含实质解释、实验、代码、练习与来源', lesson => {
    expect(lesson.problem.length).toBeGreaterThan(50);
    expect(lesson.goals.length).toBeGreaterThanOrEqual(3);
    for (const sections of [lesson.intuition, lesson.math, lesson.deep]) {
      expect(sections.length).toBeGreaterThanOrEqual(2);
      for (const section of sections) {
        expect(section.title.trim()).not.toBe('');
        expect(section.paragraphs.length).toBeGreaterThanOrEqual(1);
        expect(section.paragraphs.join('').length).toBeGreaterThan(60);
      }
    }
    expect(lesson.labTask.length).toBeGreaterThan(30);
    expect(lesson.exercise.length).toBeGreaterThan(30);
    expect(lesson.codeExplanation.length).toBeGreaterThan(30);
    expect(lesson.starter).toContain('def ');
    expect(lesson.reference).toContain('def ');
    expect(lesson.reference).not.toMatch(/TODO|\.\.\./);
    expect(lesson.pythonTests).toContain('assert ');
    expect(lesson.misconceptions.length).toBeGreaterThanOrEqual(3);
    expect(lesson.references.length).toBeGreaterThanOrEqual(2);
    for (const reference of lesson.references) {
      expect(new URL(reference.url).protocol).toBe('https:');
      expect(reference.title.length).toBeGreaterThan(4);
      expect(reference.note.length).toBeGreaterThan(5);
    }
  });

  it.each(lessons)('$title 中的公式都能以严格 KaTeX 模式渲染', lesson => {
    const formulas = [lesson.formula, ...lesson.math.map(section => section.formula).filter((formula): formula is string => !!formula)];
    expect(formulas.length).toBeGreaterThanOrEqual(3);
    for (const formula of formulas) {
      expect(formula).not.toMatch(/[\u0000-\u001f]/);
      expect(() => katex.renderToString(formula, { throwOnError: true, strict: 'error' })).not.toThrow();
    }
  });

  it.each(lessons)('$title 的自测具有有效答案、解释及先行提示', lesson => {
    const quiz = lesson.quiz;
    expect(quiz.options.length).toBeGreaterThanOrEqual(3);
    expect(new Set(quiz.options).size).toBe(quiz.options.length);
    expect(Number.isInteger(quiz.correct)).toBe(true);
    expect(quiz.correct).toBeGreaterThanOrEqual(0);
    expect(quiz.correct).toBeLessThan(quiz.options.length);
    expect(quiz.question.length).toBeGreaterThan(10);
    expect(quiz.hint.length).toBeGreaterThan(15);
    expect(quiz.explanation.length).toBeGreaterThan(25);
  });
});

describe('实验的数学计算', () => {
  it('直线正确处理斜率、偏置、负数、小数与水平线', () => {
    expect(linear(2, 2, 1)).toBe(5);
    expect(linear(0, -3, -4)).toBe(-4);
    expect(linear(100, 0, 3)).toBe(3);
    expect(linear(-2, -2, 1)).toBe(5);
    expect(linear(0.5, 0.2, -0.1)).toBeCloseTo(0);
    expect(linear(3, 2, 3) - linear(3, 2, 1)).toBe(2);
  });

  it('点积符合正交、反向、双线性和维数约束', () => {
    expect(dot([2, 1], [1, 3])).toBe(5);
    expect(dot([2, 0], [0, 2])).toBe(0);
    expect(dot([1, 2], [-1, -2])).toBe(-5);
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(dot([2, 4], [3, 1])).toBe(2 * dot([1, 2], [3, 1]));
    expect(dot([1, 2], [3, 4])).toBe(dot([3, 4], [1, 2]));
    expect(() => dot([1, 2], [3])).toThrow(/维度/);
  });

  it('向量长度遵循勾股定理，反向不改变长度且零向量有效', () => {
    expect(norm([3, 4])).toBe(5);
    expect(norm([-3, -4])).toBe(5);
    expect(norm([0, 0])).toBe(0);
    expect(norm([1, 1])).toBeCloseTo(Math.SQRT2);
    expect(dot([3, 4], [3, 4])).toBe(norm([3, 4]) ** 2);
    expect(format(0.1 + 0.2)).toBe('0.3');
    expect(format(5)).toBe('5');
  });
});

const populatedState = (): LearningState => ({
  ...initialState(),
  theme: 'dark',
  lastLesson: 'linear',
  updatedAt: '2026-10-20T12:30:00.000Z',
  progress: {
    linear: {
      ...emptyProgress(),
      status: 'learning',
      mode: 'math',
      code: 'def linear(x, k, b):\n    return k * x + b\n',
      note: '斜率不变时，改变截距会平行移动直线。',
      review: true,
      quizAnswer: 0,
      quizPassed: true,
      labValues: { x: 2, k: 2, b: 1 },
      lastRun: '✓ 本章单元测试通过\n5',
    },
  },
  checkpoint: {
    lessonId: 'linear',
    question: '输入为负数时，我还想检验一次。',
    next: '测试 x=-2，再比较负斜率的图像。',
    savedAt: '2026-10-20T12:29:00.000Z',
    code: 'def linear(x, k, b):\n    return k * x + b\n',
    runResult: '5',
  },
});

describe('导出、导入与本地学习数据', () => {
  beforeEach(async () => { await deleteDB('from-zero-to-gpt'); });

  it('JSON 导出后导入完整保留笔记、代码、主题、实验、进度和学习断点', () => {
    const source = populatedState();
    expect(validateImport(JSON.parse(JSON.stringify(source)))).toEqual(source);
  });

  it('第一次打开得到无压力、未开始的初始状态', async () => {
    const state = await readState();
    expect(state).toMatchObject({ version: 1, theme: 'light', lastLesson: 'functions', progress: {} });
    expect(state.checkpoint).toBeUndefined();
    expect(emptyProgress()).toMatchObject({ status: 'new', review: false, note: '', code: '' });
  });

  it('IndexedDB 写入后重新打开，恢复全部学习状态；后续写入可更新', async () => {
    const source = populatedState();
    await writeState(source);
    expect(await readState()).toEqual(source);
    source.progress.linear!.note = '已验证负数；下一步学习向量。';
    source.lastLesson = 'vectors';
    await writeState(source);
    expect(await readState()).toEqual(source);
  });

  it.each([null, [], {}, { version: 2 }, 'not-json'])('拒绝未知或损坏的顶层结构：%j', value => {
    expect(() => validateImport(value)).toThrow();
  });

  it.each([
    { lastLesson: 'nonexistent' },
    { theme: 'sepia' },
    { progress: [] },
    { updatedAt: 'not-a-date' },
    { checkpoint: { lessonId: 'linear', savedAt: 'invalid' } },
  ])('拒绝损坏的元数据：%j', patch => {
    expect(() => validateImport({ ...populatedState(), ...patch })).toThrow();
  });

  it.each([
    { status: 'finished' },
    { mode: 'unknown' },
    { review: 'yes' },
    { note: 42 },
    { code: 'x'.repeat(100001) },
    { quizAnswer: -1 },
    { quizAnswer: 4 },
    { quizAnswer: 0.5 },
    { quizPassed: 'yes' },
    { lastRun: {} },
    { labValues: { k: Infinity } },
    { labValues: { k: NaN } },
    { labValues: { k: '2' } },
    { labValues: { k: 101 } },
    { labValues: { unexpected: 1 } },
  ])('拒绝损坏的章节数据：%j', patch => {
    const state = populatedState();
    expect(() => validateImport({ ...state, progress: { linear: { ...state.progress.linear, ...patch } } })).toThrow();
  });

  it('导入时移除无关字段，不执行数据中的 HTML 或脚本', () => {
    const state = populatedState();
    state.progress.linear!.note = '<script>alert("note")</script>';
    const imported = validateImport({ ...state, apiKey: 'should-not-be-kept' });
    expect(imported).not.toHaveProperty('apiKey');
    expect(imported.progress.linear!.note).toBe(state.progress.linear!.note);
  });
});
