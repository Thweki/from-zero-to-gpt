import {describe,it,expect,vi} from 'vitest';
import {validateTutorSelection} from './tutor-selection';
import {initialState,emptyProgress,validateImport} from './storage';
import {buildTutorMessages,handleTutorRequest,validateTutorBody} from '../server/tutor';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=';
const selection={kind:'image' as const,title:'选中的函数图',text:'f(x)=x²；x=-3，y=9',image};
const input={lessonId:'functions',message:'解释图中目标点',sessionId:'selected-graph-tests',selection};
const env={TUTOR_API_KEY:'test-only-secret'};
const request=(body:unknown)=>new Request('https://example.org/api/tutor/chat',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'selection-tests'},body:JSON.stringify(body)});
describe('selection ownership, persistence and image capability',()=>{
 it('preserves only validated selected material through an export/import',()=>{
  const state=initialState();state.progress.functions={...emptyProgress(),tutorDraft:'为什么？',tutorSelection:selection,tutorMessages:[{role:'user',content:'解释',createdAt:new Date().toISOString(),selection}]};
  expect(validateImport(JSON.parse(JSON.stringify(state)))).toEqual(state);
  expect(validateTutorSelection({...selection,url:'https://private.invalid',apiKey:'not-kept'})).toEqual(selection);
 });
 it.each([
  {...selection,image:'https://example.org/private.png'},
  {...selection,image:'data:image/svg+xml;base64,PHN2Zz4='},
  {...selection,image:'data:text/html;base64,PHNjcmlwdD4='},
  {...selection,image:'data:image/png;base64,YWJj'},
  {...selection,image:image+'A'.repeat(240000)},
  {...selection,text:'a'.repeat(3001)},
  {...selection,kind:'text'},
 ])('rejects external, active, oversized or mismatched data',value=>expect(()=>validateTutorSelection(value)).toThrow());
 it('requires explicit operator vision support before a raster can reach the provider',async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:'收到图片。'}}]})));
  expect((await handleTutorRequest(request(input),env,fetcher)).status).toBe(400);expect(fetcher).not.toHaveBeenCalled();
  expect((await handleTutorRequest(request(input),{...env,TUTOR_SUPPORTS_IMAGES:'1'},fetcher)).status).toBe(200);
  const upstream=JSON.parse((fetcher.mock.calls[0] as unknown as [string,RequestInit])[1].body as string);
  expect(upstream.messages.at(-1).content).toEqual([{type:'text',text:expect.stringContaining('"imageAttached":true')},{type:'image_url',image_url:{url:image,detail:'auto'}}]);
  expect(upstream.messages[0].content).not.toContain('referenceImplementation');
 });
 it('text model receives an explicit caption and parameters, never a fabricated visual observation',()=>{
  const {image:_,...textSelection}=selection;
  const messages=buildTutorMessages(validateTutorBody({...input,selection:textSelection}));
  expect(messages[0].content).toContain('不要声称看过图片像素');
  expect(messages.at(-1)?.content).toContain('"imageAttached":false');
  expect(messages.at(-1)?.content).toContain('x=-3，y=9');
  expect(JSON.stringify(messages)).not.toContain(image);
 });
 it('status defaults to text-only; client model claims cannot enable images',async()=>{
  const response=await handleTutorRequest(new Request('https://example.org/api/tutor/status'),env);
  expect(await response.json()).toMatchObject({imagesSupported:false});
  const fetcher=vi.fn();expect((await handleTutorRequest(request({...input,imagesSupported:true}),env,fetcher)).status).toBe(400);expect(fetcher).not.toHaveBeenCalled();
 });
});
