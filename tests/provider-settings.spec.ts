import {test,expect,type Page} from '@playwright/test';
async function fixture(page:Page){
 let services:any[]=[],activeId:string|null=null,submitted=false,cancelled=false;
 await page.route('**/api/tutor/status',r=>r.fulfill({json:{configured:false,provider:'',model:''}}));
 await page.route('**/api/tutor/services',r=>r.fulfill({json:{services,activeId}}));
 await page.route('**/api/tutor/services/save',async r=>{const {service,secret}=r.request().postDataJSON();expect(secret).toBeUndefined();services=[service];activeId=service.id;await r.fulfill({json:{services,activeId}});});
 await page.route('**/api/tutor/services/engine',async r=>{
  const {action,data}=r.request().postDataJSON();let json:any={};
  if(action==='catalog')json={providers:[{id:'openai',name:'OpenAI / ChatGPT',modelCount:2,methods:[{id:'api_key',name:'使用 API Key'},{id:'oauth',name:'登录订阅账号'}]},{id:'deepseek',name:'DeepSeek',modelCount:2,methods:[{id:'api_key',name:'使用 API Key'}]}]};
  if(action==='loginStart'){submitted=false;json={sessionId:data.method==='oauth'?'oauth-session':'key-session'};}
  if(action==='loginPoll'){
   if(submitted){services=[{id:'service-test',name:'DeepSeek',providerId:'deepseek',baseUrl:'https://managed.invalid',model:'model-one',authMethod:'managed',allowLocalHttp:false,hasCredential:true}];activeId='service-test';json={sessionId:data.sessionId,providerId:'deepseek',state:'complete',snapshot:{services,activeId}};}
   else json=data.sessionId==='oauth-session'?{sessionId:data.sessionId,state:'waiting',event:{type:'device_code',verificationUri:'https://github.com/login/device',userCode:'TEST-CODE'}}:{sessionId:data.sessionId,state:'waiting',prompt:{id:'prompt-1',type:'secret',message:'API key'}};
  }
  if(action==='loginInput'){expect(data.value).toBe('test-secret');submitted=true;}
  if(action==='loginCancel')cancelled=true;
  if(action==='models')json={models:[{id:'model-one',name:'Model One'},{id:'model-two',name:'Model Two'}]};
  await r.fulfill({json});
 });
 return {cancelled:()=>cancelled,services:()=>services};
}
test('choose provider, enter key, select model without a base URL; saved credentials remain masked',async({page})=>{
 const state=await fixture(page);await page.goto('/#/settings');
 await page.getByLabel('服务商',{exact:true}).selectOption('deepseek');
 await expect(page.getByLabel('接口地址',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'使用 API Key',exact:true}).click();
 await page.getByLabel('API Key',{exact:true}).fill('test-secret');
 await expect(page.getByLabel('API Key',{exact:true})).toHaveAttribute('type','password');
 await page.getByRole('button',{name:'继续',exact:true}).click();
 await page.getByLabel('模型',{exact:true}).selectOption('model-two');
 await page.getByRole('button',{name:'保存并使用此模型'}).click();
 await expect.poll(()=>state.services()[0]?.model).toBe('model-two');
 await expect(page.locator('.provider-settings')).not.toContainText('test-secret');
 await expect(page.locator('.provider-settings')).not.toContainText('managed.invalid');
});
test('subscription login shows device instructions and can be cancelled without creating a service',async({page})=>{
 const state=await fixture(page);await page.goto('/#/settings');
 await page.getByRole('button',{name:'登录订阅账号'}).click();await expect(page.locator('.provider-device-code')).toContainText('TEST-CODE');
 await expect(page.getByRole('button',{name:'打开浏览器授权'})).toBeVisible();
 await page.getByRole('button',{name:'取消连接'}).click();await expect.poll(state.cancelled).toBe(true);expect(state.services()).toHaveLength(0);
});
test('dark and light provider settings fit desktop and 320px screens, with custom endpoints only on request',async({page})=>{
 await fixture(page);await page.goto('/#/settings');
 for(const theme of ['light','dark']){
  if(theme==='dark')await page.getByRole('button',{name:'切换深色外观'}).click();
  for(const width of [1440,320]){
   await page.setViewportSize({width,height:1000});await page.locator('.provider-settings').scrollIntoViewIfNeeded();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   await expect(page.getByLabel('服务商',{exact:true})).toBeVisible();
   if(theme==='dark')await page.screenshot({path:`artifacts/dark-appearance/provider-settings-${width}.png`,fullPage:true,animations:'disabled'});
  }
 }
 await page.getByRole('button',{name:'高级：本地模型或自定义接口'}).click();await expect(page.getByLabel('接口地址',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
