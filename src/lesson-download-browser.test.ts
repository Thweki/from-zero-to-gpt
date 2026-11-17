// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createLessonDownload,saveLessonDownload} from './lesson-download';
import {lessonById} from './data/lessons';
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {LessonDownload} from './components/LessonDownload';

describe('local lesson download lifecycle',()=>{
  beforeEach(()=>{
    vi.useFakeTimers();
    vi.stubGlobal('URL',{createObjectURL:vi.fn(()=> 'blob:lesson-download'),revokeObjectURL:vi.fn()});
  });
  afterEach(()=>{
    vi.runAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('downloads a UTF-8 Markdown Blob and releases the attached link and URL',()=>{
    const file=createLessonDownload(lessonById.functions);
    const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){
      expect(this.isConnected).toBe(true);
      expect(this.download).toBe(file.filename);
      expect(this.href).toBe('blob:lesson-download');
    });
    saveLessonDownload(file);
    expect(click).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({type:file.mimeType}));
    expect(document.querySelector('a[download]')).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:lesson-download');
  });

  it('cleans up resources and propagates browser download failures to the UI',()=>{
    vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{throw new Error('Download unavailable');});
    expect(()=>saveLessonDownload(createLessonDownload(lessonById.functions))).toThrow('Download unavailable');
    expect(document.querySelector('a[download]')).toBeNull();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:lesson-download');
  });
});

describe('lesson download controls',()=>{
  let root:Root;
  let container:HTMLDivElement;
  let blobs:Blob[];
  beforeEach(()=>{
    vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
    blobs=[];
    vi.stubGlobal('URL',{createObjectURL:vi.fn((blob:Blob)=>{blobs.push(blob);return 'blob:lesson';}),revokeObjectURL:vi.fn()});
    vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
    container=document.createElement('div');
    document.body.append(container);
    root=createRoot(container);
  });
  afterEach(()=>{
    act(()=>root.unmount());
    container.remove();
    vi.runAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const render=(id:'functions'|'linear',note:string)=>act(()=>root.render(createElement(LessonDownload,{key:id,lesson:lessonById[id],note})));
  const click=(selector:string)=>act(()=>container.querySelector<HTMLElement>(selector)!.click());
  const readBlob=(blob:Blob)=>new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result));
    reader.onerror=()=>reject(reader.error);
    reader.readAsText(blob);
  });

  it('omits notes by default, exports live edits on opt-in, and resets on chapter change',async()=>{
    render('functions','最初的笔记');
    expect(container.querySelector('input')!.checked).toBe(false);
    click('button');
    expect(await readBlob(blobs[0])).not.toContain('最初的笔记');
    click('input');
    render('functions','最新的笔记 🧠');
    click('button');
    expect(await readBlob(blobs[1])).toContain('最新的笔记 🧠');
    expect(container.querySelector('[role=status]')!.textContent).toContain('已发起下载');
    render('linear','另一个章节的笔记');
    expect(container.querySelector('input')!.checked).toBe(false);
    click('button');
    const next=await readBlob(blobs[2]);
    expect(next).toContain('# 01.02 线性函数与参数');
    expect(next).not.toContain('## 我的本章笔记');
    expect(next).not.toContain('最新的笔记');
  });

  it('announces failure and permits a successful retry',()=>{
    render('functions','');
    vi.mocked(URL.createObjectURL).mockImplementationOnce(()=>{throw new Error('Unavailable');});
    click('button');
    expect(container.querySelector('[role=status]')!.textContent).toContain('下载未能开始');
    click('button');
    expect(container.querySelector('[role=status]')!.textContent).toContain('已发起下载');
  });
});
