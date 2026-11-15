import {test, expect, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const appearance = (page: Page) => page.getByRole('group', {name: '外观偏好'});
async function expectTheme(page: Page, theme: 'light' | 'dark') {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', theme === 'dark' ? '#191b1d' : '#f7f7f2');
}
async function savedState(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('from-zero-to-gpt', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<{theme: string}>((resolve, reject) => {
        const request = db.transaction('learning').objectStore('learning').get('state');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  });
}

test('new profiles follow OS live; manual choices lock, reload, and return to system', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'});
  await page.goto('/#/settings');
  const system = appearance(page).getByRole('button', {name: '跟随系统', exact: true});
  await expect(system).toHaveAttribute('aria-pressed', 'true');
  await expectTheme(page, 'dark');
  await expect.poll(async () => (await savedState(page)).theme).toBe('system');
  const before = await savedState(page);
  await page.emulateMedia({colorScheme: 'light'});
  await expectTheme(page, 'light');
  expect(await savedState(page)).toEqual(before);

  for (const theme of ['dark', 'light'] as const) {
    await appearance(page).getByRole('button', {name: theme === 'dark' ? '深色 · 夜间实验室' : '浅色 · 纸与墨'}).click();
    await expect.poll(async () => (await savedState(page)).theme).toBe(theme);
    await page.emulateMedia({colorScheme: 'dark'});
    await expectTheme(page, theme);
    await page.emulateMedia({colorScheme: 'light'});
    await expectTheme(page, theme);
    await page.reload();
    await expect(appearance(page)).toBeVisible();
    await expectTheme(page, theme);
  }
  await page.emulateMedia({colorScheme: 'dark'});
  await system.click();
  await expectTheme(page, 'dark');
  await expect.poll(async () => (await savedState(page)).theme).toBe('system');
  await page.reload();
  await expect(system).toHaveAttribute('aria-pressed', 'true');
  await page.emulateMedia({colorScheme: 'light'});
  await expectTheme(page, 'light');
});

test('topbar toggles the resolved OS theme and locks the result', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'});
  await page.goto('/#/settings');
  await page.getByRole('button', {name: '切换浅色外观', exact: true}).click();
  await expectTheme(page, 'light');
  await expect(appearance(page).getByRole('button', {name: '浅色 · 纸与墨'})).toHaveAttribute('aria-pressed', 'true');
  await page.emulateMedia({colorScheme: 'light'});
  await page.emulateMedia({colorScheme: 'dark'});
  await expectTheme(page, 'light');
  await page.getByRole('button', {name: '切换深色外观', exact: true}).click();
  await expectTheme(page, 'dark');
  await expect.poll(async () => (await savedState(page)).theme).toBe('dark');
});

test('exports and imports the system preference, resolving it against the current OS', async ({page}, testInfo) => {
  await page.emulateMedia({colorScheme: 'dark'});
  await page.goto('/#/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: '导出全部学习数据'}).click();
  const download = await downloadPromise;
  const backupPath = testInfo.outputPath('theme-backup.json');
  await download.saveAs(backupPath);
  expect(JSON.parse(await readFile(backupPath, 'utf8')).theme).toBe('system');
  await appearance(page).getByRole('button', {name: '深色 · 夜间实验室'}).click();
  await page.emulateMedia({colorScheme: 'light'});
  await page.locator('input[type="file"]').setInputFiles(backupPath);
  await expect(page.locator('.toast')).toContainText('学习数据已恢复');
  await expect(appearance(page).getByRole('button', {name: '跟随系统', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expectTheme(page, 'light');
  await expect.poll(async () => (await savedState(page)).theme).toBe('system');
  await page.emulateMedia({colorScheme: 'dark'});
  await expectTheme(page, 'dark');
});

for (const preference of [null, 'system', 'light', 'dark']) {
  test(`first paint honors ${preference ?? 'new profile'} before application scripts load`, async ({page}) => {
    await page.emulateMedia({colorScheme: 'dark'});
    if (preference) await page.addInitScript(value => localStorage.setItem('from-zero-to-gpt:theme', value), preference);
    await page.route('**/*', route => route.request().resourceType() === 'script' ? route.abort() : route.continue());
    await page.goto('/', {waitUntil: 'domcontentloaded'});
    await expectTheme(page, preference === 'light' ? 'light' : 'dark');
    await expect(page.locator('.app-shell')).toHaveCount(0);
    expect(await page.locator('html').evaluate(node => getComputedStyle(node).backgroundColor)).toBe(preference === 'light' ? 'rgb(247, 247, 242)' : 'rgb(25, 27, 29)');
  });
}
