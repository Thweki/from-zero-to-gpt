import {test,expect,type Page} from '@playwright/test';
const status={configured:true,provider:'Selection fixture',model:'fixture',baseURL:'https://mock.invalid/v1',imagesSupported:false};
const input=(page:Page)=>page.locator('.context-panel').getByLabel('向 AI 导师提问');
async function setup(page:Page,imagesSupported=false){
  const sent:Record<string,any>[]=[];
  await page.route('**/api/tutor/status',route=>route.fulfill({json:{...status,imagesSupported}}));
  await page.route('**/api/tutor/chat',route=>{sent.push(route.request().postDataJSON());return route.fulfill({json:{answer:'先看选中部分的含义。'}});});
  await page.goto('/#/lesson/functions');
  await expect(page.locator('.lesson-page h1')).toBeVisible();
  return sent;
}
async function selectText(page:Page,selector='.prose-section p',x=500,y=350){
  return page.locator(selector).first().evaluate((node,point)=>{
    const range=document.createRange();range.selectNodeContents(node);
    const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);
    node.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:point.x,clientY:point.y}));
    return node.textContent;
  },{x,y});
}
const ask=(page:Page)=>page.getByRole('button',{name:'将选中内容带到 AI 导师',exact:true});

test('text selection opens a nearby toolbar, preserves a draft, and sends only after confirmation',async({page})=>{
 const sent=await setup(page);
 await page.getByRole('button',{name:'问导师',exact:true}).click();
 await input(page).fill('先解释为什么需要这个概念。');
 await page.getByRole('button',{name:'关闭学习助手'}).click();
 const text=await selectText(page);
 await expect(ask(page)).toBeVisible();const bounds=await page.getByRole('toolbar',{name:'选中内容操作'}).boundingBox();
 expect(bounds!.x).toBeGreaterThanOrEqual(500);expect(bounds!.y).toBeGreaterThanOrEqual(350);
 await ask(page).click();
 await expect(input(page)).toBeFocused();await expect(input(page)).toHaveValue('先解释为什么需要这个概念。');
 await expect(page.locator('.tutor-composer .tutor-selection-card blockquote')).toHaveText(text!);
 expect(sent).toEqual([]);
 await input(page).press('Enter');
 await expect(page.locator('.tutor-message.assistant')).toBeVisible();
 expect(sent[0]).toMatchObject({message:'先解释为什么需要这个概念。',selection:{kind:'text',title:'函数是什么',text},shareCode:false,shareNote:false});
 expect(sent[0]).not.toHaveProperty('code');expect(sent[0]).not.toHaveProperty('note');
 await expect(page.locator('.tutor-composer .tutor-selection-card')).toHaveCount(0);
 await expect(page.locator('.tutor-message.user .tutor-selection-card')).toContainText(text!);
});

test('reference survives refresh and remains removable without deleting the question',async({page})=>{
 const sent=await setup(page);
 const text=await selectText(page);await ask(page).click();
 await input(page).fill('这里我还没想通。');
 await expect.poll(()=>page.evaluate(async()=>{const request=indexedDB.open('from-zero-to-gpt',1);const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});try{const read=db.transaction('learning').objectStore('learning').get('state');const state=await new Promise<any>(resolve=>{read.onsuccess=()=>resolve(read.result);});return state.progress.functions.tutorDraft;}finally{db.close();}})).toBe('这里我还没想通。');
 await page.reload();await page.getByRole('button',{name:'问导师',exact:true}).click();
 await expect(page.locator('.tutor-composer .tutor-selection-card')).toContainText(text!);
 await expect(input(page)).toHaveValue('这里我还没想通。');
 await page.getByRole('button',{name:'移除所选内容'}).click();
 await expect(input(page)).toHaveValue('这里我还没想通。');await input(page).press('Enter');
 await expect(page.locator('.tutor-message.assistant')).toBeVisible();expect(sent[0]).not.toHaveProperty('selection');
});

test('an experiment image freezes a real preview and numeric context; text model receives no pixels',async({page})=>{
 const sent=await setup(page);
 await page.getByLabel('输入 x',{exact:true}).fill('-3');
 const plot=page.getByRole('img',{name:'函数图像，随参数实时更新'});
 await plot.click({position:{x:100,y:100}});await ask(page).click();
 const reference=page.locator('.tutor-composer .tutor-selection-card');
 await expect(reference.locator('img')).toBeVisible();
 expect(await reference.locator('img').getAttribute('src')).toMatch(/^data:image\/jpeg;base64,\/9j\//);
 await expect(reference).toContainText('预览不上传');
 await reference.getByText('图表说明与选择时的参数').click();
 await expect(reference).toContainText('f(-3) = 9');
 await page.getByLabel('输入 x',{exact:true}).fill('1');
 await expect(reference).toContainText('f(-3) = 9');
 await input(page).press('Enter');await expect(page.locator('.tutor-message.assistant')).toBeVisible();
 expect(sent[0].selection.kind).toBe('image');expect(sent[0].selection.text).toContain('"x":-3');
 expect(sent[0].selection).not.toHaveProperty('image');
});

test('vision-enabled operator config transmits only the explicitly selected raster',async({page})=>{
 const sent=await setup(page,true);
 await page.getByRole('img',{name:'函数图像，随参数实时更新'}).click({position:{x:110,y:110}});await ask(page).click();
 await expect(page.locator('.tutor-composer .tutor-selection-card')).toContainText('发送时会附上这张图片');
 await input(page).press('Enter');await expect(page.locator('.tutor-message.assistant')).toBeVisible();
 expect(sent[0].selection.image).toMatch(/^data:image\/jpeg;base64,\/9j\//);
 expect(sent[0].selection.image.length).toBeLessThanOrEqual(240000);
});

test('toolbar cancels on Escape, outside click, scroll, or a mode switch and ignores editor selections',async({page})=>{
 await setup(page);await selectText(page);await expect(ask(page)).toBeVisible();
 await page.keyboard.press('Escape');await expect(ask(page)).toHaveCount(0);
 await selectText(page);await page.locator('.lesson-page h1').click();await expect(ask(page)).toHaveCount(0);
 await selectText(page);await page.mouse.wheel(0,100);await expect(ask(page)).toHaveCount(0);
 await selectText(page);await page.getByRole('tab',{name:'代码实现',exact:true}).click();await expect(ask(page)).toHaveCount(0);
 const editor=page.getByLabel('Python 代码编辑器');await editor.focus();await editor.press('ControlOrMeta+A');
 await expect(ask(page)).toHaveCount(0);
});

test('keyboard selection shortcut and focused graph both reach the same composer',async({page})=>{
 await setup(page);
 await selectText(page);await page.keyboard.press('Alt+Enter');await expect(ask(page)).toBeFocused();
 await ask(page).press('Enter');await expect(input(page)).toBeFocused();
 await page.getByRole('button',{name:'关闭学习助手'}).click();
 const graphic=page.getByRole('img',{name:'函数图像，随参数实时更新'});
 await graphic.focus();await graphic.press('Enter');await expect(ask(page)).toBeFocused();
 await ask(page).press('Enter');await expect(input(page)).toBeFocused();
 await expect(page.locator('.tutor-composer .tutor-selection-card')).toContainText('已选图表');
});

test('fullscreen graph selection exits fullscreen and opens the visible mentor',async({page})=>{
 await setup(page);
 await page.getByRole('button',{name:'全屏实验',exact:true}).click();
 await expect(page.getByRole('button',{name:'退出全屏',exact:true})).toBeVisible();
 await page.getByRole('img',{name:'函数图像，随参数实时更新'}).click({position:{x:120,y:100}});
 await expect(ask(page)).toBeVisible();await ask(page).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 await expect(input(page)).toBeFocused();await expect(page.locator('.tutor-composer .tutor-selection-card')).toContainText('已选图表');
});

test('narrow dark viewport keeps selection actions and image composer on screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);
 await page.getByRole('button',{name:'切换深色外观'}).click();
 await selectText(page,'.prose-section p',389,843);
 const toolbar=page.getByRole('toolbar',{name:'选中内容操作'});await expect(toolbar).toBeVisible();
 const rect=await toolbar.boundingBox();expect(rect!.x+rect!.width).toBeLessThanOrEqual(390);expect(rect!.y+rect!.height).toBeLessThanOrEqual(844);
 await ask(page).click();await expect(input(page)).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:'artifacts/selection-review/mobile-text.png'});
});

test('a loaded page image is copied without uploading its URL',async({page})=>{
 const sent=await setup(page);
 // An existing loaded textbook image (no arbitrary fetch/upload UI).
 await page.locator('.prose-section').first().evaluate(section=>{
  const image=document.createElement('img');image.alt='函数的输入与输出示意';image.width=180;image.height=90;
  image.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="90"><rect width="180" height="90" fill="#ddd"/><text x="15" y="50">input → output</text></svg>');
  section.append(image);
 });
 await page.getByRole('img',{name:'函数的输入与输出示意',exact:true}).click();await ask(page).click();
 await expect(page.locator('.tutor-composer .tutor-selection-card img')).toBeVisible();
 await input(page).press('Enter');await expect(page.locator('.tutor-message.assistant')).toBeVisible();
 expect(sent[0].selection.title).toBe('函数的输入与输出示意');expect(JSON.stringify(sent[0])).not.toContain('data:image');
});

test('cross-origin pixels without CORS fall back to a caption and never fetch through the server',async({page})=>{
 const sent=await setup(page);
 const url='https://image-fixture.invalid/textbook.png';
 await page.route(url,route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64')}));
 await page.locator('.prose-section').first().evaluate(async(section,url)=>{
  const image=document.createElement('img');image.alt='跨域教材图片';image.width=150;image.height=80;image.src=url;section.append(image);await image.decode();
 },url);
 await page.getByRole('img',{name:'跨域教材图片',exact:true}).click();await ask(page).click();
 const card=page.locator('.tutor-composer .tutor-selection-card');
 await expect(card).toContainText('无法复制预览');await expect(card.locator('img')).toHaveCount(0);
 await input(page).press('Enter');await expect(page.locator('.tutor-message.assistant')).toBeVisible();
 expect(sent[0].selection).not.toHaveProperty('image');expect(JSON.stringify(sent[0])).not.toContain('image-fixture.invalid');
});

test('real mouse drag selects text and a new chapter keeps its own draft and reference',async({page})=>{
 await setup(page);
 const paragraph=page.locator('.prose-section p').first();
 const rect=await paragraph.boundingBox();
 await page.mouse.move(rect!.x+2,rect!.y+10);await page.mouse.down();await page.mouse.move(rect!.x+190,rect!.y+10,{steps:12});await page.mouse.up();
 await expect(ask(page)).toBeVisible();await ask(page).click();
 await expect(page.locator('.tutor-composer .tutor-selection-card blockquote')).not.toHaveText('');
 await page.goto('/#/lesson/linear');await page.getByRole('button',{name:'问导师',exact:true}).click();
 await expect(page.locator('.tutor-composer .tutor-selection-card')).toHaveCount(0);await expect(input(page)).toHaveValue('');
 await page.goto('/#/lesson/functions');await page.getByRole('button',{name:'问导师',exact:true}).click();
 await expect(page.locator('.tutor-composer .tutor-selection-card')).toContainText('已选文字');
});
