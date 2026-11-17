import {test,expect,type Page} from '@playwright/test';

async function savedState(page:Page){
  return page.evaluate(async()=>{
    const opening=indexedDB.open('from-zero-to-gpt',1);
    const db=await new Promise<IDBDatabase>(resolve=>{opening.onsuccess=()=>resolve(opening.result);});
    try{
      const request=db.transaction('learning').objectStore('learning').get('state');
      return await new Promise<any>(resolve=>{request.onsuccess=()=>resolve(request.result);});
    }finally{db.close();}
  });
}

test('printing and returning preserve saved work and an unsubmitted quiz choice',async({page})=>{
  await page.goto('/#/lesson/linear');
  await page.getByRole('slider',{name:'斜率 k',exact:true}).fill('2');
  await page.locator('.quiz-options input').nth(1).check();
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  await page.getByLabel('Python 代码编辑器').fill('draft = "KEEP_MY_CODE"');
  await page.getByRole('button',{name:'问导师',exact:true}).click();
  await page.getByRole('button',{name:'思考笔记',exact:true}).click();
  await page.getByLabel('当前章节随手笔记').fill('KEEP_MY_NOTE');
  await page.getByRole('button',{name:'关闭学习助手',exact:true}).click();
  await expect.poll(async()=>(await savedState(page)).progress.linear.note).toBe('KEEP_MY_NOTE');
  const before=await savedState(page);
  await page.evaluate(()=>{window.print=()=>{document.body.dataset.printCalls=String(Number(document.body.dataset.printCalls||0)+1);};});
  const trigger=page.getByRole('button',{name:'打印本章 / 保存 PDF',exact:true});
  await trigger.click();
  const dialog=page.getByRole('dialog',{name:'打印本章',exact:true});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'返回学习',exact:true})).toBeFocused();
  await expect(dialog).not.toContainText('KEEP_MY_CODE');
  await expect(dialog).not.toContainText('KEEP_MY_NOTE');
  await expect(dialog.locator('.handout-answers')).toHaveCount(0);
  await dialog.getByLabel('附上自测答案与解析').check();
  await expect(dialog.locator('.handout-answers')).toBeVisible();
  await dialog.getByRole('button',{name:'打印 / 保存为 PDF',exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-print-calls','1');
  // Canceling the native print dialog leaves the preview usable; Escape returns to the reader.
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await savedState(page)).toEqual(before);
  await expect(page.getByRole('tab',{name:'代码实现',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByLabel('Python 代码编辑器')).toHaveValue('draft = "KEEP_MY_CODE"');
  await page.getByRole('tab',{name:'直觉理解',exact:true}).click();
  await expect(page.getByRole('slider',{name:'斜率 k',exact:true})).toHaveValue('2');
  await expect(page.locator('.quiz-options input').nth(1)).toBeChecked();
  await trigger.click();
  await expect(dialog.getByLabel('附上自测答案与解析')).not.toBeChecked();
  await dialog.getByRole('button',{name:'返回学习',exact:true}).click();
  await expect(page.locator('body')).not.toHaveClass(/lesson-print-open/);
});

test('print media produces a multi-page handout with math and no app chrome in dark mode',async({page})=>{
  await page.goto('/#/lesson/attention');
  await page.getByRole('button',{name:'切换深色外观',exact:true}).click();
  await page.getByRole('button',{name:'打印本章 / 保存 PDF',exact:true}).click();
  await expect(page.getByRole('button',{name:'打印 / 保存为 PDF',exact:true})).toBeEnabled();
  await page.getByLabel('附上自测答案与解析').check();
  await page.emulateMedia({media:'print'});
  await expect(page.locator('#root')).toBeHidden();
  await expect(page.locator('.lesson-print-controls')).toBeHidden();
  await expect(page.locator('.lesson-handout')).toBeVisible();
  await expect(page.locator('.lesson-handout')).toHaveCSS('color','rgb(17, 17, 17)');
  await expect(page.locator('.lesson-handout .formula').first()).toHaveCSS('color','rgb(17, 17, 17)');
  await expect(page.locator('.lesson-print-dialog')).toHaveCSS('overflow','visible');
  await expect(page.locator('.handout-answers')).toHaveCSS('break-before','page');
  const pdf=await page.pdf({format:'A4'});
  expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
  expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1);
  await page.emulateMedia({media:'screen'});
  await page.getByRole('button',{name:'返回学习',exact:true}).click();
  await expect(page.locator('#root')).toBeVisible();
});

test('mobile preview fits and navigation dismisses it without leaking print styles',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/lesson/functions');
  await page.getByRole('button',{name:'打印本章 / 保存 PDF',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.locator('.lesson-print-dialog').evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
  await page.evaluate(()=>{location.hash='/lesson/linear';});
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/lesson-print-open/);
  await page.getByRole('button',{name:'打印本章 / 保存 PDF',exact:true}).click();
  await expect(page.locator('.lesson-handout h1')).toHaveText('线性函数与参数');
});

test('unsupported printing reports an error and keeps the reader available',async({page})=>{
  await page.goto('/#/lesson/functions');
  await page.getByRole('button',{name:'打印本章 / 保存 PDF',exact:true}).click();
  await page.evaluate(()=>{window.print=()=>{throw new Error('Unavailable');};});
  await page.getByRole('button',{name:'打印 / 保存为 PDF',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('请在浏览器中打开本章后重试');
  await page.getByRole('button',{name:'返回学习',exact:true}).click();
  await expect(page.getByRole('tabpanel')).toBeVisible();
});
