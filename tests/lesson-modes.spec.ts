import {test,expect} from '@playwright/test';

test('four distinct views keep code, experiments and quiz state when switching',async({page})=>{
 await page.goto('/#/lesson/linear');
 await page.getByRole('slider',{name:'斜率 k',exact:true}).fill('2');
 await page.locator('.quiz-options input').nth(1).check();
 await page.getByRole('tab',{name:'数学推导',exact:true}).click();
 await expect(page.locator('#lesson-experiment,.quiz-card,.code-lab,.references')).toHaveCount(0);
 await expect(page.locator('.katex')).not.toHaveCount(0);
 await page.getByRole('tab',{name:'代码实现',exact:true}).click();
 await expect(page.locator('#lesson-experiment,.quiz-card,.references')).toHaveCount(0);
 await expect(page.locator('.code-description')).toHaveCount(1);
 await page.getByLabel('Python 代码编辑器').fill('draft = "继续验证斜率"');
 await page.getByRole('tab',{name:'深入研究',exact:true}).click();
 await expect(page.locator('#lesson-experiment,.quiz-card,.code-lab,.exercise-section')).toHaveCount(0);
 await expect(page.locator('.references a').first()).toBeVisible();
 await page.getByRole('tab',{name:'直觉理解',exact:true}).click();
 await expect(page.getByRole('slider',{name:'斜率 k',exact:true})).toHaveValue('2');
 await expect(page.locator('.quiz-options input').nth(1)).toBeChecked();
 await page.getByRole('tab',{name:'代码实现',exact:true}).click();
 await expect(page.getByLabel('Python 代码编辑器')).toHaveValue('draft = "继续验证斜率"');
 await page.reload();await expect(page.getByRole('tab',{name:'代码实现',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.getByLabel('Python 代码编辑器')).toHaveValue('draft = "继续验证斜率"');
});

test('chapter navigation selects the view that owns the destination',async({page})=>{
 await page.goto('/#/lesson/functions');
 for(const [label,id,mode] of [['跳到 Python 代码','lesson-code','code'],['跳到自测练习','lesson-quiz','intuition'],['跳到交互实验','lesson-experiment','intuition']] as const){
  await page.getByRole('tab',{name:'深入研究',exact:true}).click();
  await page.getByText('本章定位',{exact:true}).click();await page.getByRole('button',{name:label,exact:true}).click();
  await expect(page.getByRole('tabpanel')).toHaveAttribute('data-mode',mode);
  await expect(page.locator('#'+id)).toBeFocused();
  await expect(page.locator('.lesson-location')).not.toHaveAttribute('open');
 }
});
