import {readFile} from 'node:fs/promises';
import {test,expect,type Locator,type Page} from '@playwright/test';
import {openNotebook,closeNotebook} from './focus-helpers';

async function download(page:Page,button:Locator){
  const pending=page.waitForEvent('download');
  await button.click();
  const file=await pending;
  return {filename:file.suggestedFilename(),text:await readFile((await file.path())!,'utf8')};
}

test('exports the latest notebook text, then follows the selected lesson',async({page})=>{
  await page.goto('/#/lesson/functions');
  await openNotebook(page);
  const button=page.getByRole('button',{name:'导出笔记 Markdown',exact:true});
  const input=page.getByLabel('当前章节随手笔记');
  await expect(button).toBeDisabled();
  await input.fill(' \n\t');
  await expect(button).toBeDisabled();
  const note='## 我的理解 🧠\n\n$x^2$\n\n```python\nprint(2 ** 2)\n```\n';
  await input.fill(note);
  const file=await download(page,button);
  expect(file.filename).toBe('from-zero-to-gpt-01.01-functions-notes.md');
  expect(file.text).toBe(`# 01.01 函数是什么 · 我的笔记\n\n从零到 GPT · 章节：functions\n\n---\n\n${note}`);
  await expect(input).toHaveValue(note);
  await closeNotebook(page);
  await page.locator('.lesson-nav-link[href="#/lesson/linear"]').click();
  await openNotebook(page);
  await expect(button).toBeDisabled();
  await input.fill('另一个章节的思考');
  const second=await download(page,button);
  expect(second.filename).toContain('-linear-notes.md');
  expect(second.text).toContain('另一个章节的思考');
  expect(second.text).not.toContain(note);
});

test('each notes card exports its own edits even when another chapter is selected',async({page})=>{
  await page.goto('/#/notes');
  const first=page.locator('.note-card').filter({has:page.getByLabel('函数是什么的笔记')});
  await first.getByRole('textbox').fill('函数卡片笔记');
  await page.getByLabel('选择笔记章节',{exact:true}).selectOption('linear');
  const second=page.locator('.note-card').filter({has:page.getByLabel('线性函数与参数的笔记')});
  await expect(second.getByRole('button',{name:'导出笔记 Markdown'})).toBeDisabled();
  await second.getByRole('textbox').fill('线性卡片笔记');
  await first.getByRole('textbox').fill('刚刚修改的函数笔记');
  const file=await download(page,first.getByRole('button',{name:'导出笔记 Markdown'}));
  expect(file.filename).toContain('-functions-notes.md');
  expect(file.text).toContain('刚刚修改的函数笔记');
  expect(file.text).not.toContain('线性卡片笔记');
  await expect(second.getByRole('textbox')).toHaveValue('线性卡片笔记');
});

test('exports in-memory notes when local saving fails',async({page})=>{
  await page.addInitScript(()=>{
    IDBObjectStore.prototype.put=function(){throw new DOMException('Storage full','QuotaExceededError');};
  });
  await page.goto('/#/notes');
  const input=page.getByLabel('函数是什么的笔记');
  await input.fill('存储失败时也能带走的思路');
  await expect(page.getByRole('alert')).toContainText('自动保存失败');
  const file=await download(page,page.getByRole('button',{name:'导出笔记 Markdown',exact:true}));
  expect(file.text).toContain('存储失败时也能带走的思路');
  await expect(input).toHaveValue('存储失败时也能带走的思路');
});

test('reports download failure and keeps notes available for retry',async({page})=>{
  await page.goto('/#/notes');
  const input=page.getByLabel('函数是什么的笔记');
  await input.fill('请保留这段笔记');
  await page.evaluate(()=>{URL.createObjectURL=()=>{throw new Error('unavailable');};});
  await page.getByRole('button',{name:'导出笔记 Markdown',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('笔记导出失败');
  await expect(input).toHaveValue('请保留这段笔记');
});
