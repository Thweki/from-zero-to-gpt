import {test,expect,type Locator,type Page} from '@playwright/test';

const fontSize=(locator:Locator)=>locator.evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
const choice=(page:Page)=>page.getByRole('combobox',{name:'阅读字号'});

test('reader size scales text and math, survives modes, chapters and reload, and resets',async({page})=>{
  await page.goto('/#/lesson/functions');
  await expect(choice(page)).toHaveValue('standard');
  const prose=page.locator('.prose-section p').first();
  const original=await fontSize(prose);
  const navSize=await fontSize(page.locator('.nav-link').first());
  const plotSize=await fontSize(page.locator('.plot-equation'));
  // Exercise the native control with a keyboard, including returning to default.
  await choice(page).focus();await page.keyboard.press('End');await page.keyboard.press('Enter');
  await expect(choice(page)).toHaveValue('largest');
  expect(await fontSize(prose)).toBeCloseTo(original*1.3,1);
  expect(await fontSize(page.locator('.nav-link').first())).toBe(navSize);
  expect(await fontSize(page.locator('.plot-equation'))).toBe(plotSize);
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();
  const formula=page.locator('.formula-card .katex').first();
  const largeMath=await fontSize(formula);
  await choice(page).selectOption('standard');
  expect(largeMath).toBeCloseTo((await fontSize(formula))*1.3,1);
  await choice(page).selectOption('large');
  await page.getByRole('tab',{name:'深入研究',exact:true}).click();
  expect(await fontSize(prose)).toBeCloseTo(original*1.15,1);
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  const editor=page.getByLabel('Python 代码编辑器');
  const editorSize=await fontSize(editor);
  await editor.fill('# reader preference must preserve this draft');
  await choice(page).selectOption('largest');
  expect(await fontSize(editor)).toBe(editorSize);
  await expect(editor).toHaveValue('# reader preference must preserve this draft');
  // Hash navigation exercises App ownership across the keyed LessonReader remount.
  await page.evaluate(()=>{location.hash='/lesson/vectors';});
  await expect(page.locator('.lesson-page h1')).toHaveText('向量的基本概念');
  await expect(choice(page)).toHaveValue('largest');
  await page.reload();await expect(choice(page)).toHaveValue('largest');
  await choice(page).focus();await page.keyboard.press('Home');await page.keyboard.press('Enter');
  await expect(choice(page)).toHaveValue('standard');
  await page.reload();await expect(choice(page)).toHaveValue('standard');
  expect(await fontSize(prose)).toBe(original);
});

for(const theme of ['light','dark'])test(`${theme}: largest reading size fits phones and keeps formulas contained`,async({page})=>{
  await page.goto('/#/lesson/functions');
  if(theme==='dark')await page.getByRole('button',{name:'切换深色外观'}).click();
  await choice(page).selectOption('largest');
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});
    for(const mode of ['直觉理解','数学推导','代码实现','深入研究']){
      await page.getByRole('tab',{name:mode,exact:true}).click();
      await page.evaluate(()=>document.fonts.ready);
      await expect(choice(page)).toBeVisible();
      const bounds=await choice(page).boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth),`${mode} at ${width}px`).toBeLessThanOrEqual(width+1);
      if(mode==='直觉理解')expect(await fontSize(page.locator('.prose-section p').first())).toBeCloseTo((width<=600?16:17)*1.3,1);
      if(mode==='数学推导')await expect(page.locator('.formula.block').first()).toHaveCSS('overflow-x','auto');
    }
  }
});
