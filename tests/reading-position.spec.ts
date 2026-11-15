import {test,expect,type Page} from '@playwright/test';

const key=(lesson='functions',mode='intuition')=>`from-zero-to-gpt:reading:v1:${lesson}:${mode}`;
async function ready(page:Page){
  await expect(page.locator('#lesson-mode-panel')).toBeVisible();
  await expect(page.locator('.lab-loading')).toHaveCount(0);
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
}
async function readAt(page:Page,anchor:string,fraction=.2){
  await page.evaluate(({anchor,fraction})=>{
    const target=document.querySelector<HTMLElement>(`[data-reading-anchor="${anchor}"]`)!;
    const line=parseFloat(getComputedStyle(document.querySelector('#lesson-mode-panel')!).scrollMarginTop);
    const rect=target.getBoundingClientRect();
    window.scrollTo({top:window.scrollY+rect.top+rect.height*fraction-line,behavior:'instant'});
  },{anchor,fraction});
}
async function expectPosition(page:Page,anchor:string,fraction=.2){
  await expect.poll(()=>page.evaluate(({anchor,fraction})=>{
    const rect=document.querySelector(`[data-reading-anchor="${anchor}"]`)!.getBoundingClientRect();
    const line=parseFloat(getComputedStyle(document.querySelector('#lesson-mode-panel')!).scrollMarginTop);
    return Math.abs(rect.top+rect.height*fraction-line);
  },{anchor,fraction})).toBeLessThan(3);
}

for(const width of [1440,390])test(`reading position survives reload and lesson navigation at width ${width}`,async({page})=>{
  await page.setViewportSize({width,height:800});
  await page.goto('/#/lesson/functions');await ready(page);
  await readAt(page,'section-1');
  await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key())).toMatchObject({anchor:'section-1'});
  await page.reload();await ready(page);await expectPosition(page,'section-1');
  await page.evaluate(()=>{location.hash='/lesson/linear';});await ready(page);
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
  await readAt(page,'experiment',0);
  // Route away before the debounced write: cleanup must flush the old lesson.
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(500);
  await page.evaluate(()=>{location.hash='/lesson/functions';});await ready(page);
  await expectPosition(page,'section-1');
  await page.evaluate(()=>{location.hash='/lesson/linear';});await ready(page);
  await expectPosition(page,'experiment',0);
});

test('each view resumes independently and back to top replaces its saved position',async({page})=>{
  await page.goto('/#/lesson/functions');await ready(page);await readAt(page,'section-1');
  await expect.poll(()=>page.evaluate(k=>localStorage.getItem(k),key())).not.toBeNull();
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();await ready(page);
  await readAt(page,'section-0');
  await expect.poll(()=>page.evaluate(k=>localStorage.getItem(k),key('functions','math'))).not.toBeNull();
  await page.getByRole('tab',{name:'直觉理解',exact:true}).click();await ready(page);await expectPosition(page,'section-1');
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();await ready(page);await expectPosition(page,'section-0');
  await page.getByText('本章定位',{exact:true}).click();
  await page.getByRole('button',{name:'回到开头',exact:true}).click();
  await expect(page.getByRole('heading',{level:1})).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
  await page.reload();await ready(page);
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
});

test('restoration follows the same section after viewport reflow',async({page})=>{
  await page.goto('/#/lesson/functions');await ready(page);await readAt(page,'section-1');
  await expect.poll(()=>page.evaluate(k=>localStorage.getItem(k),key())).not.toBeNull();
  await page.goto('/#/map');
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/lesson/functions');await ready(page);await expectPosition(page,'section-1');
});

for(const interrupt of [false,true])test(`delayed experiment restoration ${interrupt?'yields to navigation':'waits for layout'}`,async({page})=>{
  await page.addInitScript(({key})=>localStorage.setItem(key,JSON.stringify({anchor:'quiz',fraction:0})),{key:key('gradients')});
  let release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/src/components/labs/AdvancedMathLab.tsx*',async route=>{await held;await route.continue();});
  await page.goto('/#/lesson/gradients');
  await expect(page.locator('.lab-loading')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
  if(interrupt){
    await page.getByText('本章定位',{exact:true}).click();
    await page.getByRole('button',{name:'回到开头',exact:true}).click();
  }
  release();await ready(page);
  if(interrupt)await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
  else await expectPosition(page,'quiz',0);
});

test('explicit chapter navigation wins over the destination mode saved position',async({page})=>{
  await page.addInitScript(({key})=>localStorage.setItem(key,JSON.stringify({anchor:'quiz',fraction:0})),{key:key()});
  await page.goto('/#/lesson/functions');await ready(page);
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();await ready(page);
  await page.getByText('本章定位',{exact:true}).click();
  await page.getByRole('button',{name:'跳到交互实验',exact:true}).click();
  await expect(page.locator('#lesson-experiment')).toBeFocused();
  await expectPosition(page,'experiment',0);
});
