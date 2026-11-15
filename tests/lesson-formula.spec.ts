import { test, expect } from '@playwright/test';
import { closeNotebook } from './focus-helpers';
import { expectNoPageOverflow } from './layout-helpers';

test('lesson formula cards copy their exact LaTeX with keyboard access', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#/lesson/functions');
  await closeNotebook(page);
  await page.getByRole('tab', { name: '数学推导', exact: true }).click();
  const cards = page.locator('.formula-card,.main-formula');
  expect(await cards.count()).toBeGreaterThan(0);
  for (const card of await cards.all()) {
    const source = await card.locator('annotation[encoding="application/x-tex"]').textContent();
    const copy = card.getByRole('button', { name: '复制 LaTeX', exact: true });
    await copy.focus();
    await page.keyboard.press('Enter');
    await expect(card.getByRole('status')).toHaveText('已复制 LaTeX');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(source);
    await expect(copy).toBeFocused();
  }
  // Inline math and interactive experiments retain their existing controls.
  await expect(page.locator('.prose-section p .formula-copy')).toHaveCount(0);
  await page.getByRole('tab', { name: '直觉理解', exact: true }).click();
  await expect(page.locator('#lesson-experiment .formula-copy')).toHaveCount(0);
});

test('clipboard denial exposes selectable source on a narrow screen and clears on navigation', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => Promise.reject(new Error('Clipboard denied')) },
  }));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/#/lesson/attention');
  await closeNotebook(page);
  await page.getByRole('tab', { name: '数学推导', exact: true }).click();
  const card = page.locator('.formula-card,.main-formula').first();
  const source = await card.locator('annotation[encoding="application/x-tex"]').textContent();
  await card.getByRole('button', { name: '复制 LaTeX', exact: true }).click();
  await expect(card.getByRole('status')).toContainText('请手动复制');
  const field = card.getByRole('textbox', { name: 'LaTeX 源码（不含 $ 分隔符）' });
  await expect(field).toHaveValue(source!);
  await expect(field).toBeFocused();
  expect(await field.evaluate((element: HTMLTextAreaElement) => element.value.slice(element.selectionStart, element.selectionEnd))).toBe(source);
  await expectNoPageOverflow(page);
  await page.getByRole('tab', { name: '深入研究', exact: true }).click();
  await page.getByRole('tab', { name: '数学推导', exact: true }).click();
  await expect(page.locator('.formula-copy textarea')).toHaveCount(0);
});
