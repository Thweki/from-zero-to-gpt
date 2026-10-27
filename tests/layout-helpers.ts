import {expect,type Page} from '@playwright/test';

export async function expectNoPageOverflow(page:Page){
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=(window.visualViewport?.width??innerWidth))).toBe(true);
}

export async function expectSectionAligned(page:Page,id:string){
 await expect(page.locator('#'+id)).toBeFocused();
 await expect.poll(()=>page.locator('#'+id).evaluate(target=>{
  const tools=document.querySelector('.lesson-sticky-tools')!.getBoundingClientRect();
  const rect=target.getBoundingClientRect();
  // At the document end the browser cannot scroll further; otherwise leave
  // exactly the same breathing room below the measured sticky toolbar.
  const remaining=document.documentElement.scrollHeight-innerHeight-scrollY;
  return rect.top>=tools.bottom+11&&Math.min(rect.top-tools.bottom-12,remaining)<2;
 })).toBe(true);
}
