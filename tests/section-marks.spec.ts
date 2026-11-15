import {expect,test} from '@playwright/test';

test('section self-assessment works by keyboard and persists independently across modes and chapters',async({page})=>{
  await page.goto('/#/lesson/functions');
  const marks=page.locator('.section-understanding');
  await expect(marks.first()).toHaveAttribute('aria-pressed','false');
  await marks.first().focus();
  await page.keyboard.press('Space');
  await expect(marks.first()).toBeFocused();
  await expect(marks.first()).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.section-understanding-summary')).toContainText('1 /');
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();
  await expect(marks.first()).toHaveAttribute('aria-pressed','false');
  await marks.first().click();
  await expect.poll(()=>page.evaluate(async()=>{
    const request=indexedDB.open('from-zero-to-gpt',1);
    const db=await new Promise<IDBDatabase>(resolve=>{request.onsuccess=()=>resolve(request.result);});
    try{
      const read=db.transaction('learning').objectStore('learning').get('state');
      const state=await new Promise<any>(resolve=>{read.onsuccess=()=>resolve(read.result);});
      return state?.progress?.functions?.understoodSections?.length;
    }finally{db.close();}
  })).toBe(2);
  await page.reload();
  await expect(marks.first()).toHaveAttribute('aria-pressed','true');
  await page.getByRole('tab',{name:'直觉理解',exact:true}).click();
  await expect(marks.first()).toHaveAttribute('aria-pressed','true');
  await marks.first().focus();await page.keyboard.press('Enter');
  await expect(marks.first()).toHaveAttribute('aria-pressed','false');
  await expect(page.getByRole('button',{name:'自评为已掌握',exact:true})).toBeVisible();
  await expect(page.locator('.learning-evidence')).toContainText('未记录');
  await expect(page.locator('.learning-evidence')).toContainText('待验证');
  await page.goto('/#/lesson/linear');
  await expect(marks.first()).toHaveAttribute('aria-pressed','false');
});
