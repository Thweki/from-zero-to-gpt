import {test,expect} from '@playwright/test';
import {expectNoPageOverflow} from './layout-helpers';

test('copies the actual mode and a heading that opens in a fresh browser context',async({page,browser})=>{
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.goto('/?draft=private#/lesson/functions');
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();
  await page.getByRole('button',{name:'复制本章链接',exact:true}).click();
  const chapterUrl=await page.evaluate(()=>navigator.clipboard.readText());
  expect(chapterUrl).toBe(new URL('/#/lesson/functions/math',page.url()).href);
  await expect(page.getByRole('status').filter({hasText:'链接已复制'})).toBeVisible();
  const heading=page.locator('.prose-section h2').nth(1);
  const headingId=await heading.getAttribute('id');
  await page.getByRole('button',{name:/复制小节链接：/}).nth(1).click();
  const headingUrl=await page.evaluate(()=>navigator.clipboard.readText());
  expect(headingUrl).not.toBe(chapterUrl);
  const recipient=await browser.newContext();
  try{
    const opened=await recipient.newPage();
    await opened.goto(headingUrl);
    await expect(opened.getByRole('tab',{name:'数学推导',exact:true})).toHaveAttribute('aria-selected','true');
    const target=opened.locator('.prose-section h2').nth(1);
    await expect(target).toHaveAttribute('id',headingId!);
    await expect(target).toBeFocused();
    await expect.poll(()=>target.evaluate(element=>element.getBoundingClientRect().top>=document.querySelector('.lesson-sticky-tools')!.getBoundingClientRect().bottom)).toBe(true);
    await opened.reload();
    await expect(target).toBeFocused();
    // A shared mode is an arrival destination, not a lock on the reader's tabs.
    await opened.getByRole('tab',{name:'深入研究',exact:true}).click();
    await expect(opened.getByRole('tabpanel')).toHaveAttribute('data-mode','deep');
    await opened.goto(chapterUrl);
    await expect(opened.getByRole('tabpanel')).toHaveAttribute('data-mode','math');
    await expect(opened.getByRole('tabpanel')).toBeFocused();
  }finally{await recipient.close();}
});

for(const clipboard of ['missing','denied'] as const)test(`manual copy when clipboard is ${clipboard}, including mobile layout`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(kind=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:kind==='missing'?undefined:{writeText:async()=>{throw new Error('denied');}}});
  },clipboard);
  await page.goto('/#/lesson/linear');
  await page.getByRole('button',{name:'复制本章链接',exact:true}).click();
  const input=page.getByRole('textbox',{name:'手动复制课程链接'});
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(new URL('/#/lesson/linear/intuition',page.url()).href);
  expect(await input.evaluate((element:HTMLInputElement)=>element.selectionEnd!-element.selectionStart!)).toBe((await input.inputValue()).length);
  await expect(page.getByRole('status').filter({hasText:'无法自动复制'})).toBeVisible();
  await expectNoPageOverflow(page);
  await page.getByRole('button',{name:/复制小节链接：/}).first().click();
  await expect(page.getByRole('textbox',{name:'手动复制课程链接'}).last()).toBeFocused();
  await expectNoPageOverflow(page);
});

test('incoming links override a saved mode and tolerate unknown or malformed headings',async({page})=>{
  await page.goto('/#/lesson/functions');
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  for(const heading of ['unknown','%E0%A4%A']){
    await page.goto(`/#/lesson/functions/deep/${heading}`);
    await expect(page.getByRole('tabpanel')).toHaveAttribute('data-mode','deep');
    await expect(page.getByRole('tabpanel')).toBeFocused();
  }
  await page.goto('/#/lesson/functions/code');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('data-mode','code');
  await page.getByRole('tab',{name:'直觉理解',exact:true}).click();
  await expect(page.getByRole('tabpanel')).toHaveAttribute('data-mode','intuition');
  // Legacy lesson URLs retain the saved mode.
  await page.goto('/#/lesson/functions');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('data-mode','intuition');
});
