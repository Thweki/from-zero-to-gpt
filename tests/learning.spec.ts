import {openNotebook,closeNotebook} from './focus-helpers';
import { test, expect } from '@playwright/test';
import { lessons } from '../src/data/lessons';
test('map, real computations, shared context, persistent checkpoint and theme',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.locator('.stage-card')).toHaveCount(6);
  await page.getByRole('button',{name:'开始探索',exact:true}).click();
  await expect(page.getByRole('heading',{name:'函数是什么',exact:true})).toBeVisible();
  await page.getByRole('slider',{name:'输入 x',exact:true}).fill('-2');
  await expect(page.getByTestId('lab-result')).toHaveText('f(-2) = 4');
  await page.getByRole('button',{name:'打开导航',exact:true}).click();await page.locator('.lesson-nav-link[href="#/lesson/linear"]').click();
  await page.getByRole('slider',{name:'斜率 k',exact:true}).fill('2');
  await page.getByRole('slider',{name:'截距 b',exact:true}).fill('1');
  await expect(page.getByTestId('lab-result')).toHaveText('f(2) = 5');
  await openNotebook(page);await page.getByLabel('当前章节随手笔记').fill('斜率描述每单位输入的输出变化。');
  await closeNotebook(page);await page.getByRole('tab',{name:'数学推导'}).click();
  await expect(page.locator('.katex')).not.toHaveCount(0);
  await page.getByRole('button',{name:'标记为已掌握',exact:true}).click();
  await page.reload();
  await expect(page.getByRole('tab',{name:'数学推导'})).toHaveAttribute('aria-selected','true');
  await expect(page.getByTestId('lab-result')).toHaveText('f(2) = 5');
  await openNotebook(page);await expect(page.getByLabel('当前章节随手笔记')).toHaveValue('斜率描述每单位输入的输出变化。');
  await expect(page.getByRole('button',{name:'改为学习中'})).toBeVisible();
  await page.getByRole('button',{name:'保存思路，今天到这里'}).click();
  await page.getByLabel('现在正在想什么').fill('为什么平移直线不会改变斜率？');
  await page.getByLabel('下次回来先做哪一步').fill('保持 k=2，改变 b，用两个点验证。');
  await page.getByRole('button',{name:'保存并结束本次学习'}).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.reload();await expect(page.locator('.resume-card')).toContainText('为什么平移直线不会改变斜率？');
  await page.getByRole('button',{name:'恢复学习'}).click();
  await expect(page.getByTestId('lab-result')).toHaveText('f(2) = 5');
  await page.getByRole('button',{name:'切换深色外观'}).click();await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  expect(errors).toEqual([]);
});
test('all curriculum nodes discoverable; prerequisites are inspectable without fake lesson pages',async({page})=>{
  await page.goto('/');await page.getByLabel('搜索知识点',{exact:true}).fill('KV');
  await page.locator('.search-results>button').filter({hasText:'KV Cache'}).click();
  await expect(page.getByRole('heading',{level:1})).toContainText('KV Cache');
  await page.goto('/#/map');
  await page.getByLabel('知识依赖视图').click();
  await expect(page.locator('.dependency-flow button')).toHaveCount(5);
  await expect(page.locator('.chapter-list .chapter-row')).toHaveCount(23);
});
test('self check gives a hint for mistakes, records success, and review flag persists',async({page})=>{
  const lesson=lessons[0];await page.goto('/#/lesson/functions');
  await page.locator('.quiz-options input').nth((lesson.quiz.correct+1)%4).check();
  await page.getByRole('button',{name:'检查我的理解'}).click();
  await expect(page.locator('.quiz-feedback')).toContainText(lesson.quiz.hint);
  await page.locator('.quiz-options input').nth(lesson.quiz.correct).check();
  await page.getByRole('button',{name:'检查我的理解'}).click();
  await expect(page.locator('.quiz-feedback')).toContainText(lesson.quiz.explanation);
  await page.getByLabel('稍后复习本章').click();await page.reload();
  await expect(page.locator('.quiz-card .badge')).toContainText('已验证');
  await expect(page.getByLabel('稍后复习本章')).toHaveClass(/bookmarked/);
});
test('JSON export and import restore actual data; invalid input leaves data intact',async({page})=>{
  await page.goto('/#/lesson/functions');await openNotebook(page);await page.getByLabel('当前章节随手笔记').fill('用于验证数据往返的笔记');
  await page.goto('/#/settings');
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'导出全部学习数据'}).click();
  const file=await downloading,fs=await import('node:fs/promises');const backup=JSON.parse(await fs.readFile((await file.path())!,'utf8'));
  expect(backup.progress.functions.note).toBe('用于验证数据往返的笔记');
  await page.getByLabel('导入学习数据文件').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});
  await expect(page.getByRole('status')).toContainText('不支持的学习数据格式');
  backup.progress.functions.note='从文件恢复的思路';
  await page.getByLabel('导入学习数据文件').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await expect(page.getByRole('status')).toContainText('学习数据已恢复');
  await page.goto('/#/lesson/functions');await openNotebook(page);await expect(page.getByLabel('当前章节随手笔记')).toHaveValue('从文件恢复的思路');
  await page.reload();await openNotebook(page);await expect(page.getByLabel('当前章节随手笔记')).toHaveValue('从文件恢复的思路');
});
test('vector and dot-product sliders use real arithmetic',async({page})=>{
  await page.goto('/#/lesson/vectors');
  await page.getByRole('slider',{name:'a 的 x 分量',exact:true}).fill('3');
  await page.getByRole('slider',{name:'a 的 y 分量',exact:true}).fill('4');
  await expect(page.locator('.live-result')).toContainText('‖a‖ = 5');
  await page.goto('/#/lesson/dot-product');
  for(const [name,value] of [['a 的 x 分量','2'],['a 的 y 分量','0'],['b 的 x 分量','0'],['b 的 y 分量','2']])await page.getByRole('slider',{name,exact:true}).fill(value);
  await expect(page.getByTestId('lab-result')).toHaveText('0');
  await page.getByRole('slider',{name:'b 的 x 分量',exact:true}).fill('-2');
  await expect(page.getByTestId('lab-result')).toHaveText('-4');
});
// Each chapter gets its own page/Worker, timeout and trace. A growing curriculum
// must not share one aggregate wall-clock limit across all Python executions.
test.describe('Python reference implementations in actual browser Workers',()=>{
  for(const lesson of lessons)test(`${lesson.id}: ${lesson.title}`,async({page})=>{
    await page.goto(`/#/lesson/${lesson.id}`);await closeNotebook(page);await page.getByRole('tab',{name:'代码实现'}).click();
    await page.getByLabel('Python 代码编辑器').fill(lesson.reference);
    await page.getByRole('button',{name:'运行并测试'}).click();
    await expect(page.locator('.code-output')).toContainText('本章单元测试通过',{timeout:30000});
  });
});
test('Python failure is real; runaway code can be stopped without locking UI; editor persists',async({page})=>{
  await page.goto('/#/lesson/functions');await closeNotebook(page);await page.getByRole('tab',{name:'代码实现'}).click();
  await page.getByRole('button',{name:'运行并测试'}).click();
  await expect(page.locator('.code-output')).toContainText('AssertionError',{timeout:30000});
  await page.getByLabel('Python 代码编辑器').fill('while True:\n    pass');
  await page.getByRole('button',{name:'运行并测试'}).click();
  await expect(page.locator('.code-actions')).toContainText('正在执行你的 Python 代码',{timeout:30000});
  await page.getByRole('button',{name:'停止',exact:true}).click();
  await expect(page.locator('.code-output')).toContainText('已手动停止运行');
  await page.reload();await expect(page.getByLabel('Python 代码编辑器')).toHaveValue('while True:\n    pass');
  await page.getByLabel('Python 代码编辑器').fill('');await expect(page.getByLabel('Python 代码编辑器')).toHaveValue('');
});
test('keyboard navigation reaches reading modes and checkpoint dialog keeps focus',async({page})=>{
  await page.goto('/#/lesson/functions');await expect(page.locator('.lesson-page')).toBeVisible();
  await page.keyboard.press('Tab');await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.locator('main')).toBeFocused();
  await expect(page).toHaveURL(/#\/lesson\/functions$/);
  await closeNotebook(page);await page.getByRole('tab',{name:'直觉理解'}).focus();await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'数学推导'})).toBeFocused();
  await expect(page.getByRole('tab',{name:'数学推导'})).toHaveAttribute('aria-selected','true');
  await page.getByLabel('保存学习断点').click();await expect(page.getByLabel('现在正在想什么')).toBeFocused();
  await page.getByRole('button',{name:'保存并结束本次学习'}).focus();await page.keyboard.press('Tab');
  await expect(page.getByLabel('关闭保存思路')).toBeFocused();await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByLabel('保存学习断点')).toBeFocused();
  await closeNotebook(page);await page.getByRole('tab',{name:'代码实现'}).click();
  await page.getByLabel('Python 代码编辑器').fill('');await page.keyboard.press('Control+]');
  await expect(page.getByLabel('Python 代码编辑器')).toHaveValue('    ');
  await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'运行并测试'})).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(page.getByLabel('Python 代码编辑器')).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(page.getByLabel('重置代码')).toBeFocused();
});

test('browser Python watchdog stops a genuinely executing infinite loop and keeps UI responsive',async({page})=>{
  await page.goto('/#/lesson/functions');await closeNotebook(page);await page.getByRole('tab',{name:'代码实现'}).click();
  await page.getByLabel('Python 代码编辑器').fill('while True:\n    pass');
  await page.getByRole('button',{name:'运行并测试'}).click();
  await expect(page.locator('.code-actions')).toContainText('正在执行你的 Python 代码',{timeout:30000});
  await openNotebook(page);await page.getByLabel('当前章节随手笔记').fill('Python 循环正在独立 Worker 中执行，主界面仍可编辑。');
  await expect(page.locator('.code-output')).toContainText('超过 30 秒限制',{timeout:35000});
  await openNotebook(page);await expect(page.getByLabel('当前章节随手笔记')).toHaveValue('Python 循环正在独立 Worker 中执行，主界面仍可编辑。');
  await expect(page.getByRole('button',{name:'运行并测试'})).toBeEnabled();
});
