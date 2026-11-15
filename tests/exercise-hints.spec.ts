import {test, expect} from '@playwright/test';

test('experimental hints opt in, reveal by keyboard and preserve code through reload and opt-out', async ({page}) => {
  await page.goto('/#/lesson/functions');
  await page.getByRole('tab', {name: '代码实现', exact: true}).click();
  const hints = page.getByRole('group', {name: '编程提示 · 实验性'});
  await expect(hints).toHaveCount(0);
  await page.getByLabel('Python 代码编辑器').fill('# my own attempt');
  await page.getByRole('link', {name: '设置与数据'}).click();
  await page.getByRole('checkbox', {name: '启用渐进编程提示'}).check();
  await page.getByRole('link', {name: '函数是什么', exact: true}).click();
  await expect(hints).toBeVisible();
  await expect(hints.locator('li')).toHaveCount(0);
  for (let step = 1; step <= 3; step++) {
    const reveal = hints.getByRole('button', {name: `展开第 ${step} 条提示`});
    await reveal.focus();
    await page.keyboard.press('Enter');
    await expect(hints.locator('li')).toHaveCount(step);
  }
  await expect(hints.getByRole('button', {name: '提示已全部展开'})).toBeDisabled();
  await expect(page.getByLabel('Python 代码编辑器')).toHaveValue('# my own attempt');
  await page.reload();
  await expect(hints).toBeVisible();
  await expect(hints.locator('li')).toHaveCount(0);
  await page.getByRole('link', {name: '设置与数据'}).click();
  await page.getByRole('checkbox', {name: '启用渐进编程提示'}).uncheck();
  await page.getByRole('link', {name: '函数是什么', exact: true}).click();
  await expect(hints).toHaveCount(0);
  await expect(page.getByLabel('Python 代码编辑器')).toHaveValue('# my own attempt');
});
