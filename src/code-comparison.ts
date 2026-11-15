export type ComparisonLine = {
  kind: 'same' | 'mine' | 'reference';
  text: string;
  mine?: number;
  reference?: number;
};

// Bound both the quadratic alignment work and the rendered table size.
export const comparisonLimits = { characters: 50000, lines: 500 };

/** Compare literal lines, preserving Python indentation. CRLF and LF are equivalent. */
export function compareCode(mine: string, reference: string): ComparisonLine[] | null {
  if (mine.length > comparisonLimits.characters || reference.length > comparisonLimits.characters) return null;
  const lines = (source: string) => source === '' ? [] : source.replace(/\r\n/g, '\n').split('\n');
  const a = lines(mine), b = lines(reference);
  if (a.length > comparisonLimits.lines || b.length > comparisonLimits.lines) return null;
  const width = b.length + 1;
  const lengths = new Uint16Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i * width + j] = a[i] === b[j]
        ? lengths[(i + 1) * width + j + 1] + 1
        : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
    }
  }
  const result: ComparisonLine[] = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      result.push({ kind: 'same', text: a[i], mine: ++i, reference: ++j });
    } else if (i < a.length && (j === b.length || lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
      result.push({ kind: 'mine', text: a[i], mine: ++i });
    } else {
      result.push({ kind: 'reference', text: b[j], reference: ++j });
    }
  }
  return result;
}
