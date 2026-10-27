import {test,expect,type Page} from '@playwright/test';
import {lessons} from '../src/data/lessons';
const metadata={configured:true,provider:'review fixture',model:'fixture',baseURL:'https://fixture.invalid'};
const evidence=(page:Page)=>page.getByRole('region',{name:'本章学习记录'});
async function saved(page:Page){return page.evaluate(async()=>{
 const opening=indexedDB.open('from-zero-to-gpt',1);const db=await new Promise<IDBDatabase>(resolve=>{opening.onsuccess=()=>resolve(opening.result);});
 try{const request=db.transaction('learning').objectStore('learning').get('state');return await new Promise<any>(resolve=>{request.onsuccess=()=>resolve(request.result);});}finally{db.close();}
});}

test('a beginner can finish three recommended activities without optional work or automatic mastery',async({page})=>{
 await page.goto('/#/lesson/functions');
 await expect(page.getByRole('region',{name:'新手推荐路径'})).toContainText('数学推导、代码实现和深入研究是可选扩展');
 await expect(page.getByRole('button',{name:'自评为已掌握',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'我已读完，去做实验',exact:true}).click();
 await expect(page.locator('#lesson-experiment')).toBeFocused();
 await page.getByRole('slider',{name:'输入 x',exact:true}).fill('-2');
 await page.getByRole('button',{name:'3 · 自测理解',exact:true}).click();
 await page.locator('.quiz-options input').nth(1).check();await page.getByRole('button',{name:'检查我的理解',exact:true}).click();
 await expect(page.getByRole('region',{name:'新手推荐路径'})).toContainText('推荐的这一小轮，已经完成');
 await expect(evidence(page)).toContainText('已阅读');await expect(evidence(page)).toContainText('已验证');
 await expect(evidence(page)).toContainText('未验证');await expect(evidence(page)).toContainText('尚未自评');
 await page.getByRole('tab',{name:'代码实现',exact:true}).click();await expect(page.locator('.mode-estimate')).toContainText('可选扩展');
 await page.reload();await expect(evidence(page)).toContainText('尚未自评');
 await expect.poll(async()=>{const state=await saved(page);return state.progress.functions;}).toMatchObject({readCompleted:true,experimented:true,quizPassed:true,status:'learning'});
 await page.getByRole('button',{name:'自评为已掌握',exact:true}).click();await expect(evidence(page)).toContainText('自评已掌握');
});

test('wrong feedback and requested hints use exactly one area and can be collapsed',async({page})=>{
 await page.goto('/#/lesson/functions');await page.locator('.quiz-options input').nth(0).check();
 await page.getByRole('button',{name:'检查我的理解',exact:true}).click();
 const hint=lessons.find(lesson=>lesson.id==='functions')!.quiz.hint;
 await expect(page.locator('.quiz-card').getByText(hint,{exact:true})).toHaveCount(1);
 await page.getByRole('button',{name:'收起提示',exact:true}).click();await expect(page.locator('.quiz-hint')).toHaveCount(0);
 await page.getByRole('button',{name:'给我一个提示',exact:true}).click();await expect(page.locator('.quiz-card').getByText(hint,{exact:true})).toHaveCount(1);
});

test('recording an observation keeps existing notes, snapshots the function and restores the experiment location',async({page})=>{
 let connectionChecks=0;await page.route('**/api/tutor/status',route=>{connectionChecks++;return route.fulfill({json:metadata});});
 await page.goto('/#/lesson/functions');
 await page.getByRole('button',{name:'问导师',exact:true}).click();await page.locator('.context-tabs').getByRole('button',{name:'思考笔记',exact:true}).click();
 await page.getByLabel('当前章节随手笔记').fill('原有理解，请保留。');await page.getByRole('button',{name:'关闭学习助手',exact:true}).click();
 await page.getByLabel('输入 x',{exact:true}).fill('-2');
 const trigger=page.getByRole('button',{name:'记录观察',exact:true});await trigger.scrollIntoViewIfNeeded();
 const before=await page.evaluate(()=>scrollY);await trigger.click();
 const note=page.getByRole('region',{name:'实验观察笔记'});
 await expect(note.getByLabel('这次实验的观察')).toBeFocused();await expect(note).toContainText('f(-2) = 4');
 await expect(note).not.toContainText('"ax"');
 await note.getByLabel('这次实验的观察').fill('输入 −2 和 2 都得到 4，函数不要求不同输入有不同输出。');
 await note.getByRole('button',{name:'保存观察，回到实验',exact:true}).click();
 await expect(page.locator('.context-panel')).not.toBeVisible();await expect(trigger).toBeFocused();
 expect(Math.abs(await page.evaluate(()=>scrollY)-before)).toBeLessThan(4);
 await expect.poll(async()=>{const s=await saved(page);return s.progress.functions.note;}).toContain('原有理解，请保留。');
 const state=await saved(page);expect(state.progress.functions.note).toContain('f(-2) = 4');expect(state.progress.functions.note).toContain('输入 −2 和 2');
 expect(state.progress.functions.observationDraft).toBe('');expect(connectionChecks).toBe(1);
});

test('unfinished observation restores after refresh, and reopening never replaces the pending snapshot',async({page})=>{
 await page.goto('/#/lesson/functions');await page.getByLabel('输入 x',{exact:true}).fill('-2');
 await page.getByRole('button',{name:'记录观察',exact:true}).click();await page.getByLabel('这次实验的观察').fill('还没想完，比较对称性。');
 await expect.poll(async()=>{const s=await saved(page);return s.progress.functions.observationDraft;}).toBe('还没想完，比较对称性。');
 await page.reload();await page.getByLabel('输入 x',{exact:true}).fill('1');await page.getByRole('button',{name:'记录观察',exact:true}).click();
 await expect(page.getByLabel('这次实验的观察')).toHaveValue('还没想完，比较对称性。');

 await expect(page.locator('.observation-note')).toContainText('f(-2) = 4');
 await page.getByRole('button',{name:'暂存，继续实验',exact:true}).click();await expect(page.getByLabel('输入 x',{exact:true})).toHaveValue('1');
 await page.getByRole('button',{name:'全屏实验',exact:true}).click();
 await page.getByRole('button',{name:'记录观察',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 await expect(page.getByLabel('这次实验的观察')).toHaveValue('还没想完，比较对称性。');
 for(const [id,button] of [['algebra','全屏数学实验'],['pretraining-scaling','全屏现代 LLM 实验']]){
  await page.goto(`/#/lesson/${id}`);await page.getByRole('button',{name:button,exact:true}).click();
  await expect(page.getByRole('button',{name:'记录观察',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'记录观察',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
  await expect(page.getByLabel('这次实验的观察')).toBeFocused();await expect(page.locator('.observation-note')).toContainText(lessons.find(lesson=>lesson.id===id)!.title);
 }
});

test('a nearly full notebook keeps its original data and observation draft when append would exceed the import limit',async({page})=>{
 await page.goto('/#/settings');
 const data={version:1,theme:'dark',lastLesson:'functions',updatedAt:new Date().toISOString(),progress:{functions:{status:'learning',mode:'intuition',note:'n'.repeat(99980),code:'def square(x):\n    return x * x',review:false}}};
 await page.getByLabel('导入学习数据文件').setInputFiles({name:'notes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await expect(page.locator('.toast')).toContainText('学习数据已恢复');
 await page.goto('/#/lesson/functions');await page.getByRole('button',{name:'记录观察',exact:true}).click();await page.getByLabel('这次实验的观察').fill('这段观察应保留为草稿。');
 await page.getByRole('button',{name:'保存观察，回到实验',exact:true}).click();await expect(page.locator('.toast')).toContainText('长度上限');
 await expect(page.getByLabel('这次实验的观察')).toHaveValue('这段观察应保留为草稿。');
 await expect.poll(async()=>{const s=await saved(page);return s.progress.functions.observationDraft;}).toBe('这段观察应保留为草稿。');
 await page.reload();const restored=await saved(page);expect(restored.progress.functions.note.length).toBe(99980);expect(restored.progress.functions.code).toContain('return x * x');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});

for(const [route,label] of [['labs','选择实验章节'],['notes','选择笔记章节'],['tutor','导师关联章节']])test(`${route} uses the same two-level, searchable chapter picker with recents`,async({page})=>{
 await page.route('**/api/tutor/status',r=>r.fulfill({json:metadata}));
 await page.goto('/#/lesson/functions');await page.goto('/#/lesson/linear');await page.goto(`/#/${route}`);
 await expect(page.getByLabel(`${label}：阶段`,{exact:true}).locator('option')).toHaveCount(6);
 expect(await page.getByLabel(label,{exact:true}).locator('option').count()).toBeLessThanOrEqual(23);
 await page.getByText('搜索与最近学习',{exact:true}).click();await expect(page.locator('.chapter-recent')).toContainText('线性函数与参数');
 await page.getByLabel(`${label}：搜索`,{exact:true}).fill('Self-Attention');
 await page.getByRole('button',{name:'选择章节：Self-Attention 与张量形状',exact:true}).click();
 await expect(page.getByLabel(`${label}：阶段`,{exact:true})).toHaveValue('4');
 await expect(page.getByLabel(label,{exact:true})).toHaveValue('self-attention');
 await page.getByText('搜索与最近学习',{exact:true}).click();await page.getByRole('button',{name:/返回进入本页时的章节/}).click();
 await expect(page.getByLabel(label,{exact:true})).toHaveValue('linear');
 await page.getByLabel(`${label}：阶段`,{exact:true}).selectOption('6');
 await expect(page.getByLabel(label,{exact:true}).locator('option')).toHaveCount(11);
});

test('pending status is shared across routes, with no false missing-key message or repeated request',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let requests=0;
 await page.route('**/api/tutor/status',async route=>{requests++;await gate;await route.fulfill({json:metadata});});
 await page.goto('/#/tutor');await expect(page.locator('.tutor-model summary')).toHaveText('正在检测连接');
 await expect(page.locator('.tutor-unavailable')).toHaveCount(0);
 await page.goto('/#/settings');await expect(page.locator('.settings-card').filter({has:page.getByRole('heading',{name:'AI 导师连接'})})).toContainText('正在检测连接');
 expect(requests).toBe(1);release();
 await expect(page.locator('.tutor-config')).toContainText('review fixture');
 await page.goto('/#/tutor');await expect(page.locator('.tutor-model summary')).toHaveText('服务端已配置 · 查看模型');
 expect(requests).toBe(1);await expect(page.locator('.tutor-unavailable')).toHaveCount(0);
});

test('code evidence describes the currently tested code and clears on edits, including edits while running',async({page})=>{
 await page.goto('/#/lesson/functions');await page.getByRole('tab',{name:'代码实现',exact:true}).click();
 const editor=page.getByLabel('Python 代码编辑器');await editor.fill('def square(x):\n    return x * x\n');
 await page.getByRole('button',{name:/运行并测试/}).click();await expect(page.locator('.code-output.success')).toBeVisible({timeout:45000});
 await expect(evidence(page)).toContainText('验收通过');
 await editor.fill('import time\ntime.sleep(1)\ndef square(x):\n    return x * x\n');await expect(evidence(page)).toContainText('未验证');
 await page.getByRole('button',{name:/运行并测试/}).click();await editor.fill('def square(x):\n    return None\n');
 await expect(page.locator('.code-output.success')).toBeVisible({timeout:45000});await expect(evidence(page)).toContainText('未验证');
 await expect.poll(async()=>{const s=await saved(page);return s.progress.functions.codePassed;}).toBe(false);
});

for(const theme of ['light','dark'])test(`${theme}: primary mobile targets are 44px and plot labels remain readable`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 if(theme==='dark')await page.getByRole('button',{name:'切换深色外观',exact:true}).click();
 for(const item of await page.locator('.topbar button,.view-switch button').all()){
   const box=await item.boundingBox();if(box){expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
 }
 await page.getByRole('button',{name:'开始探索',exact:true}).click();
 const screenFont=await page.getByRole('img',{name:'函数图像，随参数实时更新'}).evaluate(svg=>{
  const node=svg as SVGSVGElement,text=node.querySelector('text')!;return parseFloat(getComputedStyle(text).fontSize)*node.getBoundingClientRect().width/node.viewBox.baseVal.width;
 });expect(screenFont).toBeGreaterThanOrEqual(11.5);
 expect(await page.locator('.plot-caption').evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(13);
 for(const width of [390,360]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
 await page.screenshot({path:`artifacts/review-fixes/${theme}-mobile.png`});
});

test('dependency view preserves stage and complete-directory choices and exposes textual prerequisites',async({page})=>{
 await page.goto('/');
 const rows=page.locator('.stage-content .chapter-row');await expect(rows).toHaveCount(5);
 await page.getByRole('button',{name:'知识依赖视图',exact:true}).click();await expect(rows).toHaveCount(5);
 await expect(rows.filter({hasText:'向量点积'})).toContainText('先修：线性函数与参数、向量的基本概念');
 await page.getByRole('button',{name:/展开数学基础全部/}).click();await expect(rows).toHaveCount(23);
 await page.getByRole('button',{name:'课程路线视图',exact:true}).click();await expect(rows).toHaveCount(23);
 await page.getByRole('button',{name:'知识依赖视图',exact:true}).click();await expect(rows).toHaveCount(23);
 await page.getByRole('button',{name:'收起阶段目录',exact:true}).click();await expect(rows).toHaveCount(5);
 await page.locator('.stage-heading').nth(1).click();
 const second=await rows.count();
 for(const name of ['课程路线视图','知识依赖视图']){
  await page.getByRole('button',{name,exact:true}).click();await expect(page.locator('.stage-heading').nth(1)).toHaveAttribute('aria-expanded','true');await expect(rows).toHaveCount(second);
 }
 await page.locator('.dependency-flow').getByRole('button',{name:'向量点积',exact:true}).click();await expect(page).toHaveURL(/#\/lesson\/dot-product$/);
});

for(const width of [320,390,1440])test(`${width}px shared Cartesian axis labels avoid every end tick in light and dark themes`,async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width,height:844});
 for(const lesson of lessons.filter(lesson=>lesson.lab==='math-advanced')){
  await page.goto(`/#/lesson/${lesson.id}`);await expect(page.getByRole('heading',{name:lesson.title,exact:true})).toBeVisible();
  await expect(page.locator('.lab-loading')).toHaveCount(0);
  for(const theme of ['light','dark']){
   if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:theme==='dark'?'切换深色外观':'切换浅色外观',exact:true}).click();
   await page.evaluate(()=>document.fonts.ready);
   const charts=page.locator('svg:has(.am-x-label)');
   for(const chart of await charts.all()){
    await expect(chart).toHaveAttribute('role','img');expect(await chart.getAttribute('aria-label')).toBeTruthy();await expect(chart.locator('title')).not.toBeEmpty();
    await expect.poll(()=>chart.evaluate(svg=>{
     return ['x','y'].every(axis=>{
      const label=svg.querySelector(`.am-${axis}-label`)!.getBoundingClientRect();
      return Array.from(svg.querySelectorAll(`.am-${axis}-tick`)).every(n=>{const tick=n.getBoundingClientRect();return tick.right<label.left||tick.left>label.right||tick.bottom<label.top||tick.top>label.bottom;});
     });
    }),{message:lesson.id}).toBe(true);
   }
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=(window.visualViewport?.width??innerWidth))).toBe(true);
 }
});
