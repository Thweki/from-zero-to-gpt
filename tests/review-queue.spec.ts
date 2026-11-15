import { expect, test, type Page } from '@playwright/test';

async function storedState(page: Page) {
  return page.evaluate(async () => {
    const opening = indexedDB.open('from-zero-to-gpt', 1);
    const db = await new Promise<IDBDatabase>(resolve => { opening.onsuccess = () => resolve(opening.result); });
    try {
      const request = db.transaction('learning').objectStore('learning').get('state');
      return await new Promise<any>(resolve => { request.onsuccess = () => resolve(request.result); });
    } finally { db.close(); }
  });
}

test('experimental review is opt-in, schedules recall, and survives reload and disabling', async ({ page }) => {
  await page.goto('/#/lesson/functions');
  await expect(page.getByRole('heading', { name: '函数是什么', exact: true })).toBeVisible();
  await expect(page.locator('nav a[href="#/review"]')).toHaveCount(0);
  await expect.poll(async () => (await storedState(page))?.progress?.functions?.status).toBe('learning');
  const original = (await storedState(page)).progress.functions;
  await page.goto('/#/review');
  await expect(page.getByText('此功能默认关闭，请在设置中启用。')).toBeVisible();
  await page.getByRole('link', { name: '打开设置与数据', exact: true }).click();
  const toggle = page.getByRole('checkbox', { name: '启用间隔复习（实验性，默认关闭）' });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await page.getByRole('link', { name: '打开间隔复习', exact: true }).click();
  await expect(page.getByRole('region', { name: '复习答案' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '记住了 · 延长间隔', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '显示答案与解释' }).click();
  await expect(page.getByRole('region', { name: '复习答案' })).toBeVisible();
  await page.getByRole('button', { name: '记住了 · 延长间隔', exact: true }).click();
  await expect(page.getByRole('heading', { name: '当前没有待复习章节' })).toBeVisible();
  await expect.poll(async () => (await storedState(page))?.progress.functions.reviewSchedule?.step).toBe(1);
  const rated = (await storedState(page)).progress.functions;
  expect(rated).toEqual({ ...original, reviewSchedule: rated.reviewSchedule });
  await page.reload();
  await expect(page.getByRole('heading', { name: '当前没有待复习章节' })).toBeVisible();
  await page.locator('.sidebar a[href="#/settings"]').click();
  await toggle.uncheck();
  await expect(page.locator('nav a[href="#/review"]')).toHaveCount(0);
  await expect.poll(async () => (await storedState(page))?.reviewQueueEnabled).toBe(false);
  expect((await storedState(page)).progress.functions).toEqual(rated);
  await page.reload();
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await page.getByRole('link', { name: '打开间隔复习', exact: true }).click();
  await expect(page.getByRole('heading', { name: '当前没有待复习章节' })).toBeVisible();
});
