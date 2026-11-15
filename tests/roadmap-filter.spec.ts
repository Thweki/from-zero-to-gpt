import {expect, test} from '@playwright/test';

test('roadmap filters saved activity, navigates to a result, and restores the stage view',async({page})=>{
  await page.goto('/#/lesson/functions');
  await page.getByRole('button',{name:'稍后复习本章',exact:true}).click();
  await expect(page.getByRole('button',{name:'稍后复习本章',exact:true})).toHaveClass(/bookmarked/);
  await page.getByRole('link',{name:'学习首页'}).click();
  await expect(page.locator('.stage-list')).toBeVisible();
  await page.getByLabel('按学习记录筛选',{exact:true}).selectOption('review');
  const results = page.getByRole('region',{name:'筛选章节'});
  await expect(results.locator('.chapter-row')).toHaveCount(1);
  await expect(results).toContainText('函数是什么');
  await expect(page.locator('.stage-list')).toHaveCount(0);
  await results.getByRole('button',{name:/函数是什么/}).click();
  await expect(page).toHaveURL(/#\/lesson\/functions$/);
  await expect(page.locator('.autosave')).toContainText('已本地保存');
  await page.reload();
  await expect(page.getByRole('button',{name:'稍后复习本章',exact:true})).toHaveClass(/bookmarked/);
  await page.getByRole('link',{name:'学习首页'}).click();
  await page.getByLabel('按学习记录筛选',{exact:true}).selectOption('mastered');
  await expect(results).toContainText('没有符合此筛选的章节');
  await page.getByLabel('按学习记录筛选',{exact:true}).selectOption('learning');
  await expect(results.locator('.chapter-row')).toHaveCount(1);
  await page.getByLabel('按学习记录筛选',{exact:true}).selectOption('all');
  await expect(page.locator('.stage-list')).toBeVisible();
});
