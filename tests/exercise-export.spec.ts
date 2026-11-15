import {readFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
import {lessonById} from '../src/data/lessons';

for(const width of [1440,390])test(`downloads the edited chapter and tests without running or resetting it (${width}px)`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto('/#/lesson/functions');
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'Python 代码编辑器'});
  const attempt='# 继续在本地完成 🌱\ndef square(x):\n    return x + 7\n';
  await editor.fill(attempt);
  const evidence=await page.getByRole('region',{name:'本章学习记录'}).innerText();
  const downloadButton=page.getByRole('button',{name:'下载当前练习（含测试）'});
  await expect(downloadButton).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  let workerStarted=false;
  page.on('worker',()=>{workerStarted=true;});
  const pending=page.waitForEvent('download');
  await downloadButton.focus();
  await page.keyboard.press('Enter');
  const download=await pending;
  expect(download.suggestedFilename()).toBe('functions-exercise.py');
  const source=await readFile((await download.path())!,'utf8');
  expect(source).toContain(attempt);
  expect(source).toContain(lessonById.functions.title);
  expect(source).toContain(lessonById.functions.pythonTests.trim().split('\n').map(line=>`    ${line}`).join('\n'));
  await expect(editor).toHaveValue(attempt);
  await expect(page.getByRole('region',{name:'本章学习记录'})).toHaveText(evidence);
  await expect(page.locator('.code-output')).toHaveCount(0);
  expect(workerStarted).toBe(false);
  await expect(downloadButton).toBeFocused();

  // A subsequent chapter download must use that chapter's editor and checks.
  await page.goto('/#/lesson/linear');
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  const second=page.waitForEvent('download');
  await page.getByRole('button',{name:'下载当前练习（含测试）'}).click();
  const linear=await second;
  expect(linear.suggestedFilename()).toBe('linear-exercise.py');
  const linearSource=await readFile((await linear.path())!,'utf8');
  expect(linearSource).toContain(lessonById.linear.starter);
  expect(linearSource).not.toContain(attempt);
});
