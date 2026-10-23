import {test,expect} from '@playwright/test';

test('Chinese, Latin and code fonts really load from this site; editor gutter and mathematical type remain correct',async({page})=>{
  const fontURLs:string[]=[];
  page.on('request',request=>{if(/\.(woff2?|ttf)(\?|$)/.test(request.url()))fontURLs.push(request.url());});
  await page.goto('/#/lesson/functions');
  await expect(page.locator('.prose-section p').first()).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  const loaded=await page.evaluate(()=>[...document.fonts].filter(font=>font.status==='loaded').map(font=>font.family.replace(/['"]/g,'')));
  expect(loaded).toEqual(expect.arrayContaining(['Inter Variable','Noto Sans SC Variable','JetBrains Mono Variable']));
  expect(fontURLs.length).toBeGreaterThan(0);
  expect(fontURLs.every(url=>new URL(url).origin===new URL(page.url()).origin)).toBe(true);
  const reading=await page.locator('.prose-section p').first().evaluate(n=>{
    const s=getComputedStyle(n);return {size:parseFloat(s.fontSize),leading:parseFloat(s.lineHeight)/parseFloat(s.fontSize)};
  });
  expect(reading.size).toBeGreaterThanOrEqual(16);
  expect(reading.leading).toBeGreaterThanOrEqual(1.85);
  expect(await page.locator('.nav-link').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBeGreaterThanOrEqual(13);
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  await page.getByLabel('Python 代码编辑器').fill('a = 1\nb = 2\nprint(a + b)\n');
  const metrics=await page.locator('.editor-wrap').evaluate(n=>{
    const editor=getComputedStyle(n.querySelector('.code-editor')!),gutter=getComputedStyle(n.querySelector('.line-numbers')!);
    return {font:editor.fontFamily,gutterFont:gutter.fontFamily,size:editor.fontSize,gutterSize:gutter.fontSize,line:editor.lineHeight,gutterLine:gutter.lineHeight};
  });
  expect(metrics.font).toContain('JetBrains Mono Variable');
  expect(metrics.gutterFont).toBe(metrics.font);
  expect(metrics.gutterSize).toBe(metrics.size);
  expect(metrics.gutterLine).toBe(metrics.line);
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();
  expect(await page.locator('.katex .mathnormal').first().evaluate(n=>getComputedStyle(n).fontFamily)).toContain('KaTeX');
});

for(const theme of ['light','dark'] as const)test(`${theme}: readable type fits narrow screens, and notes/theme survive reload`,async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/#/lesson/functions');
  if(theme==='dark')await page.getByRole('button',{name:'切换深色外观'}).click();
  await page.getByLabel('当前章节随手笔记').fill('字体调整后，继续观察输入与输出。');
  for(const width of [390,360,768]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(()=>document.fonts.ready);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth),`${theme} at ${width}px`).toBeLessThanOrEqual(width+1);
    for(const selector of ['.mode-tabs','.lesson-jump-nav']){
      const bounds=await page.locator(selector).boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width+1);
    }
    expect(await page.locator('.prose-section p').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBeGreaterThanOrEqual(16);
    if(width<760){
      await expect.poll(()=>page.locator('.sidebar').evaluate(n=>n.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
      await page.getByRole('button',{name:'打开导航',exact:true}).click();
      await expect(page.locator('.sidebar')).toHaveClass(/is-open/);
      await page.keyboard.press('Escape');
      await expect(page.locator('.sidebar')).not.toHaveClass(/is-open/);
    }
  }
  await expect(page.locator('.autosave')).toContainText('已本地保存');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  await expect(page.getByLabel('当前章节随手笔记')).toHaveValue('字体调整后，继续观察输入与输出。');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content',theme==='dark'?'#171b23':'#fcfdff');
});

test('a cached dark preference paints a dark canvas before the application JavaScript starts',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('from-zero-to-gpt:theme','dark'));
  await page.route('**/*',route=>route.request().resourceType()==='script'?route.abort():route.continue());
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  expect(await page.locator('html').evaluate(n=>getComputedStyle(n).backgroundColor)).toBe('rgb(17, 19, 24)');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#171b23');
  await expect(page.locator('.app-shell')).toHaveCount(0);
});

test('font delivery failure still leaves the lesson and experiment usable',async({page})=>{
  await page.route(/\.(woff2?|ttf)(\?|$)/,route=>route.abort());
  await page.goto('/#/lesson/functions');
  await expect(page.getByRole('heading',{name:'函数是什么.',exact:true})).toBeVisible();
  await page.getByRole('slider',{name:'输入 x',exact:true}).fill('-3');
  await expect(page.getByTestId('lab-result')).toHaveText('f(-3) = 9');
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  await expect(page.getByLabel('Python 代码编辑器')).toBeEditable();
});
