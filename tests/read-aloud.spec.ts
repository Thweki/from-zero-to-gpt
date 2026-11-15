import {expect, test} from '@playwright/test';

const enabled = process.env.VITE_EXPERIMENTAL_TTS === 'true';

test('read-aloud is absent in the default build', async ({page}) => {
  test.skip(enabled, 'Run without VITE_EXPERIMENTAL_TTS to test the default.');
  await page.goto('/#/lesson/functions');
  await expect(page.locator('.prose-section').first()).toBeVisible();
  await expect(page.getByRole('region', {name: '朗读课文 · 实验性'})).toHaveCount(0);
});

test('read-aloud controls work by keyboard on a narrow screen and stop on navigation', async ({page}) => {
  test.skip(!enabled, 'Enable VITE_EXPERIMENTAL_TTS=true for the experimental UI.');
  await page.addInitScript(() => {
    const log: string[] = [];
    Object.assign(window, {speechTestLog: log});
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {configurable: true, value: class {
      text: string; constructor(text: string) { this.text = text; }
    }});
    Object.defineProperty(window, 'speechSynthesis', {configurable: true, value: {
      paused: false,
      speak: (utterance: SpeechSynthesisUtterance) => log.push(utterance.text),
      cancel: () => log.push('cancel'), pause: () => log.push('pause'), resume: () => log.push('resume'),
    }});
  });
  await page.setViewportSize({width: 360, height: 800});
  await page.goto('/#/lesson/functions');
  const reader = page.getByRole('region', {name: '朗读课文 · 实验性'});
  await expect(reader).toBeVisible();
  const log = () => page.evaluate(() => (window as unknown as {speechTestLog: string[]}).speechTestLog);
  expect(await log()).toEqual([]);
  await reader.getByLabel('朗读小节').selectOption('1');
  const start = reader.getByRole('button', {name: '朗读本节'});
  await start.focus(); await page.keyboard.press('Enter');
  await expect(reader.getByRole('status')).toHaveText('正在朗读所选小节');
  const selected = await reader.getByRole('combobox').locator('option:checked').textContent();
  expect((await log())[0]).toBe(selected!.replace(/^2 · /, ''));
  await reader.getByRole('button', {name: '暂停朗读'}).click();
  await expect(reader.getByRole('status')).toHaveText('朗读已暂停');
  await reader.getByRole('button', {name: '继续朗读'}).click();
  expect((await log()).slice(-2)).toEqual(['pause', 'resume']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByRole('tab', {name: '数学推导'}).click();
  await expect(reader.getByRole('button', {name: '停止朗读'})).toBeDisabled();
  expect((await log()).at(-1)).toBe('cancel');
  await reader.getByRole('button', {name: '朗读本节'}).click();
  await page.goto('/#/map');
  await expect(reader).toHaveCount(0);
  expect((await log()).at(-1)).toBe('cancel');
});

test('a browser without speech support still shows the lesson', async ({page}) => {
  test.skip(!enabled, 'Enable VITE_EXPERIMENTAL_TTS=true for the experimental UI.');
  await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', {configurable: true, value: undefined}));
  await page.goto('/#/lesson/functions');
  await expect(page.locator('.lesson-read-aloud [role=status]')).toContainText('不支持朗读');
  await expect(page.locator('.prose-section').first()).toBeVisible();
});
