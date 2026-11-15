import {expect,test} from '@playwright/test';
import {openNotebook,closeNotebook} from './focus-helpers';

const flagged='/?experimentalFocus=1#/lesson/linear';
const toggleName='专注阅读（实验）';

test('focus is unavailable by default and only the explicit flag exposes an inactive toggle',async({page})=>{
  for(const query of ['', '?experimentalFocus=0', '?experimentalFocus=true']){
    await page.goto(`/${query}#/lesson/linear`);
    await expect(page.getByRole('heading',{name:'线性函数与参数',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:toggleName})).toHaveCount(0);
    await expect(page.locator('.sidebar')).toBeVisible();
  }
  await page.goto(flagged);
  await expect(page.getByRole('button',{name:toggleName})).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.sidebar')).toBeVisible();
});

for(const width of [1440,390,360])test(`focus at ${width}px keeps lesson work, keyboard exits and helper dialogs usable`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.goto(flagged);
  await page.getByRole('slider',{name:'斜率 k',exact:true}).fill('2');
  await openNotebook(page);
  await page.getByLabel('当前章节随手笔记').fill('专注阅读保留我的思路');
  await closeNotebook(page);
  const entry=page.getByRole('button',{name:toggleName});
  await entry.focus();
  await page.keyboard.press('Enter');
  const exit=page.getByRole('button',{name:'退出专注',exact:true});
  await expect(exit).toBeFocused();
  await expect(page.locator('.sidebar')).not.toBeVisible();
  await expect(page.locator('.sidebar')).toHaveAttribute('inert','');
  await expect(page.getByRole('button',{name:'打开导航',exact:true})).not.toBeVisible();
  await expect(page.getByRole('textbox',{name:'搜索知识点',exact:true})).not.toBeVisible();
  await expect(page.getByRole('button',{name:'切换深色外观'})).not.toBeVisible();
  await expect(page.getByRole('tab',{name:'数学推导'})).toBeVisible();
  const article=await page.locator('.lesson-page').boundingBox();
  expect(Math.abs(article!.x+article!.width/2-width/2)).toBeLessThan(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await expect(page.getByRole('slider',{name:'斜率 k',exact:true})).toHaveValue('2');

  // Nested tools consume Escape before the reading mode does.
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog',{name:'搜索知识点结果'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(exit).toBeFocused();
  await openNotebook(page);
  await expect(page.getByLabel('当前章节随手笔记')).toHaveValue('专注阅读保留我的思路');
  await page.keyboard.press('Escape');
  await expect(exit).toBeVisible();
  await expect(page.getByRole('button',{name:'问导师'})).toBeFocused();
  await page.getByRole('button',{name:'保存学习断点'}).click();
  await page.keyboard.press('Escape');
  await expect(exit).toBeVisible();
  await page.getByText('本章定位',{exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(exit).toBeVisible();

  // Editing a code draft must not be interrupted by the global Escape shortcut.
  await page.getByRole('tab',{name:'代码实现'}).click();
  const editor=page.locator('.code-editor');
  await editor.fill('print("focus draft")');
  await editor.press('Escape');
  await expect(exit).toBeVisible();
  await exit.click();
  await expect(entry).toBeFocused();
  await expect(entry).toHaveAttribute('aria-pressed','false');
  await expect(editor).toHaveValue('print("focus draft")');
  await expect(page.getByRole('textbox',{name:'搜索知识点',exact:true})).toBeVisible();
  if(width>900)await expect(page.locator('.sidebar')).toBeVisible();
  else {
    await page.getByRole('button',{name:'打开导航',exact:true}).click();
    await expect(page.locator('.sidebar')).toBeVisible();
    await page.keyboard.press('Escape');
  }
  await entry.click();
  await page.keyboard.press('Escape');
  await expect(entry).toBeFocused();
  await expect(exit).toHaveCount(0);
});

test('focus follows lesson navigation but resets on leaving lessons and reload',async({page})=>{
  await page.goto(flagged);
  await page.getByRole('button',{name:toggleName}).click();
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox',{name:'搜索词',exact:true}).fill('梯度与方向');
  await page.locator('.search-results>button').click();
  await expect(page).toHaveURL(/#\/lesson\/gradients$/);
  await expect(page.getByRole('button',{name:'退出专注',exact:true})).toBeVisible();
  await page.locator('.home-link').click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.getByRole('button',{name:toggleName})).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('button',{name:toggleName})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:toggleName}).click();
  await page.reload();
  await expect(page.getByRole('button',{name:toggleName})).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.sidebar')).toBeVisible();
});
