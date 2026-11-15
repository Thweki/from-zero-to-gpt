import {expect, test} from '@playwright/test';

test('named code versions persist, stay in their lesson, and restore only after confirmation', async ({page}) => {
  await page.goto('/#/lesson/functions');
  await page.getByRole('tab', {name:'代码实现', exact:true}).click();
  const editor = page.getByLabel('Python 代码编辑器');
  await editor.fill('def square(x):\n    return x * x\n');
  await page.getByText('我的代码版本（0/5）', {exact:true}).click();
  await page.getByLabel('版本名称', {exact:true}).fill('平方实现');
  await page.getByRole('button', {name:'保存当前代码为版本', exact:true}).click();
  await expect(page.getByText('我的代码版本（1/5）', {exact:true})).toBeVisible();
  await page.reload();
  await page.getByText('我的代码版本（1/5）', {exact:true}).click();
  await page.locator('.code-versions li summary').click();
  await expect(page.getByLabel('代码版本：平方实现', {exact:true})).toHaveText('def square(x):\n    return x * x');
  await editor.fill('draft = "try another approach"');
  page.once('dialog', dialog=>dialog.dismiss());
  await page.getByRole('button', {name:'恢复到编辑器', exact:true}).click();
  await expect(editor).toHaveValue('draft = "try another approach"');
  page.once('dialog', dialog=>dialog.accept());
  await page.getByRole('button', {name:'恢复到编辑器', exact:true}).click();
  await expect(editor).toHaveValue('def square(x):\n    return x * x\n');
  await expect(page.getByRole('button', {name:'恢复到编辑器', exact:true})).toBeDisabled();
  await expect.poll(()=>page.evaluate(async()=>{
    const opening=indexedDB.open('from-zero-to-gpt',1);
    const db=await new Promise<IDBDatabase>(resolve=>{opening.onsuccess=()=>resolve(opening.result);});
    try {
      const request=db.transaction('learning').objectStore('learning').get('state');
      const state=await new Promise<any>(resolve=>{request.onsuccess=()=>resolve(request.result);});
      return state.progress.functions;
    } finally {db.close();}
  })).toMatchObject({codePassed:false, lastRun:'', codeVersions:[{name:'平方实现'}]});
  await page.evaluate(()=>{location.hash='/lesson/linear';});
  await page.getByRole('tab', {name:'代码实现', exact:true}).click();
  await expect(page.getByText('我的代码版本（0/5）', {exact:true})).toBeVisible();
  await page.evaluate(()=>{location.hash='/lesson/functions';});
  await page.getByText('我的代码版本（1/5）', {exact:true}).click();
  await page.locator('.code-versions li summary').click();
  page.once('dialog', dialog=>dialog.accept());
  await page.getByRole('button', {name:'删除版本', exact:true}).click();
  await expect(page.getByText('我的代码版本（0/5）', {exact:true})).toBeVisible();
  await expect(editor).toHaveValue('def square(x):\n    return x * x\n');
});

test('version controls and long code previews fit a narrow screen', async ({page}) => {
  await page.setViewportSize({width:390, height:844});
  await page.goto('/#/lesson/functions');
  await page.getByRole('tab', {name:'代码实现', exact:true}).click();
  await page.getByLabel('Python 代码编辑器').fill('# '+ 'long line '.repeat(50));
  await page.getByText('我的代码版本（0/5）', {exact:true}).click();
  await page.getByLabel('版本名称', {exact:true}).fill('移动端版本');
  await page.getByRole('button', {name:'保存当前代码为版本', exact:true}).click();
  await page.locator('.code-versions li summary').click();
  await expect(page.getByLabel('代码版本：移动端版本', {exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
