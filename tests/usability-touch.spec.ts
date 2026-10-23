import {test,expect} from '@playwright/test';
// Chromium device/touch emulation only. No Android/iOS OS or soft keyboard.
test('Chromium触控模拟：导航、主题、章节定位与暂停恢复',async({page})=>{
  await page.goto('/');
  expect(await page.evaluate(()=>navigator.maxTouchPoints)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'打开导航',exact:true}).tap();
  await page.getByRole('button',{name:'切换深色外观'}).tap();
  await page.getByRole('link',{name:'学习路线'}).first().tap();
  // The route can already be /map; Escape closes navigation without a fake click.
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'开始探索',exact:true}).tap();
  await page.getByRole('button',{name:'跳到交互实验'}).tap();
  await expect(page.locator('#lesson-experiment')).toBeFocused();
  await page.getByRole('button',{name:'跳到 Python 代码'}).tap();
  await page.getByLabel('Python 代码编辑器').tap();
  await page.getByLabel('Python 代码编辑器').fill('# 输入由自动化填充，不是软键盘测试');
  await page.getByLabel('保存学习断点').tap();
  await page.getByLabel('现在正在想什么').fill('触控模拟已到代码区。');
  await page.getByLabel('下次回来先做哪一步').fill('继续写 square。');
  await page.getByRole('button',{name:'保存并结束本次学习'}).tap();
  await expect(page).toHaveURL(/#\/map$/);
  await page.reload();await expect(page.locator('.resume-card')).toContainText('继续写 square');
  await page.getByRole('button',{name:'恢复学习'}).tap();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.getByLabel('Python 代码编辑器')).toHaveValue('# 输入由自动化填充，不是软键盘测试');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));
  await page.screenshot({path:'artifacts/usability-review/chromium-touch.png',fullPage:true});
});
