import {describe, expect, it} from 'vitest';
import {compareCode} from './code-diff';
import {lessons} from './data/lessons';

describe('starter code comparison', () => {
  it('aligns a replacement and keeps original and current line numbers', () => {
    expect(compareCode('def square(x):\n    pass\nprint(square(2))', 'def square(x):\n    return x*x\nprint(square(2))')).toEqual({
      limited: false, added: 1, removed: 1,
      lines: [
        {kind: 'same', text: 'def square(x):', before: 1, after: 1},
        {kind: 'removed', text: '    pass', before: 2},
        {kind: 'added', text: '    return x*x', after: 2},
        {kind: 'same', text: 'print(square(2))', before: 3, after: 3},
      ],
    });
  });

  it.each([
    ['', '', 0, 0],
    ['', 'hello', 1, 0],
    ['hello', '', 0, 1],
    ['a\nb', 'a\ninserted\nb', 1, 0],
    ['a\nb\na', 'a\na', 0, 1],
    ['a\r\nb', 'a\nb', 0, 0],
    ['    pass', '\tpass', 1, 1],
    ['pass', 'pass ', 1, 1],
    ['pass', 'pass\n', 1, 0],
    ['# 中文\nx = "<script>"', '# 中文\nx = "$x$"', 1, 1],
  ])('compares %j to %j without losing whitespace', (before, after, added, removed) => {
    expect(compareCode(before, after)).toMatchObject({limited: false, added, removed});
  });

  it('can reconstruct both inputs even with repeated and blank lines', () => {
    const samples = ['', 'a', 'a\na', 'a\nb', 'b\na', '\na\n', 'a\n\nb'];
    for (const before of samples) for (const after of samples) {
      const result = compareCode(before, after);
      if (result.limited) throw new Error('small input must be compared');
      for (const [source, excluded, key] of [[before, 'added', 'before'], [after, 'removed', 'after']] as const) {
        const lines = result.lines.filter(line => line.kind !== excluded);
        expect(lines.map(line => line.text).join('\n')).toBe(source);
        expect(lines.map(line => line[key])).toEqual(lines.map((_, i) => i + 1));
      }
    }
  });

  it.each([
    ['a'.repeat(100_001), ''],
    ['', 'b'.repeat(100_001)],
    ['a\n'.repeat(800), 'b\n'.repeat(800)],
    ['a\n'.repeat(707), 'b\n'.repeat(707)],
    ['', '\n'.repeat(1500)],
  ])('bounds large inputs before allocating the comparison table', (before, after) => {
    expect(compareCode(before, after)).toEqual({limited: true});
  });

  it('supports every shipped exercise and reference within the preview limits', () => {
    for (const lesson of lessons) {
      expect(compareCode(lesson.starter, lesson.reference).limited, lesson.id).toBe(false);
    }
  });
});
