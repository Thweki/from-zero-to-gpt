import {expect,test,type Page} from '@playwright/test';
import {emptyProgress,initialState} from '../src/storage';

async function storedState(page:Page){
  return page.evaluate(async()=>{
    const opening=indexedDB.open('from-zero-to-gpt',1);
    const db=await new Promise<IDBDatabase>(resolve=>{opening.onsuccess=()=>resolve(opening.result);});
    try{
      const request=db.transaction('learning').objectStore('learning').get('state');
      return await new Promise(resolve=>{request.onsuccess=()=>resolve(request.result);});
    }finally{db.close();}
  });
}
const file=(data:unknown)=>({name:'chapter-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});

for(const width of [1440,390])test(`selectively restores chapters after preview and persists across reload at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const current=initialState();current.theme='dark';current.lastLesson='vectors';
  current.progress.functions={...emptyProgress(),note:'current function note',quizPassed:true};
  current.progress.vectors={...emptyProgress(),note:'keep vector note'};
  current.checkpoint={lessonId:'vectors',question:'keep question',next:'keep next',savedAt:current.updatedAt,code:'keep code',runResult:'keep result'};
  await page.goto('/#/settings');
  await expect(page.getByRole('heading',{name:'学习数据',exact:true})).toBeVisible();
  await page.getByLabel('导入学习数据文件').setInputFiles(file(current));
  await expect(page.locator('.toast')).toContainText('学习数据已恢复');
  const before=await storedState(page);
  const backup=initialState();
  backup.progress.functions={...emptyProgress(),note:'recovered function note',code:'print(42)'};
  backup.progress.vectors={...emptyProgress(),note:'do not restore vector note'};
  const section=page.getByRole('region',{name:'从备份恢复章节'});
  await section.getByLabel('选择性恢复备份文件').setInputFiles(file(backup));
  await expect(section.getByRole('button',{name:'恢复所选章节（0）'})).toBeDisabled();
  await expect(section.getByRole('checkbox')).toHaveCount(2);
  expect(await storedState(page)).toEqual(before);
  await section.getByRole('button',{name:'全选章节'}).click();
  await section.getByRole('button',{name:'取消恢复'}).click();
  expect(await storedState(page)).toEqual(before);
  const chooser=page.waitForEvent('filechooser');await section.getByRole('button',{name:'选择章节备份'}).click();
  await (await chooser).setFiles(file(backup));
  await section.getByRole('checkbox',{name:/函数是什么/}).check();
  await section.getByRole('button',{name:'恢复所选章节（1）'}).click();
  await expect(section.getByRole('status')).toContainText('已恢复 1 个章节');
  await expect(section.getByRole('button',{name:'选择章节备份'})).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading',{name:'学习数据',exact:true})).toBeVisible();
  expect(await storedState(page)).toMatchObject({...current,updatedAt:expect.any(String),progress:{...current.progress,functions:backup.progress.functions}});
  const saved=await storedState(page) as typeof current;
  expect(saved.progress.functions).toEqual(backup.progress.functions);
  await section.getByLabel('选择性恢复备份文件').setInputFiles(file(backup));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
