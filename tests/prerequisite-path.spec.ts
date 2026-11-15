import {test,expect} from '@playwright/test';
import {expectNoPageOverflow} from './layout-helpers';

test('prerequisite path respects saved self-assessment and supports keyboard navigation',async({page})=>{
  await page.goto('/#/lesson/linear');
  await page.getByRole('button',{name:'自评为已掌握',exact:true}).click();
  await page.goto('/#/lesson/dot-product');
  const path=page.locator('.prerequisite-path');
  await path.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(path.getByRole('listitem')).toHaveCount(3);
  await expect(path.locator('summary')).toContainText('2 / 3');
  await path.getByLabel('隐藏自评已掌握的章节').check();
  await expect(path.getByRole('listitem')).toHaveCount(2);
  await expect(path.getByRole('button',{name:'学习先修：线性函数与参数',exact:true})).toHaveCount(0);
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();
  await expect(path.getByRole('listitem')).toHaveCount(2);
  await path.getByRole('button',{name:'学习先修：函数是什么',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/lesson\/functions$/);
  await path.locator('summary').click();
  await expect(path).toContainText('可以直接从本章开始');
});

test('the complete path stays usable on a narrow screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/lesson/dot-product');
  const path=page.locator('.prerequisite-path');
  await path.locator('summary').click();
  await expect(path.locator('li strong')).toHaveText(['函数是什么','线性函数与参数','向量的基本概念']);
  await expectNoPageOverflow(page);
  await path.getByRole('button',{name:'学习先修：向量的基本概念',exact:true}).click();
  await expect(page).toHaveURL(/#\/lesson\/vectors$/);
  await path.locator('summary').click();
  await expect(path.getByRole('listitem')).toHaveCount(1);
});
