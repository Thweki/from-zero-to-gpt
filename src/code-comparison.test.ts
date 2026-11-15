import { describe, expect, it } from 'vitest';
import { compareCode, comparisonLimits } from './code-comparison';
import { lessons } from './data/lessons';

describe('literal Python line comparison', () => {
  it('aligns unchanged lines around edits with independent source line numbers', () => {
    expect(compareCode('def f(x):\n    return None\nprint(f(2))', '# square\ndef f(x):\n    return x*x\nprint(f(2))')).toEqual([
      { kind: 'reference', reference: 1, text: '# square' },
      { kind: 'same', mine: 1, reference: 2, text: 'def f(x):' },
      { kind: 'mine', mine: 2, text: '    return None' },
      { kind: 'reference', reference: 3, text: '    return x*x' },
      { kind: 'same', mine: 3, reference: 4, text: 'print(f(2))' },
    ]);
  });

  it('preserves indentation, blank lines, trailing spaces and the final newline', () => {
    const rows = compareCode('if True:\n    pass\n\n', 'if True:\n\tpass \n')!;
    expect(rows.filter(row => row.kind === 'mine').map(row => row.text)).toEqual(['    pass', '']);
    expect(rows.filter(row => row.kind === 'reference').map(row => row.text)).toEqual(['\tpass ']);
  });

  it('treats Windows and Unix newlines alike', () => {
    expect(compareCode('a\r\nb\r\n', 'a\nb\n')?.every(row => row.kind === 'same')).toBe(true);
  });

  it('handles empty sources and full insertions or deletions', () => {
    expect(compareCode('', '')).toEqual([]);
    expect(compareCode('', 'a\nb')).toEqual([
      { kind: 'reference', reference: 1, text: 'a' }, { kind: 'reference', reference: 2, text: 'b' },
    ]);
    expect(compareCode('a', '')).toEqual([{ kind: 'mine', mine: 1, text: 'a' }]);
  });

  it('aligns repeated lines deterministically without losing either source', () => {
    const rows = compareCode('a\nb\na', 'a\na\nb')!;
    expect(rows.filter(row => row.kind === 'same').map(row => row.text)).toEqual(['a', 'a']);
    expect(rows.filter(row => row.mine).map(row => row.text).join('\n')).toBe('a\nb\na');
    expect(rows.filter(row => row.reference).map(row => row.text).join('\n')).toBe('a\na\nb');
  });

  it('bounds alignment work and output for large pastes on either side', () => {
    for (const huge of ['x'.repeat(comparisonLimits.characters + 1), '\n'.repeat(comparisonLimits.lines)]) {
      expect(compareCode(huge, '')).toBeNull();
      expect(compareCode('', huge)).toBeNull();
    }
    expect(compareCode('x'.repeat(comparisonLimits.characters), '')).toHaveLength(1);
    expect(compareCode('\n'.repeat(comparisonLimits.lines - 1), '')).toHaveLength(comparisonLimits.lines);
  });

  it.each(lessons.map(lesson => [lesson.id, lesson] as const))('can compare and reconstruct both bundled sources in %s', (_id, lesson) => {
    const rows = compareCode(lesson.starter, lesson.reference);
    expect(rows).not.toBeNull();
    for (const [side, source] of [['mine', lesson.starter], ['reference', lesson.reference]] as const) {
      const sourced = rows!.filter(row => row[side] !== undefined);
      expect(sourced.map(row => row.text).join('\n')).toBe(source.replace(/\r\n/g, '\n'));
      expect(sourced.map(row => row[side])).toEqual(sourced.map((_, i) => i + 1));
    }
  });
});
