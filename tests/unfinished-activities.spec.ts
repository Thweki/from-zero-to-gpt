import {expect, test, type Page} from '@playwright/test';
import {initialState, emptyProgress} from '../src/storage';
import {lessonById} from '../src/data/lessons';

async function importFixture(page: Page) {
  const state = initialState();
  state.progress = {
    functions: {...emptyProgress(), status: 'mastered', mode: 'deep', note: '保留我的思考', code: 'my_code = 42', readCompleted: true, experimented: true},
    linear: {...emptyProgress(), status: 'learning', mode: 'code', code: lessonById.linear.starter},
  };
  await page.goto('/#/settings');
  await page.getByLabel('导入学习数据文件').setInputFiles({name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(state))});
  await expect(page.locator('.toast')).toContainText('学习数据已恢复');
  await page.getByRole('navigation', {name: '主导航'}).getByRole('link', {name: '未完事项', exact: true}).click();
}

test('inbox filters across lessons and updates after completing an activity and reloading', async ({page}) => {
  await importFixture(page);
  await expect(page.locator('.unfinished-page [role="status"]')).toHaveText('2 个章节 · 6 项未完事项');
  await page.getByLabel('筛选活动').selectOption('reading');
  await expect(page.locator('.unfinished-card')).toHaveCount(1);
  await expect(page.locator('.unfinished-card h2')).toContainText('线性函数与参数');
  await page.getByRole('link', {name: '阅读未记录', exact: true}).click();
  await expect(page.getByRole('tab', {name: '直觉理解', exact: true})).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#lesson-mode-panel')).toBeFocused();
  await page.getByRole('button', {name: '我已读完，去做实验'}).click();
  await page.getByRole('link', {name: '未完事项', exact: true}).click();
  await expect(page.locator('.unfinished-page [role="status"]')).toHaveText('2 个章节 · 5 项未完事项');
  await page.reload();
  await page.getByLabel('筛选活动').selectOption('reading');
  await expect(page.getByRole('heading', {name: '此类活动暂无未完事项'})).toBeVisible();
  await page.getByLabel('筛选活动').selectOption('all');
  await expect(page.locator('.unfinished-card')).toHaveCount(2);
});

test('activity links focus the right section, preserve learner data and allow normal tabs', async ({page}) => {
  await importFixture(page);
  const card = page.locator('.unfinished-card').filter({hasText: '函数是什么'});
  await card.getByRole('link', {name: '自测待验证'}).click();
  await expect(page.locator('#lesson-quiz')).toBeFocused();
  await page.locator('.quiz-options input').nth(lessonById.functions.quiz.correct).check();
  await page.getByRole('button', {name: '检查我的理解'}).click();
  await page.getByRole('link', {name: '未完事项', exact: true}).click();
  await expect(card.getByRole('link', {name: '自测待验证'})).toHaveCount(0);
  await card.getByRole('link', {name: '代码待验收（可选）', exact: true}).click();
  await expect(page.locator('#lesson-code')).toBeFocused();
  await expect(page.getByLabel('Python 代码编辑器')).toHaveValue('my_code = 42');
  await expect(page.getByRole('button', {name: '取消掌握自评'})).toBeVisible();
  await page.getByRole('tab', {name: '深入研究', exact: true}).click();
  await expect(page.getByRole('tab', {name: '深入研究', exact: true})).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.locator('#lesson-code')).toBeFocused();
  await page.getByRole('link', {name: '我的笔记', exact: true}).click();
  await expect(page.getByLabel('函数是什么的笔记')).toHaveValue('保留我的思考');
  await page.getByRole('link', {name: '未完事项', exact: true}).click();
  await page.locator('.unfinished-card').filter({hasText: '线性函数与参数'}).getByRole('link', {name: '实验未记录'}).click();
  await expect(page.locator('#lesson-experiment')).toBeFocused();
});

test('fresh inbox has an honest empty state and fits a narrow screen in both themes', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/#/unfinished');
  await expect(page.getByRole('heading', {name: '暂无未完事项', exact: true})).toBeVisible();
  await expect(page.locator('.unfinished-card')).toHaveCount(0);
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', {name: '切换深色外观'}).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('link', {name: '回到学习路线'}).click();
  await expect(page).toHaveURL(/#\/map$/);
});
