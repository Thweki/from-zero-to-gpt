import {test,expect} from '@playwright/test';
import {openNotebook,closeNotebook} from './focus-helpers';

// Keep this project small: browser APIs and core interactions, not the visual
// matrix or every chapter. Tutor traffic is local and never uses a provider.
test.beforeEach(async({page})=>{
  await page.route('**/api/tutor/status',route=>route.fulfill({json:{configured:true,provider:'Smoke fixture',model:'fixture',baseURL:'https://mock.invalid/v1',imagesSupported:false}}));
  await page.route('**/api/tutor/chat',route=>route.fulfill({json:{answer:'先看选中部分的含义。'}}));
  await page.goto('/#/lesson/functions');
  await expect(page.getByRole('heading',{name:'函数是什么',exact:true})).toBeVisible();
});

test('local Pyodide WASM executes Python and chapter assertions in a Worker',async({page})=>{
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  await page.getByLabel('Python 代码编辑器').fill('import sys\ndef square(x):\n    return x * x\nprint("smoke-result:", square(7), sys.platform)');
  const workerStarted=page.waitForEvent('worker');
  await page.getByRole('button',{name:'运行并测试'}).click();
  expect(new URL((await workerStarted).url()).pathname).toBe('/python.worker.js');
  const output=page.locator('.code-output');
  await expect(output).toContainText('本章单元测试通过',{timeout:30000});
  await expect(output).toContainText('smoke-result: 49 emscripten');
});

test('IndexedDB restores a note, editor contents and theme after reload',async({page})=>{
  const note='WebKit 保存的学习思路';
  const code='def square(x):\n    return x ** 2';
  await openNotebook(page);
  await page.getByLabel('当前章节随手笔记').fill(note);
  await closeNotebook(page);
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  await page.getByLabel('Python 代码编辑器').fill(code);
  await page.getByRole('button',{name:'切换深色外观',exact:true}).click();
  // Wait for the actual IndexedDB write, rather than racing a reload against it.
  await expect.poll(()=>page.evaluate(async()=>{
    const opening=indexedDB.open('from-zero-to-gpt',1);
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{
      opening.onsuccess=()=>resolve(opening.result);opening.onerror=()=>reject(opening.error);
    });
    try{
      const request=db.transaction('learning').objectStore('learning').get('state');
      return await new Promise((resolve,reject)=>{
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      });
    }finally{db.close();}
  })).toMatchObject({theme:'dark',progress:{functions:{note,code,mode:'code'}}});
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.getByRole('tab',{name:'代码实现',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByLabel('Python 代码编辑器')).toHaveValue(code);
  await openNotebook(page);
  await expect(page.getByLabel('当前章节随手笔记')).toHaveValue(note);
});

test('native mouse selection reaches the tutor composer and focuses its input',async({page})=>{
  const paragraph=page.locator('.prose-section p').first();
  await paragraph.scrollIntoViewIfNeeded();
  const box=(await paragraph.boundingBox())!;
  await page.mouse.move(box.x+2,box.y+10);
  await page.mouse.down();
  await page.mouse.move(box.x+190,box.y+10,{steps:12});
  await page.mouse.up();
  const selected=await page.evaluate(()=>window.getSelection()?.toString().trim());
  expect(selected).toBeTruthy();
  // Native KaTeX selection exposes rendered math; the card preserves $x$ source.
  const sharedText=['给盒子一个数字','，盒子'];
  for(const text of sharedText)expect(selected).toContain(text);
  const ask=page.getByRole('button',{name:'将选中内容带到 AI 导师',exact:true});
  await expect(ask).toBeVisible();
  await ask.click();
  const quote=page.locator('.tutor-composer .tutor-selection-card blockquote');
  for(const text of sharedText)await expect(quote).toContainText(text);
  await expect(page.locator('.context-panel').getByLabel('向 AI 导师提问')).toBeFocused();
});

test('keyboard tabs and checkpoint dialog trap and restore focus',async({page})=>{
  await page.getByRole('tab',{name:'直觉理解',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  const math=page.getByRole('tab',{name:'数学推导',exact:true});
  await expect(math).toBeFocused();
  await expect(math).toHaveAttribute('aria-selected','true');
  const checkpoint=page.getByLabel('保存学习断点');
  await checkpoint.click();
  await expect(page.getByLabel('现在正在想什么')).toBeFocused();
  await page.getByRole('button',{name:'保存并结束本次学习'}).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('关闭保存思路')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button',{name:'保存并结束本次学习'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(checkpoint).toBeFocused();
});
