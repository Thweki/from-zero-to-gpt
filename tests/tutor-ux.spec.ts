import {test,expect} from '@playwright/test';
const status={configured:true,provider:'UX fixture',model:'fixture',baseURL:'https://mock.invalid/v1'};

test('one click opens mentor for current mathematics; suggestions are editable drafts, not requests',async({page})=>{
 const sent:Record<string,unknown>[]=[];
 await page.route('**/api/tutor/status',route=>route.fulfill({json:status}));
 await page.route('**/api/tutor/chat',route=>{sent.push(route.request().postDataJSON());return route.fulfill({json:{answer:'先看每个符号的含义。'}});});
 await page.goto('/#/lesson/functions');await page.getByRole('tab',{name:'数学推导',exact:true}).click();
 await page.getByRole('button',{name:'问导师',exact:true}).click();
 const tutor=page.locator('.context-panel .tutor-panel');
 await expect(tutor.getByLabel('向 AI 导师提问')).toBeFocused();
 await expect(tutor.locator('.tutor-scope')).toContainText('数学推导');
 await expect(tutor.locator('.tutor-options')).toHaveCount(0);
 await tutor.getByRole('button',{name:'这个公式怎么一步步得到？',exact:true}).click();
 expect(await tutor.getByLabel('向 AI 导师提问').inputValue()).toContain('每个符号');
 expect(sent).toEqual([]);
 await tutor.getByLabel('向 AI 导师提问').fill('请解释定义域和陪域。');
 await tutor.getByLabel('向 AI 导师提问').press('Enter');
 await expect(tutor.locator('.tutor-message.assistant')).toBeVisible();
 expect(sent).toHaveLength(1);
 expect(sent[0]).toMatchObject({lessonId:'functions',readingMode:'math',mode:'guide',difficulty:'beginner',shareCode:false,shareNote:false,message:'请解释定义域和陪域。'});
 await page.getByRole('tab',{name:'深入研究',exact:true}).click();
 await expect(tutor.locator('.tutor-scope')).toContainText('深入研究');
 await expect(tutor.locator('.tutor-message.assistant')).toBeVisible();
});

test('code attachment is explicit, visible and removable; IME and Shift+Enter never submit',async({page})=>{
 const sent:Record<string,unknown>[]=[];
 await page.route('**/api/tutor/status',route=>route.fulfill({json:status}));
 await page.route('**/api/tutor/chat',route=>{sent.push(route.request().postDataJSON());return route.fulfill({json:{answer:'先检查 return。'}});});
 await page.goto('/#/lesson/functions');await page.getByRole('tab',{name:'代码实现',exact:true}).click();
 await page.getByLabel('Python 代码编辑器').fill('private_attempt = 7');
 await page.getByRole('button',{name:'问导师',exact:true}).click();
 const tutor=page.locator('.context-panel .tutor-panel'),input=tutor.getByLabel('向 AI 导师提问');
 await tutor.getByRole('button',{name:'附上当前代码',exact:true}).click();
 await expect(tutor.getByRole('button',{name:'不再附上代码和错误'})).toBeVisible();
 await input.fill('先给一个小提示');
 await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});
 await input.press('Shift+Enter');
 expect(sent).toEqual([]);expect(await input.inputValue()).toContain('\n');
 await tutor.getByRole('button',{name:'发送',exact:true}).click();
 await expect(tutor.locator('.tutor-message.assistant')).toHaveCount(1);
 expect(sent[0]).toMatchObject({shareCode:true,code:'private_attempt = 7',shareNote:false,readingMode:'code'});
 await tutor.getByRole('button',{name:'不再附上代码和错误'}).click();
 await input.fill('这次只解释概念');await input.press('Enter');
 await expect(tutor.locator('.tutor-message.assistant')).toHaveCount(2);
 expect(sent[1]).toMatchObject({shareCode:false,shareNote:false});expect(sent[1]).not.toHaveProperty('code');
});

test('the full mentor page focuses its existing conversation instead of opening a duplicate',async({page})=>{
 await page.route('**/api/tutor/status',route=>route.fulfill({json:status}));
 await page.goto('/#/tutor');await page.getByRole('button',{name:'问导师',exact:true}).click();
 await expect(page.locator('.tutor-page').getByLabel('向 AI 导师提问')).toBeFocused();
 await expect(page.locator('.context-panel')).not.toBeVisible();
 await expect(page.getByRole('region',{name:'AI 导师对话'})).toHaveCount(1);
});


test('required access code is visible before sending and never saved with the learning draft',async({page})=>{
 let authorization='';
 await page.route('**/api/tutor/status',route=>route.fulfill({json:{...status,accessCodeRequired:true}}));
 await page.route('**/api/tutor/chat',route=>{authorization=route.request().headers().authorization;return route.fulfill({json:{answer:'连接已通过。'}});});
 await page.goto('/#/tutor');const tutor=page.locator('.tutor-page .tutor-panel');
 await tutor.getByLabel('向 AI 导师提问').fill('解释一下函数。');
 await expect(tutor.getByLabel('导师访问码')).toBeVisible();
 await expect(tutor.getByRole('button',{name:'发送',exact:true})).toBeDisabled();
 await tutor.getByLabel('导师访问码').fill('test-only-access-code');
 await tutor.getByRole('button',{name:'发送',exact:true}).click();
 await expect(tutor.locator('.tutor-message.assistant')).toBeVisible();
 expect(authorization).toBe('Bearer test-only-access-code');
 await page.reload();await expect(tutor.getByLabel('导师访问码')).toHaveValue('');
 await expect(tutor.getByRole('log')).not.toContainText('test-only-access-code');
});
