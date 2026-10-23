import {test,expect} from '@playwright/test';

test('平方函数有效端点在桌面和500×757窄屏桌面内可见',async({page})=>{
  await page.goto('/#/lesson/functions');
  for(const viewport of [{width:1440,height:1000},{width:500,height:757}]){
    await page.setViewportSize(viewport);
    for(const x of ['-3','3']){
      await page.getByRole('slider',{name:'输入 x',exact:true}).fill(x);
      await expect(page.getByTestId('lab-result')).toHaveText(`f(${x}) = 9`);
      const geometry=await page.getByTestId('function-target').evaluate(n=>({cx:Number(n.getAttribute('cx')),cy:Number(n.getAttribute('cy')),r:Number(n.getAttribute('r'))}));
      await expect(page.getByTestId('function-projection')).toHaveAttribute('fill','none');
      expect(geometry.cy-geometry.r).toBeGreaterThan(5);
      expect(geometry.cy+geometry.r).toBeLessThan(305);
      expect(geometry.cx-geometry.r).toBeGreaterThan(6);
      expect(geometry.cx+geometry.r).toBeLessThan(631);
    }
    await page.getByRole('button',{name:'跳到交互实验'}).click();
    await expect(page.locator('#lesson-experiment')).toBeFocused();
    await expect.poll(()=>page.locator('#lesson-experiment').evaluate(n=>Math.round(n.getBoundingClientRect().top))).toBe(130);
    await page.screenshot({path:`artifacts/usability-review/square-${viewport.width}.png`});
  }
});

test('Python错误先显示用户行号与解释，内部堆栈默认折叠并能刷新恢复',async({page})=>{
  await page.goto('/#/lesson/functions');await page.getByRole('button',{name:'跳到 Python 代码'}).click();
  await page.getByLabel('Python 代码编辑器').fill('x = 2\ny = 3\nprint(missing_value)');
  await page.getByRole('button',{name:/运行并测试/}).click();
  const output=page.locator('.code-output');
  await expect(output.locator('.python-error-summary')).toContainText('第 3 行',{timeout:30000});
  await expect(output.locator('.python-error-summary')).toContainText('NameError');
  await expect(output.locator('.python-error-summary')).toContainText('还没有定义');
  await expect(output.locator('details')).not.toHaveAttribute('open');
  await expect(output.locator('.python-error-details pre')).not.toBeVisible();
  await output.getByText('展开完整错误堆栈（含运行环境）').click();
  await expect(output.locator('.python-error-details pre')).toContainText('experiment.py');
  await expect(output.locator('.python-error-details pre')).toContainText('Traceback');
  await page.reload();await expect(output.locator('.python-error-summary')).toContainText('第 3 行');
  await expect(output.locator('details')).not.toHaveAttribute('open');
  await output.locator('.python-error-summary').scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/usability-review/python-error.png'});
  await page.getByLabel('Python 代码编辑器').fill('def square(x):\n    return None');
  await page.getByRole('button',{name:/运行并测试/}).click();
  await expect(output.locator('.python-error-summary')).toContainText('AssertionError',{timeout:30000});
  await expect(output.locator('.python-error-summary')).toContainText('不是用户代码');
});

for(const item of [
  {id:'functions',label:'全屏实验',selector:'.math-lab'},
  {id:'algebra',label:'全屏数学实验',selector:'.am-lab'},
  {id:'causal-mask',label:'全屏实验',selector:'.extended-lab'},
  {id:'kv-cache',label:'全屏现代 LLM 实验',selector:'.modern-lab'},
])test(`真实Fullscreen API: ${item.id}进入、明确退出和外部退出同步`,async({page})=>{
  await page.goto(`/#/lesson/${item.id}`);
  const enter=page.getByRole('button',{name:item.label,exact:true});await expect(enter).toBeEnabled();
  await enter.click();
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.className)).toBe(item.selector.slice(1));
  const exit=page.getByRole('button',{name:'退出全屏',exact:true});
  await expect(exit).toHaveAttribute('aria-pressed','true');await expect(exit).toHaveText('退出全屏');
  await exit.click();await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
  await expect(enter).toHaveAttribute('aria-pressed','false');
  await enter.click();await expect(exit).toBeVisible();
  await page.evaluate(()=>document.exitFullscreen());await expect(enter).toHaveAttribute('aria-pressed','false');
});

test('长章节定位避开粘性工具栏，保留深色、草稿、实验和学习断点',async({page})=>{
  await page.goto('/#/lesson/linear');
  await page.getByRole('button',{name:'切换深色外观'}).click();
  await page.getByRole('slider',{name:'斜率 k',exact:true}).fill('2');
  await page.getByLabel('当前章节随手笔记').fill('继续比较截距与斜率。');
  await page.getByRole('button',{name:'跳到 Python 代码'}).click();
  await page.getByLabel('Python 代码编辑器').fill('draft = "保留我的尝试"');
  await page.getByRole('tab',{name:'深入研究',exact:true}).click();
  await page.getByRole('button',{name:'跳到自测练习'}).click();
  await expect(page.locator('#lesson-quiz')).toBeFocused();
  await page.getByRole('button',{name:'跳到交互实验'}).click();
  await expect(page.locator('#lesson-experiment')).toBeFocused();
  await expect.poll(()=>page.locator('#lesson-experiment').evaluate(n=>n.getBoundingClientRect().top)).toBeGreaterThan(110);
  const sizes=await page.locator('.plot-caption,.range-extents').evaluateAll(ns=>ns.map(n=>Number.parseFloat(getComputedStyle(n).fontSize)));
  expect(sizes.every(n=>n>=11)).toBe(true);
  await page.getByLabel('保存学习断点').click();
  await page.getByLabel('现在正在想什么').fill('已能找到实验，继续看平移。');
  await page.getByLabel('下次回来先做哪一步').fill('改变 b，比较结果。');
  await page.getByRole('button',{name:'保存并结束本次学习'}).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.reload();await expect(page.locator('.resume-card')).toContainText('改变 b');
  await page.getByRole('button',{name:'恢复学习'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.getByRole('slider',{name:'斜率 k',exact:true})).toHaveValue('2');
  await page.getByRole('button',{name:'跳到 Python 代码'}).click();
  await expect(page.getByLabel('Python 代码编辑器')).toHaveValue('draft = "保留我的尝试"');
});
