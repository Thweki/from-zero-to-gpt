// @vitest-environment jsdom
import {act,createElement,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {LessonPrint} from './components/LessonPrint';
import {lessonById} from './data/lessons';

let root:Root,host:HTMLDivElement,origin:HTMLButtonElement;
let ready:()=>void;
beforeEach(()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  host=document.createElement('div');origin=document.createElement('button');
  document.body.append(origin,host);origin.focus();root=createRoot(host);
  Object.defineProperty(document,'fonts',{configurable:true,value:{ready:new Promise<void>(resolve=>{ready=resolve;})}});
  // jsdom has no native modal/printing implementation. Browser behavior is covered in Playwright.
  Object.defineProperties(HTMLDialogElement.prototype,{
    showModal:{configurable:true,value:vi.fn(function(this:HTMLDialogElement){this.open=true;})},
    close:{configurable:true,value:vi.fn(function(this:HTMLDialogElement){this.open=false;})},
  });
  vi.spyOn(window,'print').mockImplementation(()=>{});
});
afterEach(()=>{
  act(()=>root.unmount());host.remove();origin.remove();vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLDialogElement.prototype,'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype,'close');
  delete (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT;
});

function mount(onClose=vi.fn()){
  act(()=>root.render(createElement(StrictMode,null,createElement(LessonPrint,{lesson:lessonById.functions,stage:1,onClose}))));
  return document.querySelector('dialog')!;
}

describe('chapter print preview interactions',()=>{
  it('waits for fonts, prints without dismissing, and toggles answers locally',async()=>{
    const onClose=vi.fn(),dialog=mount(onClose);
    const print=dialog.querySelectorAll('button')[1];
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(dialog.querySelector('button'));
    expect(document.body.classList.contains('lesson-print-open')).toBe(true);
    expect(print.disabled).toBe(true);
    expect(dialog.querySelector('.handout-answers')).toBeNull();
    act(()=>dialog.querySelector('input')!.click());
    expect(dialog.querySelector('.handout-answers')).not.toBeNull();
    act(()=>dialog.querySelector('input')!.click());
    expect(dialog.querySelector('.handout-answers')).toBeNull();
    await act(async()=>ready());
    expect(print.disabled).toBe(false);
    act(()=>print.click());
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.open).toBe(true);
  });

  it('Escape and return request closure; unmount removes portal and scroll lock',async()=>{
    const onClose=vi.fn(),dialog=mount(onClose);
    await act(async()=>ready());
    const cancel=new Event('cancel',{cancelable:true});
    act(()=>dialog.dispatchEvent(cancel));
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    act(()=>dialog.querySelector('button')!.click());
    expect(onClose).toHaveBeenCalledTimes(2);
    act(()=>root.render(null));
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.body.classList.contains('lesson-print-open')).toBe(false);
    expect(document.activeElement).toBe(origin);
  });

  it('handles unavailable printing without closing the preview',async()=>{
    const onClose=vi.fn(),dialog=mount(onClose);
    await act(async()=>ready());
    vi.mocked(window.print).mockImplementation(()=>{throw new Error('Unavailable');});
    act(()=>dialog.querySelectorAll('button')[1].click());
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('请在浏览器中打开本章后重试');
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.open).toBe(true);
  });
});
