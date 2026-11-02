import { expect, type Locator } from '@playwright/test';
import { mathPartToLatex, splitMathText } from '../src/math-format';

export async function expectMathText(locator: Locator, text: string) {
  const parts = splitMathText(text);
  for (const part of parts) {
    if (part.type === 'text' && part.value.trim()) await expect(locator).toContainText(part.value.trim());
  }
  const annotations = await locator.locator('annotation[encoding="application/x-tex"]').allTextContents();
  for (const part of parts) {
    if (part.type === 'math') expect(annotations).toContain(mathPartToLatex(part));
  }
}

export async function expectFormula(locator: Locator, latex: string) {
  await expect(locator.locator('.katex-error')).toHaveCount(0);
  const annotations = await locator.locator('annotation[encoding="application/x-tex"]').allTextContents();
  expect(annotations.map(text => text.replace(/\s*=\s*/g, '='))).toContain(latex.replace(/\s*=\s*/g, '='));
}
