import {expect, test} from '@playwright/test';

test('reference output is separate from a saved learner attempt and its acceptance result', async ({page}) => {
  await page.goto('/#/lesson/functions');
  await page.getByRole('tab', {name: '代码实现', exact: true}).click();
  const editor = page.getByRole('textbox', {name: 'Python 代码编辑器'});
  const attempt = 'def square(x):\n    return x\n\nprint("my attempt")\n';
  await editor.fill(attempt);
  await page.getByRole('button', {name: /运行并测试/}).click();
  const ownOutput = page.locator('.code-output:not([aria-label])');
  await expect(ownOutput).toContainText('AssertionError', {timeout: 30000});
  const originalOutput = await ownOutput.textContent();

  await page.getByRole('button', {name: '对照参考', exact: true}).click();
  await page.getByRole('button', {name: '运行参考示例', exact: true}).click();
  const referenceOutput = page.getByRole('status', {name: '参考示例运行结果'});
  await expect(referenceOutput).toContainText('参考示例验收通过', {timeout: 30000});
  await expect(referenceOutput).toContainText('-2 -> 4');
  await expect(referenceOutput).toContainText('2 -> 4');
  await expect(editor).toHaveValue(attempt);
  expect(await ownOutput.textContent()).toBe(originalOutput);

  const savedAttempt = () => page.evaluate(async () => {
    const opening = indexedDB.open('from-zero-to-gpt', 1);
    const db = await new Promise<IDBDatabase>(resolve => { opening.onsuccess = () => resolve(opening.result); });
    try {
      const read = db.transaction('learning').objectStore('learning').get('state');
      const state = await new Promise<any>(resolve => { read.onsuccess = () => resolve(read.result); });
      return state.progress.functions;
    } finally { db.close(); }
  });
  await expect.poll(savedAttempt).toMatchObject({code: attempt, codePassed: false, lastRun: expect.stringContaining('AssertionError')});
  await page.reload();
  await expect(editor).toHaveValue(attempt);
  await expect(page.locator('.code-output')).toContainText('AssertionError');
  await page.getByRole('button', {name: '对照参考', exact: true}).click();
  await expect(referenceOutput).toHaveCount(0);
});
