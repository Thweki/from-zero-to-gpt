import {test, expect, type Page} from '@playwright/test';
import {lessonById} from '../src/data/lessons';
import {bookmarkHref} from '../src/bookmarks';

async function savedProgress(page:Page) {
  return page.evaluate(async () => {
    const opening = indexedDB.open('from-zero-to-gpt', 1);
    const db = await new Promise<IDBDatabase>(resolve => {opening.onsuccess = () => resolve(opening.result);});
    try {
      const request = db.transaction('learning').objectStore('learning').get('state');
      return await new Promise<Record<string, {bookmarks?:unknown[]; mode:string; review:boolean}>>(resolve => {request.onsuccess = () => resolve(request.result.progress);});
    } finally {db.close();}
  });
}

for (const width of [1440, 390]) {
  test(`save, revisit and remove section bookmarks at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height:900});
    await page.emulateMedia({reducedMotion:'reduce'});
    const title = lessonById.functions.math[0].title;
    const otherTitle = lessonById.linear.deep[0].title;
    await page.goto('/#/lesson/functions');
    await page.getByRole('tab', {name:'数学推导', exact:true}).click();
    await page.getByRole('button', {name:`添加小节书签：${title}`, exact:true}).click();
    await expect(page.getByRole('button', {name:`移除小节书签：${title}`, exact:true})).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await savedProgress(page)).functions).toMatchObject({bookmarks:[{mode:'math', title}], review:false});
    await page.getByRole('tab', {name:'直觉理解', exact:true}).click();
    await expect.poll(async () => (await savedProgress(page)).functions.mode).toBe('intuition');

    await page.goto('/#/lesson/linear');
    await page.getByRole('tab', {name:'深入研究', exact:true}).click();
    await page.getByRole('button', {name:`添加小节书签：${otherTitle}`, exact:true}).click();
    await expect.poll(async () => (await savedProgress(page)).linear.bookmarks).toEqual([{mode:'deep', title:otherTitle}]);
    await page.goto('/#/notes');
    const bookmarks = page.getByRole('region', {name:'小节书签'});
    await expect(bookmarks.getByRole('link')).toHaveCount(2);
    await bookmarks.getByRole('link').filter({hasText:title}).click();
    await expect(page.getByRole('tab', {name:'数学推导', exact:true})).toHaveAttribute('aria-selected', 'true');
    const heading = page.locator('#reading-math-0');
    await expect(heading).toBeFocused();
    const top = await heading.evaluate(element => element.getBoundingClientRect().top);
    const toolbarBottom = await page.locator('.lesson-sticky-tools').evaluate(element => element.getBoundingClientRect().bottom);
    expect(top).toBeGreaterThanOrEqual(toolbarBottom);
    expect(top).toBeLessThan(700);
    await page.reload();
    await expect(heading).toBeFocused();
    await expect(page.getByRole('button', {name:`移除小节书签：${title}`, exact:true})).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', {name:`移除小节书签：${title}`, exact:true}).click();
    await expect.poll(async () => (await savedProgress(page)).functions.bookmarks).toEqual([]);
    await page.goto('/#/notes');
    await expect(bookmarks.getByRole('link')).toHaveCount(1);
    await bookmarks.getByRole('button', {name:/移除书签/}).click();
    await expect(bookmarks).toContainText('在正文小节标题旁添加书签');
    await expect.poll(async () => (await savedProgress(page)).linear.bookmarks).toEqual([]);
    await page.reload();
    await expect(bookmarks.getByRole('link')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('invalid or stale bookmark links still open the chapter', async ({page}) => {
  for (const hash of ['#/lesson/functions/math/%broken', bookmarkHref('functions', {mode:'deep', title:'removed section'})]) {
    await page.goto(`/${hash}`);
    await expect(page.getByRole('heading', {name:'函数是什么', exact:true})).toBeVisible();
    await expect(page.getByRole('tab', {name:'直觉理解', exact:true})).toHaveAttribute('aria-selected', 'true');
  }
});
