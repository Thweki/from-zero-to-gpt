import {test,expect,type Locator,type Page} from '@playwright/test';

// Measure rendered foreground/background, including inherited and alpha colors.
// This catches the original bug: dark tokens existed but root text/canvas stayed light.
async function colors(locator:Locator,property:'color'|'stroke'='color'){
  return locator.evaluate((element,property)=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
    const ctx=canvas.getContext('2d')!;
    const rgba=(value:string)=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
    const blend=(front:number[],back:number[])=>front.slice(0,3).map((v,i)=>v*front[3]/255+back[i]*(1-front[3]/255));
    const chain:Element[]=[];for(let node:Element|null=element;node;node=node.parentElement)chain.unshift(node);
    let background=[255,255,255];for(const node of chain)background=blend(rgba(getComputedStyle(node).backgroundColor),background);
    const foreground=blend(rgba(getComputedStyle(element)[property]),background);
    const luminance=(rgb:number[])=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const fg=luminance(foreground),bg=luminance(background);
    return {contrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05),backgroundLuminance:bg,foreground,background};
  },property);
}
async function readable(page:Page,selectors:string[]){
  for(const selector of selectors){
    const element=page.locator(selector).first();await expect(element).toBeVisible();
    expect((await colors(element)).contrast,selector+' rendered text contrast').toBeGreaterThanOrEqual(4.5);
  }
}
async function dark(page:Page){
  await page.goto('/');await page.getByRole('button',{name:'切换深色外观'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
}

test('dark reading canvas, inherited titles and route cards are readable; theme survives reload',async({page})=>{
  await dark(page);
  await readable(page,['.page-heading h1','.page-description','.continue-content h2','.chapter-title','.stage-heading-text strong','.context-section h3','.sidebar .lesson-nav-link','.save-thought p','.autosave','.thinking-card>span:last-child']);
  expect((await colors(page.locator('html'))).backgroundLuminance).toBeLessThan(.05);
  const palette=await page.locator('.stage-icon').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));
  expect(new Set(palette).size).toBe(6);
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.screenshot({path:'artifacts/dark-appearance/map.png',fullPage:true});
  await page.getByRole('button',{name:'切换浅色外观'}).click();
  expect((await colors(page.locator('html'))).backgroundLuminance).toBeGreaterThan(.8);
  await readable(page,['.page-heading h1','.continue-content h2','.chapter-title','.save-thought p','.autosave','.thinking-card>span:last-child']);
  await page.goto('/#/lesson/functions');
  await readable(page,['.plot-caption','.range-extents','.select-label','.live-result small']);
  for(const selector of ['.save-thought p','.autosave','.plot-caption','.select-label','.live-result small']){
    expect(await page.locator(selector).first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize)),selector+' font size').toBeGreaterThanOrEqual(11);
  }
});

test('GPT output, loss panel and probability table keep dark surfaces and readable action text',async({page})=>{
  await dark(page);await page.goto('/#/lesson/autoregressive');
  await page.locator('.gpt-lab').waitFor();
  await readable(page,['.gpt-output>div','.gpt-output-label','.gpt-loss','.gpt-lab th','.gpt-primary','.gpt-prompt input']);
  for(const selector of ['.gpt-output','.gpt-loss','.gpt-disclosure','.gpt-lab thead']){
    expect((await colors(page.locator(selector))).backgroundLuminance,selector+' has no light-theme fallback').toBeLessThan(.15);
  }
  await page.locator('.gpt-primary').click();await expect(page.locator('.gpt-output-label')).toContainText('1/40');
  await page.locator('.gpt-lab').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/dark-appearance/gpt.png'});
});

test('dark editor, genuine Python error and success outputs use readable distinct states',async({page})=>{
  await dark(page);await page.goto('/#/lesson/functions');
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  await readable(page,['.code-editor','.line-numbers','.code-toolbar>span']);
  await page.getByLabel('Python 代码编辑器').fill('raise ValueError("appearance validation")');
  await page.getByRole('button',{name:/运行并测试/}).click();
  await expect(page.locator('.code-output')).toContainText('ValueError',{timeout:30000});
  await readable(page,['.python-error-summary']);
  const errorColor=await page.locator('.code-output').evaluate(n=>getComputedStyle(n).backgroundColor);
  await page.getByLabel('Python 代码编辑器').fill('def square(x):\n    return x * x\n');
  await page.getByRole('button',{name:/运行并测试/}).click();
  await expect(page.locator('.code-output.success')).toContainText('单元测试通过',{timeout:30000});
  await readable(page,['.code-output.success pre']);
  expect(await page.locator('.code-output').evaluate(n=>getComputedStyle(n).backgroundColor)).not.toBe(errorColor);
});

test('dark tutor messages, code, focused composer and pause dialog remain readable',async({page})=>{
  await page.route('**/api/tutor/status',r=>r.fulfill({json:{configured:true,provider:'Appearance fixture',model:'local-fixture'}}));
  await page.route('**/api/tutor/chat',r=>r.fulfill({json:{answer:'先观察函数的输入。\n\n```python\nx = 2\n```\n\n试着改变一个值。'}}));
  await dark(page);await page.goto('/#/tutor');
  const tutor=page.locator('.tutor-page .tutor-panel');
  await tutor.getByLabel('向 AI 导师提问').fill('用一个提示解释函数。');
  await tutor.getByRole('button',{name:'发送',exact:true}).click();
  await expect(tutor.locator('.tutor-message.assistant')).toBeVisible();
  await readable(page,['.tutor-message.user','.tutor-message.assistant','.tutor-markdown pre','.tutor-scope p']);
  await tutor.getByLabel('向 AI 导师提问').focus();
  expect(await tutor.getByLabel('向 AI 导师提问').evaluate(n=>getComputedStyle(n).outlineStyle)).not.toBe('none');
  await page.screenshot({path:'artifacts/dark-appearance/tutor.png',fullPage:true});
  await page.getByRole('button',{name:'保存学习断点'}).click();
  await readable(page,['.checkpoint-modal h2','.checkpoint-modal>p','.checkpoint-modal label','.checkpoint-modal .button.primary']);
  await page.getByLabel('现在正在想什么').fill('下次从函数输入继续。');
  await page.screenshot({path:'artifacts/dark-appearance/pause.png'});
});

test('dark search, toast, phone navigation and experiment stay usable',async({page})=>{
  await dark(page);
  await page.getByLabel('搜索知识点',{exact:true}).fill('向量');
  await expect(page.locator('.search-results')).toBeVisible();
  await readable(page,['.search-results>button','.search-results .section-title']);
  await page.keyboard.press('Escape');
  await page.goto('/#/settings');
  await page.getByRole('button',{name:'导出全部学习数据'}).click();
  await expect(page.locator('.toast')).toBeVisible();await readable(page,['.toast']);
  await page.setViewportSize({width:390,height:844});await page.goto('/#/lesson/dot-product');
  await page.getByRole('button',{name:'打开导航',exact:true}).click();
  await expect(page.locator('.sidebar')).toHaveClass(/is-open/);
  await readable(page,['.sidebar .lesson-nav-link']);
  await page.keyboard.press('Escape');
  await expect(page.locator('.sidebar')).not.toHaveClass(/is-open/);
  await page.getByRole('slider',{name:'a 的 x 分量'}).fill('4');
  await expect(page.getByTestId('lab-result')).toHaveText('10');
  await readable(page,['.lesson-title-row h1','.plot-equation']);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:'artifacts/dark-appearance/mobile.png',fullPage:true});
});

test('dark matrix vectors and attention heatmaps use visible colors and preserve causal masking',async({page})=>{
  await dark(page);await page.goto('/#/lesson/matrix-multiplication');
  const gold=page.locator('.am-lab svg [stroke="var(--plot-secondary)"]').first();
  await expect(gold).toBeVisible();expect((await colors(gold,'stroke')).contrast).toBeGreaterThanOrEqual(3);
  await readable(page,['.am-stat strong','.am-caption']);
  await page.goto('/#/lesson/causal-mask');await page.locator('.tf-lab').waitFor();
  await readable(page,['.tf-heat','.tf-matrix-heading strong','.tf-notice']);
  await expect(page.locator('.tf-masked').first()).toContainText('屏蔽');
  await page.getByLabel('Transformer 信息流',{exact:true}).selectOption('0');
  await page.getByLabel('因果掩码（未来严格为零）',{exact:true}).uncheck();
  await expect(page.locator('.tf-masked')).toHaveCount(0);
  await readable(page,['.tf-heat']);
  await page.locator('.tf-lab').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/dark-appearance/attention.png'});
});
