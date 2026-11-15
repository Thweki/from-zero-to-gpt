import {test, expect} from '@playwright/test';

const enabled = process.env.VITE_EXPERIMENTAL_STUDY_TIMER === 'true';

test('study timer is absent by default', async ({page}) => {
  test.skip(enabled, 'Run without the experimental flag to verify the default.');
  await page.goto('/#/lesson/functions');
  await expect(page.getByRole('heading', {name: '函数是什么', exact: true})).toBeVisible();
  await expect(page.getByRole('region', {name: '学习计时 · 实验性'})).toHaveCount(0);
});

test('opt-in timer survives navigation, pauses on session end, and resets on reload', async ({page}) => {
  test.skip(!enabled, 'Run with VITE_EXPERIMENTAL_STUDY_TIMER=true on an unused PLAYWRIGHT_PORT.');
  await page.goto('/#/lesson/functions');
  const timer = page.getByRole('timer', {name: '本次学习用时'});
  await expect(timer).toHaveText('00:00:00');
  await page.getByRole('button', {name: '开始计时', exact: true}).click();
  await expect(timer).not.toHaveText('00:00:00');
  await page.locator('.lesson-nav-link[href="#/lesson/linear"]').click();
  await expect(page.getByRole('heading', {name: '线性函数与参数', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: '暂停计时', exact: true})).toBeVisible();
  await page.getByRole('button', {name: '保存学习断点', exact: true}).click();
  await page.getByRole('button', {name: '保存并结束本次学习', exact: true}).click();
  await expect(page).toHaveURL(/#\/map$/);
  await expect(page.getByRole('button', {name: '继续计时', exact: true})).toBeVisible();
  await expect(timer).not.toHaveText('00:00:00');
  await page.setViewportSize({width: 360, height: 800});
  const region = page.getByRole('region', {name: '学习计时 · 实验性'});
  await expect(region).toBeVisible();
  expect(await region.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.reload();
  await expect(timer).toHaveText('00:00:00');
  await expect(page.getByRole('button', {name: '开始计时', exact: true})).toBeVisible();
});
