export interface CodeDiffLine {
  kind: 'same' | 'added' | 'removed';
  text: string;
  before?: number;
  after?: number;
}

export type CodeDiff = {limited: true} | {
  limited: false;
  lines: CodeDiffLine[];
  added: number;
  removed: number;
};

// Keep both the quadratic comparison and the rendered result bounded. These
// limits affect only the preview, never the editor or the code being executed.
export function compareCode(before: string, after: string): CodeDiff {
  if (before.length > 100_000 || after.length > 100_000) return {limited: true};
  const split = (text: string) => text === '' ? [] : text.replace(/\r\n/g, '\n').split('\n');
  const a = split(before), b = split(after);
  if (a.length + b.length > 1500 || (a.length + 1) * (b.length + 1) > 500_000) return {limited: true};
  const width = b.length + 1;
  const lengths = new Uint16Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i * width + j] = a[i] === b[j]
        ? lengths[(i + 1) * width + j + 1] + 1
        : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
    }
  }
  const lines: CodeDiffLine[] = [];
  let i = 0, j = 0, added = 0, removed = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push({kind: 'same', text: a[i], before: ++i, after: ++j});
    } else if (i < a.length && (j === b.length || lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
      lines.push({kind: 'removed', text: a[i], before: ++i});
      removed++;
    } else {
      lines.push({kind: 'added', text: b[j], after: ++j});
      added++;
    }
  }
  return {limited: false, lines, added, removed};
}
