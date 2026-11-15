import {test,expect,type Page} from '@playwright/test';
import type {LearningState} from '../src/types';

async function saved(page:Page):Promise<LearningState> {
  return page.evaluate(async()=>{const path='/src/storage.ts';return (await import(path)).readState();});
}
async function seed(page:Page,count=0) {
  await page.goto('/#/map');
  await expect(page.locator('.roadmap-page')).toBeVisible();
  await page.evaluate(async count=>{
    const path='/src/storage.ts';const {initialState,emptyProgress,writeState}=await import(path);
    const state=initialState();state.progress.functions={...emptyProgress(),note:'原来的笔记',code:'print(42)',lastRun:'my result',observationDraft:'原来的观察',tutorDraft:'原来的问题',annotations:Array.from({length:count},(_,i)=>({id:`seed-${i}`,mode:'math',quote:'保留的原文',text:'已有批注',createdAt:new Date().toISOString()}))};
    await writeState(state);
  },count);
  await page.goto('/#/lesson/functions');await page.reload();
  await expect(page.locator('.lesson-page h1')).toBeVisible();
}
async function selectPassage(page:Page) {
  const paragraph=page.locator('.prose-section p').first();
  await paragraph.scrollIntoViewIfNeeded();
  await paragraph.evaluate(element=>{
    const range=document.createRange();range.selectNodeContents(element);
    const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);
    const rect=element.getBoundingClientRect();element.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:rect.left+10,clientY:rect.top+10}));
  });
  await expect(page.getByRole('button',{name:'为选中文字记批注'})).toBeVisible();
}
async function annotate(page:Page,text:string) {
  await selectPassage(page);
  await page.getByRole('button',{name:'为选中文字记批注'}).click();
  const editor=page.locator('.context-panel .annotation-card textarea').last();
  await expect(editor).toBeFocused();await editor.fill(text);
  await expect(page.locator('.context-panel .annotation-notes [role=status]')).toHaveText('批注已本地保存');
}

test('annotations persist per chapter, remain editable, and survive actual backup export/import',async({page})=>{
  await seed(page);
  const original=await page.locator('.prose-section p').first().textContent();
  await annotate(page,'我的理解');
  await expect(page.locator('.prose-section p').first()).toHaveText(original!);
  let state=await saved(page);
  expect(state.progress.functions).toMatchObject({note:'原来的笔记',code:'print(42)',lastRun:'my result',observationDraft:'原来的观察',tutorDraft:'原来的问题',annotations:[{text:'我的理解',mode:'intuition'}]});
  expect(state.progress.functions!.annotations![0].quote.length).toBeGreaterThan(0);
  await page.goto('/#/lesson/linear');
  await expect(page.locator('.lesson-page h1')).toHaveText('线性函数与参数');
  await annotate(page,'另一章的批注');
  await page.goto('/#/notes');await page.reload();
  const notes=page.locator('.note-card').filter({has:page.getByRole('button',{name:'函数是什么',exact:true})});
  await expect(notes.getByLabel('批注 1 的想法')).toHaveValue('我的理解');
  await notes.getByLabel('批注 1 的想法').fill('修改后的理解');
  await expect(notes.getByRole('status')).toHaveText('批注已本地保存');
  await page.goto('/#/settings');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出全部学习数据'}).click();
  const stream=await (await download).createReadStream();const chunks=[];for await(const chunk of stream!) chunks.push(chunk);
  const backup=Buffer.concat(chunks);state=JSON.parse(backup.toString());
  expect(state.progress.functions!.annotations![0].text).toBe('修改后的理解');
  await page.goto('/#/notes');await notes.getByRole('button',{name:'删除批注 1'}).click();
  await expect(notes.locator('.annotation-card')).toHaveCount(0);
  await expect.poll(async()=>(await saved(page)).progress.functions?.annotations?.length).toBe(0);
  await page.goto('/#/settings');
  await page.getByLabel('导入学习数据文件').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:backup});
  await expect(page.getByText('学习数据已恢复',{exact:true})).toBeVisible();
  await page.goto('/#/notes');await page.reload();
  await expect(notes.getByLabel('批注 1 的想法')).toHaveValue('修改后的理解');
  expect((await saved(page)).progress.linear!.annotations![0].text).toBe('另一章的批注');
});

test('keyboard annotations work in all reading modes on a narrow dark screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});await seed(page);
  await page.getByRole('button',{name:'切换深色外观'}).click();
  for(const name of ['数学推导','深入研究']) {
    await page.getByRole('tab',{name,exact:true}).click();await selectPassage(page);
    await page.keyboard.press('Alt+Enter');await page.keyboard.press('Tab');
    const action=page.getByRole('button',{name:'为选中文字记批注'});await expect(action).toBeFocused();
    const bounds=(await page.getByRole('toolbar').boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(390);
    await action.press('Enter');const editor=page.locator('.context-panel .annotation-card textarea').last();
    await expect(editor).toBeFocused();await editor.fill(`${name}的理解`);
    await expect(page.locator('.context-panel .annotation-notes [role=status]')).toHaveText('批注已本地保存');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole('button',{name:'关闭学习助手'}).click();
  }
  expect((await saved(page)).progress.functions!.annotations!.map(item=>item.mode)).toEqual(['math','deep']);
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  await expect(page.getByRole('button',{name:'为选中文字记批注'})).toHaveCount(0);
});

test('a full annotation collection cannot exceed backup limits',async({page})=>{
  await seed(page,50);await selectPassage(page);await page.getByRole('button',{name:'为选中文字记批注'}).click();
  await expect(page.getByText('本章最多保存 50 条批注，请先在我的笔记中整理。',{exact:true})).toBeVisible();
  expect((await saved(page)).progress.functions!.annotations).toHaveLength(50);
});

test('storage failures retain annotation drafts and report that they are unsaved',async({page})=>{
  await seed(page);
  await page.evaluate(()=>{IDBObjectStore.prototype.put=function(){throw new DOMException('Full','QuotaExceededError');};});
  await selectPassage(page);await page.getByRole('button',{name:'为选中文字记批注'}).click();
  const editor=page.locator('.context-panel .annotation-card textarea');await editor.fill('尚未保存的理解');
  await expect(page.locator('.context-panel .annotation-notes [role=status]')).toHaveText('批注保存失败，请导出备份');
  await expect(editor).toHaveValue('尚未保存的理解');
  expect((await saved(page)).progress.functions!.annotations).toHaveLength(0);
});
