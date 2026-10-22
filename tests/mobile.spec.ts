import { test, expect } from '@playwright/test';
test('mobile navigation, interactive learning, checkpoint and no horizontal overflow',async({page})=>{
  await page.goto('/');await expect(page.locator('.stage-card')).toHaveCount(6);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByLabel('打开导航').click();await page.locator('.lesson-nav-link[href="#/lesson/linear"]').click();
  await page.getByRole('slider',{name:'斜率 k',exact:true}).fill('-1');
  await expect(page.getByTestId('lab-result')).toHaveText('f(2) = -2');
  for(const mode of ['直觉理解','数学推导','代码实现','深入研究']){
    await page.getByRole('tab',{name:mode}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  }
  await page.getByRole('button',{name:'保存思路，今天到这里'}).click();
  await page.getByLabel('下次回来先做哪一步').fill('在手机上继续比较负斜率');
  await page.getByRole('button',{name:'保存并结束本次学习'}).click();
  await page.reload();await expect(page.locator('.resume-card')).toContainText('在手机上继续比较负斜率');
  await page.screenshot({path:'artifacts/mobile-map.png',fullPage:true});
});
