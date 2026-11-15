import {test,expect} from '@playwright/test';

for(const width of [1440,390])test(`course text search opens the matching reading mode at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto('/#/lesson/linear');
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();
  await page.getByLabel('搜索知识点',{exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'搜索知识点结果'});
  await page.getByLabel('搜索词',{exact:true}).fill('线性函数 仿射映射');
  await expect(dialog.getByRole('status')).toHaveText('找到 1 章');
  const result=dialog.locator(':scope > button');
  await expect(result).toContainText('深入研究');
  await expect(result.locator('.search-snippet')).toContainText('仿射映射');
  expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  // Same-chapter selection must switch modes even without a hashchange.
  await result.focus();await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('tab',{name:'深入研究',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#lesson-mode-panel')).toContainText('仿射映射');

  await page.getByLabel('搜索知识点',{exact:true}).click();
  await page.getByLabel('搜索词',{exact:true}).fill('陪域');
  await dialog.locator(':scope > button').filter({hasText:'函数是什么'}).click();
  await expect(page).toHaveURL(/#\/lesson\/functions$/);
  await expect(page.getByRole('tab',{name:'数学推导',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#lesson-mode-panel')).toContainText('B 是陪域');
  await page.reload();
  await expect(page.getByRole('tab',{name:'数学推导',exact:true})).toHaveAttribute('aria-selected','true');
});

test('search supports empty results, clearing, and chapters beyond the former result limit',async({page})=>{
  await page.goto('/');
  await page.getByLabel('搜索知识点',{exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'搜索知识点结果'});
  const input=page.getByLabel('搜索词',{exact:true});
  await input.fill('不存在的搜索词');
  await expect(dialog.getByRole('status')).toHaveText('找到 0 章');
  await expect(dialog.locator(':scope > button')).toHaveCount(0);
  await expect(dialog.locator('.empty-result')).toBeVisible();
  await input.fill('   ');
  await expect(dialog.getByRole('status')).toHaveText('全部 83 章');
  await expect(dialog.locator(':scope > button')).toHaveCount(83);
  await dialog.locator(':scope > button').last().click();
  await expect(page).toHaveURL(/#\/lesson\//);
  await expect(dialog).toHaveCount(0);
});
