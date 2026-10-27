import {test,expect} from '@playwright/test';
import {expectSectionAligned} from './layout-helpers';

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

for(const reducedMotion of ['reduce','no-preference'] as const)test(`${reducedMotion}: section navigation aligns below measured tools, including a delayed lazy experiment`,async({page})=>{
 await page.setViewportSize({width:1510,height:745});await page.emulateMedia({reducedMotion});
 let release!:()=>void;
 const held=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/src/components/labs/AdvancedMathLab.tsx*',async route=>{await held;await route.continue();});
 await page.goto('/#/lesson/gradients');
 await expect(page.locator('.lab-loading')).toBeVisible();
 await page.getByRole('button',{name:'我已读完，去做实验',exact:true}).click();
 release();
 await expectSectionAligned(page,'lesson-experiment');
 const chart=(await page.locator('#lesson-experiment .am-chart').boundingBox())!;
 expect(chart.y+chart.height).toBeLessThanOrEqual(745);
 for(const [label,id] of [['跳到 Python 代码','lesson-code'],['跳到自测练习','lesson-quiz'],['跳到本章正文','lesson-mode-panel'],['跳到交互实验','lesson-experiment']]){
  await page.getByText('本章定位',{exact:true}).click();await page.getByRole('button',{name:label,exact:true}).click();
  await expectSectionAligned(page,id);
 }
});
