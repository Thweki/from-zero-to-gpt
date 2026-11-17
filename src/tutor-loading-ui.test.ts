// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {foundationLessons} from './data/foundations';
import {DeferredTutorPanel} from './components/DeferredTutorPanel';

const loading=vi.hoisted(()=>{
  let resolve!:()=>void;
  const promise=new Promise<void>(done=>{resolve=done;});
  return {promise,resolve,requested:vi.fn()};
});
vi.mock('./components/TutorPanel',async importOriginal=>{
  loading.requested();
  await loading.promise;
  return importOriginal();
});
vi.mock('./tutor-connection',()=>({useTutorConnection:()=>({checking:false,status:null,error:'',refresh:vi.fn()})}));

it('loads on demand, preserves drafts and focuses the compact composer after loading',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.stubGlobal('matchMedia',()=>({matches:true}));
  Element.prototype.scrollIntoView=vi.fn();
  const container=document.createElement('div');
  document.body.append(container);
  const root=createRoot(container);
  const props={lesson:foundationLessons[0],messages:[],onMessages:vi.fn(),draft:'保留我的问题',compact:true};
  try{
    expect(loading.requested).not.toHaveBeenCalled();
    await act(async()=>{root.render(createElement(DeferredTutorPanel,props));});
    expect(loading.requested).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('正在打开 AI 导师…');
    expect(container.querySelector('textarea')).toBeNull();

    await act(async()=>{loading.resolve();await vi.dynamicImportSettled();});
    const composer=container.querySelector<HTMLTextAreaElement>('.tutor-composer textarea');
    expect(composer?.value).toBe(props.draft);
    expect(document.activeElement).toBe(composer);
    expect(container.textContent).not.toContain('正在打开 AI 导师…');

    await act(async()=>{root.render(null);});
    await act(async()=>{root.render(createElement(DeferredTutorPanel,{...props,compact:false,draft:'主栏草稿'}));});
    expect(container.querySelector<HTMLTextAreaElement>('.tutor-composer textarea')?.value).toBe('主栏草稿');
    expect(loading.requested).toHaveBeenCalledTimes(1);
    expect(props.onMessages).not.toHaveBeenCalled();
  }finally{
    await act(async()=>{root.unmount();});
    container.remove();
    delete (Element.prototype as Partial<Element>).scrollIntoView;
    vi.unstubAllGlobals();
  }
});
