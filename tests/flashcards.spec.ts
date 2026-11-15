import {readFile} from 'node:fs/promises';
import {test, expect} from '@playwright/test';

// Exercise the same flow at a narrow viewport, including the mobile navigation.
for (const width of [1440, 390]) {
  test(`local flashcards survive reload and backup restore at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    await page.goto('/#/lesson/functions');
    await page.getByRole('button', {name: '将本章加入闪卡', exact: true}).click();
    await expect(page.getByRole('button', {name: '本章已加入闪卡', exact: true})).toBeDisabled();
    await page.getByRole('link', {name: '打开我的闪卡'}).click();
    await expect(page.getByRole('heading', {name: '我的闪卡.'})).toBeVisible();
    const answer = page.locator('#flashcard-answer');
    await expect(answer).toBeHidden();
    const reveal = page.getByRole('button', {name: '显示答案'});
    await reveal.focus();
    await page.keyboard.press('Enter');
    await expect(answer).toBeVisible();
    await page.getByRole('button', {name: '下一张', exact: true}).click();
    await expect(answer).toBeHidden();
    await page.reload();
    await expect(page.getByRole('region', {name: '闪卡练习'})).toBeVisible();
    await expect(answer).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.goto('/#/settings');
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', {name: '导出全部学习数据'}).click();
    const download = await downloading;
    const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
    expect(backup.flashcardLessons).toEqual(['functions']);
    expect(backup.progress.functions.status).toBe('learning');
    expect(backup.progress.functions.quizPassed).toBeUndefined();

    await page.goto('/#/flashcards');
    await page.getByText('管理闪卡章节（1）', {exact: true}).click();
    await page.getByRole('button', {name: '移除闪卡章节：函数是什么'}).click();
    await expect(page.getByRole('heading', {name: '还没有闪卡'})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', {name: '还没有闪卡'})).toBeVisible();

    await page.goto('/#/settings');
    await page.getByLabel('导入学习数据文件').setInputFiles({name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))});
    await expect(page.locator('.toast')).toContainText('学习数据已恢复');
    if (width < 900) await page.getByRole('button', {name: '打开导航', exact: true}).click();
    await page.getByRole('link', {name: '我的闪卡', exact: true}).click();
    await expect(page.getByRole('region', {name: '闪卡练习'})).toBeVisible();
    await page.getByRole('link', {name: '回到来源章节'}).click();
    await expect(page.getByRole('heading', {name: '函数是什么', exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: '本章已加入闪卡'})).toBeDisabled();
  });
}
