import {test, expect} from '@playwright/test';
import {emptyProgress, initialState} from '../src/storage';
import {lessonIds} from '../src/data/lesson-ids';

test('home history records real visits, reorders without duplicates, and supports keyboard reopening after reload', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {level:1})).toBeVisible();
  await expect(page.getByRole('region', {name:'最近打开'})).toHaveCount(0);
  await page.getByRole('button', {name:'开始探索', exact:true}).click();
  await expect(page.getByRole('heading', {level:1})).toContainText('函数是什么');
  await page.locator('.lesson-nav-link[href="#/lesson/linear"]').click();
  await expect(page.getByRole('heading', {level:1})).toContainText('线性函数');
  await page.locator('.home-link').click();
  const recent = page.getByRole('region', {name:'最近打开'});
  await expect(recent.getByRole('link')).toHaveCount(2);
  await expect(recent.getByRole('link').first()).toHaveAttribute('href', '#/lesson/linear');
  await recent.locator('a[href="#/lesson/functions"]').click();
  await expect(page.getByRole('heading', {level:1})).toContainText('函数是什么');
  await page.locator('.home-link').click();
  await expect(recent.getByRole('link').first()).toHaveAttribute('href', '#/lesson/functions');
  await page.reload();
  await expect(recent.getByRole('link')).toHaveCount(2);
  await expect(recent.getByRole('link').first()).toHaveAttribute('href', '#/lesson/functions');
  await recent.getByRole('link').nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/lesson\/linear$/);
  await expect(page.getByRole('heading', {level:1})).toContainText('线性函数');
});

test('imported visits appear newest first with six links and fit a narrow home page', async ({page}) => {
  const state = initialState();
  const ids = [...lessonIds.slice(0, 7), lessonIds.at(-1)!];
  ids.forEach((id, i) => {state.progress[id] = {...emptyProgress(), lastVisited:new Date(Date.UTC(2026, 0, i + 1)).toISOString()};});
  await page.goto('/#/settings');
  await page.getByLabel('导入学习数据文件').setInputFiles({name:'history.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(state))});
  await expect(page.locator('.toast')).toContainText('学习数据已恢复');
  await page.locator('.home-link').click();
  const recent = page.getByRole('region', {name:'最近打开'});
  await expect(recent.getByRole('link')).toHaveCount(6);
  expect(await recent.getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(ids.slice(2).reverse().map(id => `#/lesson/${id}`));
  await page.setViewportSize({width:390, height:844});
  await recent.scrollIntoViewIfNeeded();
  for (const link of await recent.getByRole('link').all()) {
    const box = (await link.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(await recent.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});
