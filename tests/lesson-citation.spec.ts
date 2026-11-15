import {test,expect} from '@playwright/test';

test('keyboard citation copying works across reading modes and chapters',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as unknown as {copiedCitation:string}).copiedCitation=text;}}});
  });
  await page.goto('/?private=fixture#/lesson/functions');
  for(const mode of ['直觉理解','数学推导','深入研究','代码实现']){
    await page.getByRole('tab',{name:mode,exact:true}).click();
    const button=page.getByRole('button',{name:/^复制引用：/}).first();
    const label=await button.getAttribute('aria-label');
    await button.focus();await page.keyboard.press('Enter');
    await expect(button.locator('..').getByRole('status')).toHaveText('引用已复制');
    const text=await page.evaluate(()=>(window as unknown as {copiedCitation:string}).copiedCitation);
    expect(text).toContain(` — ${mode} / ${label!.replace('复制引用：','')}\n`);
    expect(text).toMatch(/\/#\/lesson\/functions$/);expect(text).not.toContain('private');
  }
  await page.goto('/#/lesson/linear');
  const button=page.getByRole('button',{name:/^复制引用：/}).first();await button.click();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {copiedCitation:string}).copiedCitation)).toMatch(/\/#\/lesson\/linear$/);
});

test('mobile clipboard denial reveals selected citation without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied');}}}));
  await page.goto('/#/lesson/functions');
  const button=page.getByRole('button',{name:/^复制引用：/}).first();await button.click();
  const field=page.getByRole('textbox',{name:/^引用文本：/});
  await expect(field).toBeFocused();
  expect(await field.evaluate((node:HTMLTextAreaElement)=>node.selectionEnd-node.selectionStart)).toBe((await field.inputValue()).length);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
