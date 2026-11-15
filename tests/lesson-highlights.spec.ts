import {test,expect,type Page} from '@playwright/test';
const save=(page:Page)=>page.getByRole('button',{name:'高亮选中文字',exact:true});
const list=(page:Page)=>page.locator('.lesson-highlights');
async function select(page:Page,partial=false){
  return page.locator('[data-highlight-paragraph]').first().evaluate((p,partial)=>{
    const range=document.createRange();
    if(partial){const text=document.createTreeWalker(p.querySelector('[data-highlight-part]')!,NodeFilter.SHOW_TEXT).nextNode()!;range.setStart(text,0);range.setEnd(text,4);}
    else range.selectNodeContents(p);
    const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);
    p.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:320,clientY:400}));
    return partial?p.dataset.highlightSource!.slice(0,4):p.dataset.highlightSource!;
  },partial);
}
async function stored(page:Page){
  return page.evaluate(async()=>{
    const request=indexedDB.open('from-zero-to-gpt',1);
    const db=await new Promise<IDBDatabase>(resolve=>{request.onsuccess=()=>resolve(request.result);});
    try{const read=db.transaction('learning').objectStore('learning').get('state');return await new Promise<any>(resolve=>{read.onsuccess=()=>resolve(read.result?.progress.functions?.highlights||[]);});}finally{db.close();}
  });
}

test('highlight exact words, merge duplicates, persist, jump across modes, isolate chapters and remove',async({page})=>{
  await page.goto('/#/lesson/functions');
  const quote=await select(page,true);await save(page).click();
  await expect(page.locator('mark.lesson-highlight').first()).toHaveText(quote);
  await list(page).locator('summary').click();await expect(list(page).locator('li')).toHaveCount(1);
  await select(page,true);await save(page).click();await expect(list(page).locator('li')).toHaveCount(1);
  await expect.poll(async()=>(await stored(page)).length).toBe(1);
  await page.reload();await expect(page.locator('mark.lesson-highlight').first()).toHaveText(quote);
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();await expect(page.locator('mark.lesson-highlight')).toHaveCount(0);
  await list(page).locator('summary').click();await list(page).getByRole('button',{name:/跳到原文/}).click();
  await expect(page.getByRole('tab',{name:'直觉理解',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('mark.lesson-highlight').first()).toBeFocused();
  await expect(page.getByRole('toolbar',{name:'选中内容操作'})).toHaveCount(0);
  await page.goto('/#/lesson/linear');await expect(list(page).locator('summary')).toHaveText('本章高亮 · 0');
  await page.goto('/#/lesson/functions');await list(page).locator('summary').click();
  await list(page).getByRole('button',{name:/删除高亮/}).click();
  await expect(page.locator('mark.lesson-highlight')).toHaveCount(0);
  await expect.poll(async()=>(await stored(page)).length).toBe(0);
  await page.reload();await expect(list(page).locator('summary')).toHaveText('本章高亮 · 0');
});

test('keyboard selection, formula preservation, backups, and mobile toolbar fit',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/#/lesson/functions');
  const formulaCount=await page.locator('[data-highlight-paragraph]').first().locator('.katex').count();
  const quote=await select(page);await page.keyboard.press('Alt+Enter');
  await expect(page.getByRole('button',{name:'将选中内容带到 AI 导师'})).toBeFocused();
  await page.keyboard.press('Tab');await expect(save(page)).toBeFocused();
  const rect=(await page.getByRole('toolbar',{name:'选中内容操作'}).boundingBox())!;
  expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-highlight-paragraph]').first().locator('.katex')).toHaveCount(formulaCount);
  await expect(page.locator('mark .katex').first()).toBeVisible();
  await expect.poll(async()=>(await stored(page)).length).toBe(1);
  await page.goto('/#/settings');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出全部学习数据'}).click();
  const backup=await download;const stream=await backup.createReadStream();const chunks=[];for await(const chunk of stream!)chunks.push(chunk);
  const data=JSON.parse(Buffer.concat(chunks).toString());expect(data.progress.functions.highlights[0].source).toBe(quote);
  data.progress.functions.highlights=[];
  await page.locator('input[type=file]').setInputFiles({name:'empty.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await expect.poll(async()=>(await stored(page)).length).toBe(0);
  await page.locator('input[type=file]').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.concat(chunks)});
  await expect.poll(async()=>(await stored(page)).length).toBe(1);
  await page.goto('/#/lesson/functions');await expect(page.locator('mark .katex').first()).toBeVisible();
});
