import {test, expect} from '@playwright/test';

for (const width of [390, 1440]) test(`glossary stays in the lesson and persists at ${width}px`, async ({page}) => {
  await page.setViewportSize({width, height:900});
  await page.goto('/#/lesson/functions');
  const toggle = page.getByRole('button', {name:'术语表',exact:true});
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await toggle.click();
  const panel = page.getByRole('region', {name:'本章术语参考'});
  const select = panel.getByLabel('选择术语 · 优先显示本章相关');
  await expect(select).toHaveValue('function');
  await select.selectOption('attention');
  await expect(panel).toContainText('Query 与 Key');
  await expect(page).toHaveURL(/#\/lesson\/functions$/);
  await expect(page.getByRole('tab', {name:'直觉理解',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('tab', {name:'数学推导',exact:true}).click();
  await expect(select).toHaveValue('attention');
  await expect.poll(() => page.evaluate(async () => {
    const request = indexedDB.open('from-zero-to-gpt',1);
    const db = await new Promise<IDBDatabase>(resolve => {request.onsuccess = () => resolve(request.result);});
    try {
      const read = db.transaction('learning').objectStore('learning').get('state');
      const state = await new Promise<any>(resolve => {read.onsuccess = () => resolve(read.result);});
      return state?.progress.functions;
    } finally {db.close();}
  })).toMatchObject({mode:'math',glossary:{open:true,termId:'attention'}});
  await page.reload();
  await expect(select).toHaveValue('attention');
  await expect(page.getByRole('tab', {name:'数学推导',exact:true})).toHaveAttribute('aria-selected','true');
  await page.evaluate(() => window.scrollTo(0,500));
  await expect(toggle).toBeInViewport();
  const bounds = (await panel.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  await select.focus();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await toggle.press('Enter');
  await expect(select).toHaveValue('attention');
  await panel.getByRole('button', {name:'关闭术语表'}).click();
  await expect(toggle).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
