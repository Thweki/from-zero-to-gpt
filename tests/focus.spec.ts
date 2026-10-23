import {test,expect} from '@playwright/test';
import {openNotebook,closeNotebook} from './focus-helpers';

test('default lesson is a single reading column; requested tools never change the stored lesson',async({page})=>{
 await page.goto('/#/lesson/functions');
 await expect(page.getByRole('heading',{name:'函数是什么',exact:true})).toBeVisible();
 await expect(page.locator('.sidebar')).toHaveAttribute('inert','');
 await expect(page.locator('.context-panel')).not.toBeVisible();
 await expect(page.getByRole('button',{name:'跳到交互实验'})).not.toBeVisible();
 await expect(page.getByText('先修知识、延伸阅读与本地项目',{exact:true})).toBeVisible();
 await expect(page.locator('.references a').first()).not.toBeVisible();
 await page.getByRole('button',{name:'打开导航',exact:true}).click();
 await expect(page.getByRole('button',{name:'收起导航'})).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'打开导航',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'打开导航',exact:true}).click();
 await expect(page.locator('.sidebar')).not.toHaveAttribute('inert');
 await page.locator('.lesson-nav-link[href="#/lesson/linear"]').click();
 await expect(page.locator('.sidebar')).toHaveAttribute('inert','');
 await page.getByRole('slider',{name:'斜率 k',exact:true}).fill('2');
 await openNotebook(page);await page.getByLabel('当前章节随手笔记').fill('先专注观察斜率。');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'切换学习工作台'})).toBeFocused();
 await openNotebook(page);
 await page.getByRole('button',{name:'收起学习工作台'}).click();
 await expect(page.getByRole('button',{name:'切换学习工作台'})).toBeFocused();
 await page.getByText('本章定位',{exact:true}).click();
 await page.keyboard.press('Escape');
 await expect(page.getByText('本章定位',{exact:true})).toBeFocused();
 await page.getByText('本章定位',{exact:true}).click();
 await page.getByRole('button',{name:'跳到交互实验'}).click();
 await expect(page.locator('#lesson-experiment')).toBeFocused();
 await expect(page.locator('.lesson-location')).not.toHaveAttribute('open');
 await expect(page.getByTestId('lab-result')).toHaveText('f(2) = 4');
 await page.reload();await expect(page.locator('.context-panel')).not.toBeVisible();
 await openNotebook(page);await expect(page.getByLabel('当前章节随手笔记')).toHaveValue('先专注观察斜率。');
 await closeNotebook(page);await expect(page.getByTestId('lab-result')).toHaveText('f(2) = 4');
});

for(const theme of ['light','dark'])test(`${theme}: quiet primary actions and paper fit desktop and narrow reading`,async({page})=>{
 await page.goto('/#/lesson/functions');
 if(theme==='dark')await page.getByRole('button',{name:'切换深色外观'}).click();
 const color=await page.locator('html').evaluate(n=>{
   const s=getComputedStyle(n);return {action:s.getPropertyValue('--action-bg').trim(),on:s.getPropertyValue('--on-accent').trim(),accent:s.getPropertyValue('--accent').trim(),bg:s.backgroundColor};
 });
 // No highly saturated blue call-to-action or white-filled action in either theme.
 for(const hex of [color.action,color.accent]){
   const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
   expect(Math.max(...rgb)-Math.min(...rgb)).toBeLessThan(45);
   expect(rgb[2]).toBeLessThanOrEqual(rgb[1]);
 }
 for(const width of [1440,768,390,360]){
   await page.setViewportSize({width,height:900});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
   const article=await page.locator('.lesson-page').boundingBox();expect(article!.width).toBeLessThanOrEqual(840);
   await expect(page.locator('.sidebar')).toHaveAttribute('inert','');
   await expect(page.locator('.context-panel')).not.toBeVisible();
 }
 await page.screenshot({path:`artifacts/focus-review/lesson-${theme}-mobile.png`});
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:`artifacts/focus-review/lesson-${theme}-desktop.png`});
});
