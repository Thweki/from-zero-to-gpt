import {test, expect, type Page} from '@playwright/test';
import {expectNoPageOverflow} from './layout-helpers';

async function storedBookmarks(page:Page, lesson = 'functions') {
  return page.evaluate(async id => {
    const opening = indexedDB.open('from-zero-to-gpt', 1);
    const db = await new Promise<IDBDatabase>(resolve => {opening.onsuccess = () => resolve(opening.result);});
    try {
      const request = db.transaction('learning').objectStore('learning').get('state');
      const state = await new Promise<any>(resolve => {request.onsuccess = () => resolve(request.result);});
      return state?.progress?.[id]?.headingBookmarks ?? [];
    } finally {db.close();}
  }, lesson);
}

async function openBookmarks(page:Page) {
  await page.getByRole('button', {name:/^段落书签（/}).click();
  await expect(page.getByLabel('书签名称', {exact:true})).toBeFocused();
}

for (const width of [1440, 390]) test(`named headings capture, restore, rename and delete at ${width}px`, async ({page}) => {
  await page.setViewportSize({width, height:900});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/#/lesson/functions');
  await expect(page.getByRole('tab', {name:'直觉理解', exact:true})).toHaveAttribute('aria-selected', 'true');
  const heading = page.locator('[data-bookmark-heading]').nth(1);
  await heading.evaluate(async element => {await document.fonts.ready; element.scrollIntoView({block:'start', behavior:'instant'});});
  const id = await heading.getAttribute('id');
  const title = await heading.textContent();
  await openBookmarks(page);
  await expect(page.locator('.heading-bookmark-target')).toContainText(title!.slice(2));
  await page.getByLabel('书签名称', {exact:true}).fill('   ');
  await expect(page.getByRole('button', {name:'保存当前位置', exact:true})).toBeDisabled();
  await page.getByLabel('书签名称', {exact:true}).fill('我的阅读入口');
  await page.getByRole('button', {name:'保存当前位置', exact:true}).click();
  await expect.poll(() => storedBookmarks(page)).toMatchObject([{mode:'intuition', name:'我的阅读入口'}]);
  await expectNoPageOverflow(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', {name:'段落书签（1）', exact:true})).toBeFocused();
  await page.getByRole('tab', {name:'深入研究', exact:true}).click();
  await expect.poll(() => page.getByRole('tabpanel').getAttribute('data-mode')).toBe('deep');
  await page.reload();
  await openBookmarks(page);
  await page.getByRole('button', {name:'跳到书签：我的阅读入口', exact:true}).click();
  await expect(page.getByRole('tab', {name:'直觉理解', exact:true})).toHaveAttribute('aria-selected', 'true');
  await expect(heading).toHaveAttribute('id', id!);
  await expect(heading).toBeFocused();
  await expect.poll(() => heading.evaluate(element => {
    const bottom = document.querySelector('.lesson-sticky-tools')!.getBoundingClientRect().bottom;
    return element.getBoundingClientRect().top >= bottom + 11;
  })).toBe(true);
  await openBookmarks(page);
  await page.getByLabel('书签名称', {exact:true}).fill('改名后的入口');
  await page.getByRole('button', {name:'更新书签名称', exact:true}).click();
  await expect.poll(() => storedBookmarks(page)).toMatchObject([{name:'改名后的入口'}]);
  expect(await storedBookmarks(page)).toHaveLength(1);
  await page.getByRole('button', {name:'关闭书签', exact:true}).click();
  await page.goto('/#/lesson/linear');
  await expect(page.getByRole('button', {name:'段落书签（0）', exact:true})).toBeVisible();
  await page.goto('/#/lesson/functions');
  await openBookmarks(page);
  await page.getByRole('button', {name:'删除书签：改名后的入口', exact:true}).click();
  await expect.poll(() => storedBookmarks(page)).toEqual([]);
  await expect(page.getByLabel('书签名称', {exact:true})).toBeFocused();
  await page.reload();
  await expect(page.getByRole('button', {name:'段落书签（0）', exact:true})).toBeVisible();
});

test('bookmarks export and import with safe unavailable destinations', async ({page}) => {
  await page.goto('/#/lesson/functions');
  await openBookmarks(page);
  await page.getByLabel('书签名称', {exact:true}).fill('我的直觉入口');
  await page.getByRole('button', {name:'保存当前位置', exact:true}).click();
  await expect.poll(() => storedBookmarks(page)).toHaveLength(1);
  await page.goto('/#/settings');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', {name:'导出全部学习数据'}).click();
  const download = await downloading;
  const fs = await import('node:fs/promises');
  const backup = JSON.parse(await fs.readFile((await download.path())!, 'utf8'));
  expect(backup.progress.functions.headingBookmarks).toMatchObject([{name:'我的直觉入口', mode:'intuition'}]);
  backup.progress.functions.headingBookmarks.push({mode:'deep', heading:'已移除的标题', occurrence:0, name:'旧书签'});
  await page.getByLabel('导入学习数据文件').setInputFiles({name:'backup.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(backup))});
  await expect(page.locator('.toast[role="status"]')).toContainText('学习数据已恢复');
  await page.goto('/#/lesson/functions');
  await openBookmarks(page);
  await expect(page.getByRole('button', {name:'跳到书签：我的直觉入口', exact:true})).toBeEnabled();
  await expect(page.getByRole('button', {name:'跳到书签：旧书签', exact:true})).toBeDisabled();
  await expect(page.locator('.heading-bookmark-panel')).toContainText('标题已变更，无法定位');
  await page.getByRole('button', {name:'删除书签：旧书签', exact:true}).click();
  await expect.poll(() => storedBookmarks(page)).toHaveLength(1);
});
