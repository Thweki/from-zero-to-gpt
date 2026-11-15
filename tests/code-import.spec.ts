import { test, expect } from '@playwright/test';

test('preview, cancel, replace and persist a local Python exercise', async ({ page }) => {
  await page.goto('/#/lesson/functions');
  await page.getByRole('tab', { name: '代码实现', exact: true }).click();
  const editor = page.getByLabel('Python 代码编辑器');
  await editor.fill('# original draft');
  await page.getByText('导入 Python 文件', { exact: true }).click();
  const picker = page.getByLabel('选择 Python 文件');
  const code = '# 来自编辑器\r\ndef square(x):\r\n    return x * x\r\n';
  const file = { name: 'square.py', mimeType: 'text/x-python', buffer: Buffer.from(code) };
  await picker.setInputFiles(file);
  await expect(page.getByLabel('文件代码')).toContainText('return x * x');
  await expect(editor).toHaveValue('# original draft');
  await page.getByRole('button', { name: '取消导入' }).click();
  await expect(editor).toHaveValue('# original draft');
  await expect(picker).toBeFocused();

  await picker.setInputFiles({ name: 'bad.py', mimeType: 'text/x-python', buffer: Buffer.from([0xff]) });
  await expect(page.locator('.code-import [role=status]')).toContainText('UTF-8');
  await expect(editor).toHaveValue('# original draft');
  await picker.setInputFiles(file);
  await page.getByRole('button', { name: '替换当前代码' }).click();
  await expect(editor).toHaveValue(code.replaceAll('\r\n', '\n'));
  await expect(editor).toBeFocused();
  await expect(page.locator('.code-output')).toHaveCount(0);
  await expect(page.locator('.learning-evidence')).toContainText('未验证');
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('from-zero-to-gpt', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<string>(resolve => {
        const request = db.transaction('learning').objectStore('learning').get('state');
        request.onsuccess = () => resolve(request.result?.progress?.functions?.code);
      });
    } finally { db.close(); }
  })).toBe(code);
  await page.reload();
  await expect(editor).toHaveValue(code.replaceAll('\r\n', '\n'));
});
