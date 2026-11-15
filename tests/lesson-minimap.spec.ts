import {test,expect} from '@playwright/test';

for(const width of [1440,390])test(`reading minimap follows the viewport and focuses prose at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/#/lesson/functions');
  const minimap=page.getByRole('navigation',{name:'正文视窗缩略图'});
  await expect(minimap).toBeVisible();
  const headings=page.locator('.prose-section h2');
  await expect(minimap.getByRole('button')).toHaveCount(await headings.count());
  const last=minimap.getByRole('button').last();
  await last.focus();await page.keyboard.press('Enter');
  await expect(headings.last()).toBeFocused();
  await expect(last).toHaveAttribute('aria-current','location');
  const tools=(await page.locator('.lesson-sticky-tools').boundingBox())!;
  const heading=(await headings.last().boundingBox())!;
  expect(heading.y).toBeGreaterThanOrEqual(tools.y+tools.height);
  expect(heading.y).toBeLessThan(tools.y+tools.height+16);
  await expect(page.locator('.lesson-minimap-viewport')).toBeVisible();
  await page.locator('#lesson-quiz').evaluate(element=>element.scrollIntoView());
  await expect(page.locator('.lesson-minimap-viewport')).toHaveCount(0);
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await expect(page.locator('.lesson-minimap-viewport')).toBeVisible();
  for(const name of ['数学推导','深入研究']){
    await page.getByRole('tab',{name,exact:true}).click();
    await expect(minimap.getByRole('button')).toHaveCount(await headings.count());
    await minimap.getByRole('button').first().click();
    await expect(headings.first()).toBeFocused();
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  await expect(minimap).toHaveCount(0);
  await page.getByRole('tab',{name:'直觉理解',exact:true}).click();
  await expect(minimap).toBeVisible();
  await page.screenshot({path:`artifacts/minimap-${width}.png`});
});
