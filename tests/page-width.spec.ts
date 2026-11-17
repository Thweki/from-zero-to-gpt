import {test,expect} from '@playwright/test';

test('page width changes layout, persists across chapters and reloads, and restores the default',async({page})=>{
  await page.setViewportSize({width:1800,height:1000});
  await page.goto('/#/lesson/functions');
  const article=page.locator('.lesson-page'),control=page.getByLabel('页面宽度');
  const width=()=>article.evaluate(node=>node.getBoundingClientRect().width);
  await expect(control).toHaveValue('standard');
  const standard=await width();
  const font=await page.locator('.prose-section p').first().evaluate(node=>getComputedStyle(node).fontSize);
  await control.selectOption('narrow');expect(await width()).toBeLessThan(standard);
  await control.selectOption('wide');expect(await width()).toBeGreaterThan(standard);
  expect(await page.locator('.prose-section p').first().evaluate(node=>getComputedStyle(node).fontSize)).toBe(font);
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();
  await expect(control).toHaveValue('wide');
  await page.locator('.next-lesson').click();await expect(control).toHaveValue('wide');
  await page.reload();await expect(control).toHaveValue('wide');
  await control.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(control).toHaveValue('standard');expect(await width()).toBe(standard);
});

test('width choices fit small viewports and the open learning assistant',async({page})=>{
  await page.goto('/#/lesson/functions');
  for(const viewport of [390,768,1440]){
    await page.setViewportSize({width:viewport,height:1000});
    for(const width of ['narrow','standard','wide']){
      await page.getByLabel('页面宽度').selectOption(width);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport+1);
    }
  }
  await page.getByRole('button',{name:'问导师',exact:true}).click();
  await expect(page.locator('.app-shell')).not.toHaveClass(/hide-context/);
  const article=await page.locator('.lesson-page').boundingBox();
  const panel=await page.locator('.context-panel').boundingBox();
  expect(article!.x+article!.width).toBeLessThanOrEqual(panel!.x+1);
});
