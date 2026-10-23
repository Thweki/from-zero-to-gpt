import {expect,type Page} from '@playwright/test';
export async function openNotebook(page:Page){
 const toggle=page.getByRole('button',{name:'切换学习工作台'});
 if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
 await expect(page.getByLabel('当前章节随手笔记',{exact:true})).toBeVisible();
}
export async function closeNotebook(page:Page){
 const toggle=page.getByRole('button',{name:'切换学习工作台'});
 if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
}
