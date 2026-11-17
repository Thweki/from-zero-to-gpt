import { expect, test, type Page } from '@playwright/test';
import { emptyProgress, initialState } from '../src/storage';
import { lessonById } from '../src/data/lessons';

async function seedNotes(page: Page) {
  await page.goto('/#/notes');
  await expect(page.getByLabel('搜索我的笔记', { exact: true })).toBeVisible();
  await expect(page.locator('.autosave')).toHaveText('已本地保存');
  const state = initialState();
  state.progress.functions = { ...emptyProgress(), note: '自己的 Attention 想法', code: 'keep this code', review: true };
  state.progress.vectors = { ...emptyProgress(), note: '前文。'.repeat(100) + 'İ🧠 ATTENTION <img src=x onerror=alert(1)> 我的向量理解' };
  await page.evaluate(async state => {
    const opening = indexedDB.open('from-zero-to-gpt', 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    });
    try {
      const tx = db.transaction('learning', 'readwrite');
      tx.objectStore('learning').put(state, 'state');
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    } finally { db.close(); }
  }, state);
  await page.reload();
  return state;
}

for (const width of [1440, 390]) {
  test(`find and edit a saved note across lessons at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const original = await seedNotes(page);
    const search = page.getByRole('search', { name: '个人笔记搜索' });
    const input = search.getByLabel('搜索我的笔记', { exact: true });
    await input.fill(' attention ');
    await expect(search.getByRole('status')).toHaveText('找到 2 篇笔记');
    await expect(search.locator('mark')).toHaveText(['Attention', 'ATTENTION']);
    await expect(search.locator('img')).toHaveCount(0);
    await expect(search).toContainText('<img src=x onerror=alert(1)>');
    await search.getByRole('button', { name: `编辑匹配笔记：${lessonById.vectors.title}` }).click();
    const editor = page.locator('[data-note-id="vectors"] textarea');
    await expect(editor).toBeFocused();
    await expect(page.getByLabel('选择笔记章节', { exact: true })).toHaveValue('vectors');
    expect(await editor.evaluate((node: HTMLTextAreaElement) => node.value.slice(node.selectionStart, node.selectionEnd))).toBe('ATTENTION');
    await expect(editor).toHaveValue(original.progress.vectors!.note);
    await editor.fill('更新后的向量理解');
    await expect(search.getByRole('status')).toHaveText('找到 1 篇笔记');
    await input.fill('更新后的');
    await expect(search.locator('mark')).toHaveText('更新后的');
    await input.press('Escape');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
    await expect(search.locator('li')).toHaveCount(0);
    await expect(page.locator('.autosave')).toHaveText('已本地保存');
    await page.reload();
    await expect(editor).toHaveValue('更新后的向量理解');
    await input.fill('更新后的');
    await expect(search.getByRole('status')).toHaveText('找到 1 篇笔记');
    await editor.fill('');
    await expect(search.getByRole('status')).toContainText('没有找到匹配的笔记');
    await search.getByRole('button', { name: '清除笔记搜索' }).click();
    await expect(input).toBeFocused();
    await expect(page.locator('[data-note-id="functions"] textarea')).toHaveValue(original.progress.functions!.note);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('empty notes and unmatched queries stay usable without searching course content', async ({ page }) => {
  await page.goto('/#/notes');
  const search = page.getByRole('search', { name: '个人笔记搜索' });
  const input = search.getByLabel('搜索我的笔记', { exact: true });
  await expect(search.getByRole('status')).toContainText('搜索仅在本地进行');
  await input.fill(lessonById.functions.title);
  await expect(search.getByRole('status')).toContainText('没有找到匹配的笔记');
  await expect(page.getByLabel(`${lessonById.functions.title}的笔记`, { exact: true })).toBeVisible();
  await input.fill('   ');
  await expect(search.locator('li')).toHaveCount(0);
  await expect(search.getByRole('status')).toContainText('搜索仅在本地进行');
});
