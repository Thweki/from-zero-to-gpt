import {test,expect,type Page} from '@playwright/test';
import {lessonById} from '../src/data/lessons';
import {closeNotebook} from './focus-helpers';

async function openCode(page:Page,id='functions'){
  await page.goto(`/#/lesson/${id}`);
  await closeNotebook(page);
  await page.getByRole('tab',{name:'代码实现'}).click();
  await page.locator('.custom-tests summary').click();
}
async function progress(page:Page,id='functions'){
  return page.evaluate(async lessonId=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{
      const request=indexedDB.open('from-zero-to-gpt',1);
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    try{
      return await new Promise<Record<string,unknown>>(resolve=>{
        const request=db.transaction('learning').objectStore('learning').get('state');
        request.onsuccess=()=>resolve(request.result?.progress?.[lessonId]);
      });
    }finally{db.close();}
  },id);
}
const personal=(page:Page)=>page.getByLabel('个人 Python 测试',{exact:true});
const run=(page:Page)=>page.getByRole('button',{name:'运行并测试'}).click();

test('personal assertions execute after official tests and report their own failures',async({page})=>{
  await openCode(page);
  await page.getByLabel('Python 代码编辑器').fill(lessonById.functions.reference);
  await personal(page).fill('print("negative input checked")\nassert square(-3) == -9');
  await run(page);
  await expect(page.locator('.python-error-summary')).toContainText('个人测试 custom_tests.py · 第 2 行',{timeout:30000});
  await expect(page.locator('.python-stdout')).toContainText('negative input checked');
  await expect.poll(()=>progress(page)).toMatchObject({codePassed:false});
  await personal(page).fill('assert square(-3) == 9\nassert square(0) == 0');
  await personal(page).press('Control+Enter');
  await expect(page.locator('.code-output')).toContainText('个人测试也已通过',{timeout:30000});
  await expect.poll(()=>progress(page)).toMatchObject({codePassed:true});
  await personal(page).fill('assert square(-4) == 16');
  await expect.poll(()=>progress(page)).toMatchObject({codePassed:false});
  await page.getByLabel('重置代码',{exact:true}).click();
  await expect(personal(page)).toHaveValue('assert square(-4) == 16');
  await run(page);
  await expect(page.locator('.python-error-summary')).toContainText('验收测试',{timeout:30000});
  await expect(page.locator('.code-output')).not.toContainText('个人测试也已通过');
});

test('personal tests persist per chapter, survive reset and round-trip through a backup',async({page})=>{
  await openCode(page);
  const tests='assert square(-3) == 9';
  await personal(page).fill(tests);
  await expect(personal(page)).toHaveAttribute('maxlength','10000');
  await expect.poll(()=>progress(page)).toMatchObject({customTests:tests});
  await page.reload();await page.locator('.custom-tests summary').click();
  await expect(personal(page)).toHaveValue(tests);
  await openCode(page,'linear');await expect(personal(page)).toHaveValue('');
  await personal(page).fill('# linear checks');
  await expect.poll(()=>progress(page,'linear')).toMatchObject({customTests:'# linear checks'});
  await page.goto('/#/settings');
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'导出全部学习数据'}).click();
  const download=await downloading;
  const {readFile}=await import('node:fs/promises');
  const backup=await readFile((await download.path())!);
  expect(JSON.parse(backup.toString()).progress.functions.customTests).toBe(tests);
  await openCode(page);await personal(page).fill('');
  await expect.poll(()=>progress(page)).toMatchObject({customTests:''});
  await page.goto('/#/settings');
  await page.getByLabel('导入学习数据文件').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:backup});
  await expect(page.locator('.toast')).toContainText('学习数据已恢复');
  await openCode(page);await expect(personal(page)).toHaveValue(tests);
  await page.getByLabel('重置代码',{exact:true}).click();
  await expect(personal(page)).toHaveValue(tests);
});

test('editing personal tests during a run cannot certify the edited tests',async({page})=>{
  await openCode(page);
  await page.getByLabel('Python 代码编辑器').fill(lessonById.functions.reference+'\nimport time\ntime.sleep(2)');
  await personal(page).fill('assert square(-3) == 9');
  await run(page);
  await personal(page).fill('assert False, "this new assertion has not run"');
  await expect(page.locator('.code-output')).toContainText('个人测试也已通过',{timeout:30000});
  await expect.poll(()=>progress(page)).toMatchObject({codePassed:false});
  await expect(page.locator('.lesson-page')).toContainText('请重新运行');
});

test('a runaway personal test can be stopped and blank tests can be skipped',async({page})=>{
  await openCode(page);
  await page.getByLabel('Python 代码编辑器').fill(lessonById.functions.reference);
  await personal(page).fill('while True:\n    pass');
  await run(page);
  await expect(page.locator('.code-actions')).toContainText('正在执行你的 Python 代码',{timeout:30000});
  await page.getByRole('button',{name:'停止',exact:true}).click();
  await expect(page.locator('.code-output')).toContainText('已手动停止运行');
  await expect(personal(page)).toHaveValue('while True:\n    pass');
  await personal(page).fill(' \n ');
  await run(page);
  await expect(page.locator('.code-output')).toContainText('本章单元测试通过',{timeout:30000});
  await expect(page.locator('.code-output')).not.toContainText('个人测试也已通过');
  await expect.poll(()=>progress(page)).toMatchObject({codePassed:true});
});
