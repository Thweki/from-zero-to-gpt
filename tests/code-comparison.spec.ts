import { test, expect } from '@playwright/test';
import { lessonById } from '../src/data/lessons';

for (const width of [1440, 390]) test(`compare Python code without replacing the draft at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/#/lesson/functions');
  await page.getByRole('tab', { name: '代码实现', exact: true }).click();
  const editor = page.getByLabel('Python 代码编辑器');
  const draft = 'def square(x):\n    return None\n# ' + 'long comment '.repeat(40);
  await editor.fill(draft);
  await page.getByRole('button', { name: '对照参考', exact: true }).click();
  await page.getByRole('button', { name: '逐行比较我的代码', exact: true }).click();
  const comparison = page.locator('.code-comparison');
  await expect(comparison.locator('[role="status"]')).toContainText('仅我的代码');
  await expect(comparison.locator('[data-kind="mine"]')).toContainText(['    return None', '# long comment']);
  await expect(editor).toHaveValue(draft);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '查看完整参考', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(comparison.locator('pre')).toHaveText(lessonById.functions.reference);
  await page.getByRole('button', { name: '逐行比较我的代码', exact: true }).click();
  await editor.fill(lessonById.functions.reference);
  await expect(comparison.getByRole('status')).toHaveText('两份代码逐行相同。');
  await editor.fill(draft);
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('from-zero-to-gpt', 1);
      request.onsuccess = () => resolve(request.result);
    });
    try {
      return await new Promise<string | undefined>(resolve => {
        const request = db.transaction('learning').objectStore('learning').get('state');
        request.onsuccess = () => resolve(request.result?.progress?.functions?.code);
      });
    } finally { db.close(); }
  })).toBe(draft);
  await page.reload();
  await expect(editor).toHaveValue(draft);
});
