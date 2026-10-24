import {expect,type Page} from '@playwright/test';
export async function openNotebook(page:Page){
 const toggle=page.getByRole('button',{name:'问导师'});
 if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
 if(!await page.getByLabel('当前章节随手笔记',{exact:true}).isVisible())await page.locator('.context-tabs').getByRole('button',{name:'思考笔记',exact:true}).click();
 await expect(page.getByLabel('当前章节随手笔记',{exact:true})).toBeVisible();
}
export async function closeNotebook(page:Page){
 const toggle=page.getByRole('button',{name:'问导师'});
 if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
}
