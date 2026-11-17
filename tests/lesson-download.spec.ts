import {readFile} from 'node:fs/promises';
import {expect,test,type Page} from '@playwright/test';
import {lessonById} from '../src/data/lessons';
import {openNotebook,closeNotebook} from './focus-helpers';

async function downloadLesson(page:Page){
  const downloading=page.waitForEvent('download');
  await page.getByRole('button',{name:'下载 Markdown',exact:true}).click();
  const download=await downloading;
  expect(await download.failure()).toBeNull();
  return {filename:download.suggestedFilename(),content:await readFile((await download.path())!,'utf8')};
}

for(const width of [1440,390])test(`lesson downloads contain every view and only opted-in current notes at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto('/#/lesson/functions');
  await openNotebook(page);
  await page.getByLabel('当前章节随手笔记').fill('我的笔记 🧠\n第一版');
  await closeNotebook(page);
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();
  await page.getByText('下载本章',{exact:true}).click();
  const checkbox=page.getByRole('checkbox',{name:'附上本章笔记'});
  await expect(checkbox).not.toBeChecked();
  const plain=await downloadLesson(page);
  expect(plain.filename).toBe('from-zero-to-gpt-01.01-functions.md');
  for(const heading of ['直觉理解','数学推导','代码实现','深入研究'])expect(plain.content).toContain(`## ${heading}`);
  expect(plain.content).toContain(lessonById.functions.starter);
  expect(plain.content).not.toContain('我的笔记 🧠');
  expect(plain.content).not.toContain('## 我的本章笔记');
  await checkbox.check();
  await openNotebook(page);
  await page.getByLabel('当前章节随手笔记').fill('我的笔记 🧠\n最新内容\n```\n# 原样保留');
  await closeNotebook(page);
  const withNote=await downloadLesson(page);
  expect(withNote.content).toContain('我的笔记 🧠\n最新内容\n```\n# 原样保留');
  expect(withNote.content).not.toContain('第一版');
  await expect(page.getByRole('tab',{name:'数学推导',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('.lesson-download [role=status]')).toContainText('已发起下载');
  const bounds=(await page.locator('.lesson-download').boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);

  await page.getByRole('button',{name:'下一步 · 线性函数与参数',exact:true}).click();
  await page.getByText('下载本章',{exact:true}).click();
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  const next=await downloadLesson(page);
  expect(next.filename).toBe('from-zero-to-gpt-01.02-linear.md');
  expect(next.content).toContain('# 01.02 线性函数与参数');
  expect(next.content).not.toContain('我的笔记 🧠');
  expect(next.content).not.toContain('## 我的本章笔记');
});

test('download errors are announced and the learner can retry',async({page})=>{
  await page.goto('/#/lesson/functions');
  await page.getByText('下载本章',{exact:true}).click();
  await page.evaluate(()=>{
    const create=URL.createObjectURL;
    URL.createObjectURL=()=>{URL.createObjectURL=create;throw new Error('Download unavailable');};
  });
  await page.getByRole('button',{name:'下载 Markdown',exact:true}).click();
  await expect(page.locator('.lesson-download [role=status]')).toContainText('下载未能开始');
  expect((await downloadLesson(page)).filename).toBe('from-zero-to-gpt-01.01-functions.md');
  await expect(page.locator('.lesson-download [role=status]')).toContainText('已发起下载');
});
