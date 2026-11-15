import {test,expect} from '@playwright/test';

for(const width of [1440,390])test(`reading progress follows prose at ${width}px without recording completion`,async({page})=>{
  await page.setViewportSize({width,height:700});
  await page.goto('/#/lesson/functions');
  const bar=page.getByRole('progressbar',{name:'直觉理解阅读位置'});
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuenow','0');
  await page.evaluate(()=>document.fonts.ready);
  // Align the reading start, then move halfway through its scrollable range.
  await page.locator('.lesson-reading-content').evaluate(element=>element.scrollIntoView());
  await page.evaluate(()=>{
    const rect=document.querySelector('.lesson-reading-content')!.getBoundingClientRect();
    const covered=document.querySelector('.lesson-sticky-tools')!.getBoundingClientRect().bottom;
    window.scrollTo(0,window.scrollY+rect.top-covered+(rect.height-(innerHeight-covered))/2);
  });
  await expect.poll(async()=>Number(await bar.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(49);
  await expect.poll(async()=>Number(await bar.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(51);
  const bounds=(await bar.boundingBox())!;
  expect(bounds.height).toBe(3);
  expect(bounds.y).toBeGreaterThanOrEqual(52);
  expect(bounds.y+bounds.height).toBeLessThan(200);
  await page.locator('.lesson-reading-content').evaluate(element=>{
    window.scrollTo(0,window.scrollY+element.getBoundingClientRect().bottom-innerHeight+2);
  });
  await expect(bar).toHaveAttribute('aria-valuenow','100');
  await expect(page.getByRole('button',{name:'我已读完，去做实验',exact:true})).toHaveCount(1);
  await page.evaluate(()=>window.scrollTo(0,0));
  await expect(bar).toHaveAttribute('aria-valuenow','0');
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();
  await expect(page.getByRole('progressbar',{name:'数学推导阅读位置'})).toBeVisible();
  await page.goto('/#/lesson/linear');
  await expect(page.getByRole('progressbar',{name:'直觉理解阅读位置'})).toHaveAttribute('aria-valuenow','0');
  await page.goto('/#/map');
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});
