import {test,expect} from '@playwright/test';

for(const width of [1440,390])test(`lesson checklist persists independently and works with a keyboard at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto('/#/lesson/functions');
  const checklist=page.locator('.lesson-checklist');
  await checklist.locator('summary').click();
  const boxes=checklist.getByRole('checkbox');
  const total=await boxes.count();
  expect(total).toBeGreaterThan(0);
  await boxes.first().focus();await page.keyboard.press('Space');
  await expect(boxes.first()).toBeChecked();
  await expect(checklist.getByRole('status')).toHaveText(`已勾选 1 / ${total}`);
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();
  await expect(boxes.first()).toBeChecked();
  await expect.poll(()=>page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const request=indexedDB.open('from-zero-to-gpt',1);request.onsuccess=()=>resolve(request.result);});
    try{return await new Promise<number>(resolve=>{const request=db.transaction('learning').objectStore('learning').get('state');request.onsuccess=()=>resolve(request.result?.progress.functions?.completedGoals?.length??0);});}finally{db.close();}
  })).toBe(1);
  await page.reload();await checklist.locator('summary').click();
  await expect(boxes.first()).toBeChecked();
  await page.goto('/#/lesson/linear');await expect(page.locator('.lesson-page h1')).toHaveText('线性函数与参数');await checklist.locator('summary').click();
  await expect(boxes.first()).not.toBeChecked();
  await page.goto('/#/lesson/functions');await expect(page.locator('.lesson-page h1')).toHaveText('函数是什么');await checklist.locator('summary').click();
  await expect(boxes.first()).toBeChecked();
  await boxes.first().uncheck();
  await expect(checklist.getByRole('status')).toHaveText(`已勾选 0 / ${total}`);
  await expect(page.getByRole('button',{name:'自评为已掌握',exact:true})).toBeVisible();
  expect(await checklist.evaluate(element=>element.getBoundingClientRect().right<=innerWidth)).toBe(true);
});
