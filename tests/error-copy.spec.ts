import {test,expect,type Page} from '@playwright/test';
import {lessons} from '../src/data/lessons';
import {closeNotebook} from './focus-helpers';

async function openLab(page:Page){
  await page.goto('/#/lesson/functions');
  await closeNotebook(page);
  await page.getByRole('tab',{name:'代码实现'}).click();
}
async function failRun(page:Page){
  await page.getByLabel('Python 代码编辑器').fill('print("output omitted")\nmissing_name');
  await page.getByRole('button',{name:'运行并测试'}).click();
  await expect(page.locator('.python-error-summary')).toContainText('NameError',{timeout:30000});
}
const expectedReport='章节：函数是什么 (functions)\n位置：experiment.py:2（用户代码）\n错误：NameError: name \'missing_name\' is not defined\n源码：missing_name';

test('copies a real saved run, independent of later edits, with keyboard feedback',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{
      (window as unknown as {copiedError:string}).copiedError=text;
    }}});
  });
  await openLab(page);
  const copy=page.getByRole('button',{name:'复制错误信息',exact:true});
  await expect(copy).toHaveCount(0);
  await failRun(page);
  await expect(page.locator('.autosave')).toHaveText('已本地保存');
  await page.reload();
  await expect(copy).toBeVisible();
  await page.getByLabel('Python 代码编辑器').fill('print("edited since run")');
  await copy.focus();await page.keyboard.press('Enter');
  await expect(page.locator('.python-error-copy [role="status"]')).toHaveText('错误信息已复制');
  expect(await page.evaluate(()=>(window as unknown as {copiedError:string}).copiedError)).toBe(expectedReport);
  await page.getByLabel('重置代码',{exact:true}).click();
  await expect(copy).toHaveCount(0);
  await page.getByRole('button',{name:'运行并测试'}).click();
  await expect(page.locator('.python-error-summary')).toContainText('AssertionError',{timeout:30000});
  await expect(page.locator('.python-error-copy [role="status"]')).toBeEmpty();
  await copy.click();
  expect(await page.evaluate(()=>(window as unknown as {copiedError:string}).copiedError)).toContain('acceptance_tests.py:');
  await page.getByLabel('Python 代码编辑器').fill(lessons.find(lesson=>lesson.id==='functions')!.reference);
  await page.getByRole('button',{name:'运行并测试'}).click();
  await expect(copy).toHaveCount(0);
  await expect(page.locator('.code-output')).toContainText('本章单元测试通过',{timeout:30000});
  await expect(copy).toHaveCount(0);
});

for(const mode of ['unavailable','denied'] as const){
  test(`clipboard ${mode} offers selectable report and supports retry`,async({page})=>{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(mode=>{
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:mode==='unavailable'?undefined:{writeText:async()=>{throw new Error('Permission denied');}}});
    },mode);
    await openLab(page);await failRun(page);
    const copy=page.getByRole('button',{name:'复制错误信息',exact:true});
    await copy.click();
    await expect(page.locator('.python-error-copy [role="status"]')).toContainText('请选择下方文本手动复制');
    const manual=page.getByLabel('可手动复制的错误信息');
    await expect(manual).toHaveValue(expectedReport);
    await manual.focus();
    expect(await manual.evaluate((element:HTMLTextAreaElement)=>element.value.slice(element.selectionStart,element.selectionEnd))).toBe(expectedReport);
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}}));
    await copy.click();
    await expect(page.locator('.python-error-copy [role="status"]')).toHaveText('错误信息已复制');
    await expect(manual).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('a pending copy cannot mark a later run as copied',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>new Promise<void>(resolve=>{
      (window as unknown as {finishCopy:()=>void}).finishCopy=resolve;
    })}});
  });
  await openLab(page);await failRun(page);
  const copy=page.getByRole('button',{name:'复制错误信息',exact:true});
  await copy.click();await expect(copy).toBeDisabled();
  await page.getByLabel('Python 代码编辑器').fill('raise ValueError("new failure")');
  await page.getByRole('button',{name:'运行并测试'}).click();
  await expect(page.locator('.python-error-summary')).toContainText('ValueError',{timeout:30000});
  await page.evaluate(()=>(window as unknown as {finishCopy:()=>void}).finishCopy());
  await expect(copy).toBeEnabled();
  await expect(page.locator('.python-error-copy [role="status"]')).toBeEmpty();
});
