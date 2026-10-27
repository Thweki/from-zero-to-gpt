import {test,expect} from '@playwright/test';
import {lessons} from '../src/data/lessons';
import {expectNoPageOverflow} from './layout-helpers';
// Chromium device/touch emulation only. No Android/iOS OS or soft keyboard.
test('Chromium触控模拟：导航、主题、章节定位与暂停恢复',async({page})=>{
  await page.goto('/');
  expect(await page.evaluate(()=>navigator.maxTouchPoints)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'切换深色外观'}).tap();
  await page.getByRole('button',{name:'打开导航',exact:true}).tap();
  await page.getByRole('link',{name:'学习路线'}).first().tap();
  // The route can already be /map; Escape closes navigation without a fake click.
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'开始探索',exact:true}).tap();
  await page.getByText('本章定位',{exact:true}).tap();await page.getByRole('button',{name:'跳到交互实验'}).tap();
  await expect(page.locator('#lesson-experiment')).toBeFocused();
  await page.getByText('本章定位',{exact:true}).tap();await page.getByRole('button',{name:'跳到 Python 代码'}).tap();
  await page.getByLabel('Python 代码编辑器').tap();
  await page.getByLabel('Python 代码编辑器').fill('# 输入由自动化填充，不是软键盘测试');
  await page.getByLabel('保存学习断点').tap();
  await page.getByLabel('现在正在想什么').fill('触控模拟已到代码区。');
  await page.getByLabel('下次回来先做哪一步').fill('继续写 square。');
  await page.getByRole('button',{name:'保存并结束本次学习'}).tap();
  await expect(page).toHaveURL(/#\/map$/);
  await page.reload();await expect(page.locator('.resume-card')).toContainText('继续写 square');
  await page.getByRole('button',{name:'恢复学习'}).tap();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.getByLabel('Python 代码编辑器')).toHaveValue('# 输入由自动化填充，不是软键盘测试');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));
  await page.screenshot({path:'artifacts/usability-review/chromium-touch.png',fullPage:true});
});

test('Chromium触控模拟：点选实验图带入导师，不自动请求模型',async({page})=>{
 let requests=0;
 await page.route('**/api/tutor/status',route=>route.fulfill({json:{configured:true,provider:'touch fixture',model:'fixture',imagesSupported:false}}));
 await page.route('**/api/tutor/chat',route=>{requests++;return route.fulfill({json:{answer:'模拟回答'}});});
 await page.goto('/#/lesson/functions');
 expect(await page.evaluate(()=>navigator.maxTouchPoints)).toBeGreaterThan(0);
 await page.getByRole('img',{name:'函数图像，随参数实时更新'}).tap({position:{x:80,y:70}});
 await page.getByRole('button',{name:'将选中内容带到 AI 导师',exact:true}).tap();
 await expect(page.locator('.context-panel').getByLabel('向 AI 导师提问')).toBeFocused();
 await expect(page.locator('.tutor-composer .tutor-selection-card img')).toBeVisible();
 await expect(page.locator('.tutor-composer .tutor-selection-card')).toContainText('预览不上传');
 expect(requests).toBe(0);
 const send=await page.locator('.context-panel').getByRole('button',{name:'发送',exact:true}).boundingBox();
 expect(send!.y+send!.height).toBeLessThanOrEqual(await page.evaluate(()=>innerHeight));
 await page.screenshot({path:'artifacts/selection-review/touch-image.png'});
});

test('Chromium触控模拟：44px首页控件与实验观察的保存返回',async({page})=>{
 await page.goto('/');
 for(const control of await page.locator('.topbar button,.view-switch button').all()){
  const box=await control.boundingBox();if(box){expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
 }
 await page.getByRole('button',{name:'开始探索',exact:true}).tap();
 await page.getByLabel('输入 x',{exact:true}).fill('-2');
 await page.getByRole('button',{name:'记录观察',exact:true}).tap();
 await expect(page.getByLabel('这次实验的观察')).toBeFocused();
 await page.getByLabel('这次实验的观察').fill('触控模拟观察；非软键盘输入验收。');
 await page.getByRole('button',{name:'保存观察，回到实验',exact:true}).tap();
 await expect(page.locator('.context-panel')).not.toBeVisible();
 await expect(page.getByLabel('输入 x',{exact:true})).toHaveValue('-2');
});

for(const width of [320,390]){
 for(const family of [...new Set(lessons.map(lesson=>lesson.lab))])test(`${width}px Chromium触控模拟：${family} 所有滑块至少44px且位于页面内`,async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width,height:844});
  for(const lesson of lessons.filter(lesson=>lesson.lab===family)){
   await page.goto(`/#/lesson/${lesson.id}`);
   await expect(page.getByRole('heading',{name:lesson.title,exact:true})).toBeVisible();
   await expect(page.locator('#lesson-experiment .lab-loading')).toHaveCount(0);
   // Wait for lazy lab content, including lessons whose experiment has no range.
   await expect(page.locator('#lesson-experiment svg,#lesson-experiment input,#lesson-experiment button').first()).toBeAttached();
   const boxes=await page.getByRole('slider').evaluateAll(nodes=>nodes.map(n=>({name:n.getAttribute('aria-label'),...n.getBoundingClientRect().toJSON()})));
   for(const box of boxes){
    expect(box.height,`${lesson.id}: ${box.name}`).toBeGreaterThanOrEqual(44);
    expect(box.left,`${lesson.id}: ${box.name}`).toBeGreaterThanOrEqual(0);
    expect(box.right,`${lesson.id}: ${box.name}`).toBeLessThanOrEqual(width);
   }
  }
 });
 test(`${width}px Chromium触控模拟：滑块拖动和方向键更新值`,async({page})=>{
  await page.setViewportSize({width,height:844});await page.goto('/#/lesson/gradients');
  const slider=page.getByRole('slider',{name:'当前位置 x',exact:true});
  await slider.fill('1');await slider.focus();await slider.press('ArrowRight');await expect(slider).toHaveValue('1.1');
  await expect(slider.locator('..').locator('output')).toHaveText('1.1');
  await slider.scrollIntoViewIfNeeded();const box=(await slider.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width-10,box.y+box.height/2,{steps:5});await page.mouse.up();
  expect(Number(await slider.inputValue())).toBeGreaterThan(3);
  await expect(slider.locator('..').locator('output')).toHaveText(await slider.inputValue());
 });
 test(`${width}px Chromium触控模拟：缩进保留选中行、光标及运行操作`,async({page})=>{
  await page.setViewportSize({width,height:844});await page.goto('/#/lesson/functions');
  await page.getByRole('tab',{name:'代码实现',exact:true}).tap();
  const editor=page.getByRole('textbox',{name:'Python 代码编辑器'}),indent=page.getByRole('button',{name:'缩进',exact:true});
  await expect(indent).toBeVisible();await expect(page.locator('.code-keyboard-hint')).not.toBeVisible();
  await editor.fill('def square(x):\nreturn x * x');
  await editor.evaluate((n:HTMLTextAreaElement)=>{n.focus();n.setSelectionRange(15,15);});
  await indent.tap();await expect(editor).toHaveValue('def square(x):\n    return x * x');
  await expect(editor).toBeFocused();expect(await editor.evaluate((n:HTMLTextAreaElement)=>n.selectionStart)).toBe(19);
  await editor.fill('a = 1\nb = 2\nc = 3');
  await editor.evaluate((n:HTMLTextAreaElement)=>{n.focus();n.setSelectionRange(2,12,'backward');});
  await indent.tap();await expect(editor).toHaveValue('    a = 1\n    b = 2\nc = 3');
  expect(await editor.evaluate((n:HTMLTextAreaElement)=>[n.selectionStart,n.selectionEnd,n.selectionDirection])).toEqual([6,20,'backward']);
  await editor.fill('def square(x):\nreturn x * x');
  await editor.evaluate((n:HTMLTextAreaElement)=>{n.focus();n.setSelectionRange(15,15);});
  await editor.press('Control+]');await expect(editor).toHaveValue('def square(x):\n    return x * x');
  await editor.press('Control+Enter');await expect(page.locator('.code-output')).toContainText('✓ 本章单元测试通过',{timeout:30000});
  await editor.fill('while True: pass');await page.getByRole('button',{name:/运行并测试/}).tap();
  await page.getByRole('button',{name:'停止',exact:true}).tap();await expect(page.locator('.code-output')).toContainText('已手动停止');
  await page.getByRole('button',{name:'重置代码',exact:true}).tap();await expect(editor).toHaveValue(lessons.find(l=>l.id==='functions')!.starter);
  await page.getByRole('button',{name:'对照参考',exact:true}).tap();await expect(page.locator('.reference-code')).toBeVisible();
  await expectNoPageOverflow(page);
  await page.screenshot({path:`artifacts/ui-review/code-${width}.png`});
 });
}
