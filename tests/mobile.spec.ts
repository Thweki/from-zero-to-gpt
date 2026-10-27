import { test, expect } from '@playwright/test';
import {expectNoPageOverflow,expectSectionAligned} from './layout-helpers';
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
  await expect(page).toHaveURL(/#\/map$/);
  await page.reload();await expect(page.locator('.resume-card')).toContainText('在手机上继续比较负斜率');
  await page.screenshot({path:'artifacts/mobile-map.png',fullPage:true});
});

for(const width of [320,360,390,760,761,1440])for(const theme of ['light','dark'] as const){
 test(`${width}px ${theme}: top controls and all lesson modes fit the visual viewport`,async({page})=>{
  await page.setViewportSize({width,height:width===320?568:844});
  await page.goto('/');await expect(page.locator('.stage-card')).toHaveCount(6);
  if(theme==='dark')await page.getByRole('button',{name:'切换深色外观'}).click();
  const assertToolbar=async()=>{
   await page.evaluate(()=>scrollTo(0,0));
   await expectNoPageOverflow(page);
   for(const control of await page.locator('.topbar button,.topbar input,.topbar .home-link').all()){
    await expect(control).toBeVisible();
    const box=(await control.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(width);
    expect(await control.evaluate(element=>{
     const r=element.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
     return hit===element||element.contains(hit);
    })).toBe(true);
   }
  };
  await assertToolbar();
  if(width===320)await page.screenshot({path:`artifacts/ui-review/home-${width}-${theme}.png`});
  await page.goto('/#/lesson/gradients');
  for(const mode of ['直觉理解','数学推导','代码实现','深入研究']){
   await page.getByRole('tab',{name:mode,exact:true}).click();
   await assertToolbar();
   const boxes=await page.locator('.mode-tabs button,.lesson-location summary').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
   for(const [i,a] of boxes.entries())for(const b of boxes.slice(i+1))expect(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom).toBe(true);
  }
  const last=page.getByRole('tab',{name:'深入研究',exact:true});await last.focus();
  for(const [key,mode] of [['Home','直觉理解'],['ArrowRight','数学推导'],['End','深入研究'],['ArrowRight','直觉理解'],['ArrowLeft','深入研究']]){
   await page.keyboard.press(key);await expect(page.getByRole('tab',{name:mode,exact:true})).toBeFocused();
   await expect(page.getByRole('tab',{name:mode,exact:true})).toHaveAttribute('aria-selected','true');
  }
  await page.getByRole('button',{name:'2 · 动手实验',exact:true}).click();
  await expectSectionAligned(page,'lesson-experiment');
  await page.screenshot({path:`artifacts/ui-review/gradient-${width}-${theme}.png`});
 });
}
