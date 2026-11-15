import {test,expect} from '@playwright/test';

for(const width of [1440,390])test(`copy current lesson code with the keyboard at ${width}px`,async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.setViewportSize({width,height:900});
  await page.goto('/#/lesson/functions');
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'Python 代码编辑器'});
  const source='# 我的代码\ndef square(x):\n    return x * x  \n';
  await editor.fill(source);
  const copy=page.getByRole('button',{name:'复制代码',exact:true});
  await expect(copy).toBeVisible();
  await copy.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({hasText:'已复制当前代码'})).toBeVisible();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(source);
  await expect(editor).toHaveValue(source);
  const bounds=(await copy.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
  await page.getByRole('tab',{name:'直觉理解',exact:true}).click();
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  await expect(editor).toHaveValue(source);
  await expect(page.getByText('已复制当前代码',{exact:true})).toHaveCount(0);
});
