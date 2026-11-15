import {test,expect} from '@playwright/test';
import {expectNoPageOverflow,expectSectionAligned} from './layout-helpers';

for(const width of [1440,320])test(`outline supports keyboard navigation and fits a ${width}px viewport`,async({page})=>{
  await page.setViewportSize({width,height:740});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/#/lesson/functions');
  const summary=page.locator('.lesson-location summary');
  for(const mode of ['直觉理解','数学推导','深入研究']){
    await page.getByRole('tab',{name:mode,exact:true}).click();
    await summary.focus();await page.keyboard.press('Enter');
    const buttons=page.getByRole('group',{name:'当前模式小节'}).getByRole('button');
    const titles=await page.locator('.prose-section h2').evaluateAll(headings=>headings.map(heading=>heading.lastChild!.textContent));
    expect(await buttons.locator('span:last-child').allTextContents()).toEqual(titles);
    const menu=page.getByRole('navigation',{name:'本章内容定位'});
    const bounds=(await menu.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y+bounds.height).toBeLessThanOrEqual(740);
    await page.keyboard.press('Tab');await expect(buttons.first()).toBeFocused();
    const target=(await buttons.first().getAttribute('aria-controls'))!;
    await page.keyboard.press('Enter');
    await expectSectionAligned(page,target);
    await summary.click();await expect(buttons.first()).toHaveAttribute('aria-current','location');
    await buttons.last().focus();await page.keyboard.press('Escape');
    await expect(summary).toBeFocused();await expect(page.locator('.lesson-location')).not.toHaveAttribute('open');
    await expectNoPageOverflow(page);
  }
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();await summary.click();
  await expect(page.getByRole('group',{name:'当前模式小节'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'跳到 Python 代码',exact:true})).toBeVisible();
});

test('heading navigation works while the later experiment is still loading',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  let release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/src/components/labs/AdvancedMathLab.tsx*',async route=>{await held;await route.continue();});
  try{
    await page.goto('/#/lesson/gradients');
    await expect(page.locator('.lab-loading')).toBeVisible();
    await page.locator('.lesson-location summary').click();
    const button=page.locator('.lesson-outline button').last();
    const target=(await button.getAttribute('aria-controls'))!;
    await button.click();await expectSectionAligned(page,target);
    await expect(page.locator('.lab-loading')).toBeVisible();
  }finally{release();}
});
