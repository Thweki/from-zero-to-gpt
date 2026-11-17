// @vitest-environment jsdom
import {Blob as NodeBlob} from 'node:buffer';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {lessons,lessonById} from './data/lessons';
import {createNoteExport,downloadNote} from './note-export';

describe('personal note Markdown',()=>{
  it.each(['',' ','\n\t\r\n','　'])('does not export blank notes %j',note=>{
    expect(createNoteExport(lessonById.functions,note)).toBeNull();
  });
  it('identifies the chapter and preserves Unicode, whitespace, math, and code exactly',()=>{
    const note='  我的理解 🧠\n\n## 例子\n\n$x^2$\n\n```python\n    print(2 ** 2)\n```\n\n';
    const file=createNoteExport(lessonById.functions,note)!;
    expect(file.filename).toBe('from-zero-to-gpt-01.01-functions-notes.md');
    expect(file.markdown).toBe(`# 01.01 函数是什么 · 我的笔记\n\n从零到 GPT · 章节：functions\n\n---\n\n${note}`);
    expect(file.markdown).not.toContain(lessonById.functions.starter);
    expect(file.markdown).not.toContain(lessonById.functions.problem);
  });
  it('adds a final newline without trimming the note',()=>{
    expect(createNoteExport(lessonById.linear,'\n想法  ')!.markdown).toMatch(/\n想法  \n$/);
  });
  it('uses unique portable filenames for every curriculum chapter',()=>{
    const filenames=lessons.map(lesson=>createNoteExport(lesson,'笔记')!.filename);
    expect(new Set(filenames).size).toBe(lessons.length);
    for(const filename of filenames)expect(filename).toMatch(/^from-zero-to-gpt-[\d.]+-[a-z0-9-]+-notes\.md$/);
  });
  it('preserves a note at the supported length limit',()=>{
    const note='学'.repeat(100000);
    expect(createNoteExport(lessonById.functions,note)!.markdown.endsWith(`${note}\n`)).toBe(true);
  });
});

describe('local note download',()=>{
  const createURL=vi.fn((_blob:Blob)=> 'blob:note-export');
  const revokeURL=vi.fn();
  beforeEach(()=>{
    vi.useFakeTimers();
    vi.stubGlobal('Blob',NodeBlob);
    vi.stubGlobal('URL',{createObjectURL:createURL,revokeObjectURL:revokeURL});
  });
  afterEach(()=>{
    vi.runAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });
  it('downloads UTF-8 Markdown and releases the attached link and URL',async()=>{
    const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){
      expect(this.isConnected).toBe(true);
      expect(this.download).toBe('from-zero-to-gpt-01.01-functions-notes.md');
      expect(this.href).toBe('blob:note-export');
    });
    expect(downloadNote(lessonById.functions,'我的理解')).toBe(true);
    expect(click).toHaveBeenCalledOnce();
    const blob=createURL.mock.calls[0]![0] as unknown as NodeBlob;
    expect(blob.type).toBe('text/markdown;charset=utf-8');
    expect(await blob.text()).toBe(createNoteExport(lessonById.functions,'我的理解')!.markdown);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeURL).toHaveBeenCalledExactlyOnceWith('blob:note-export');
  });
  it('creates no download for whitespace-only notes',()=>{
    expect(downloadNote(lessonById.functions,' \n')).toBe(false);
    expect(createURL).not.toHaveBeenCalled();
  });
  it('cleans up and propagates a download failure to the caller',()=>{
    vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{throw new Error('download failed');});
    expect(()=>downloadNote(lessonById.functions,'保留我的笔记')).toThrow('download failed');
    expect(document.querySelector('a[download]')).toBeNull();
    vi.runAllTimers();
    expect(revokeURL).toHaveBeenCalledExactlyOnceWith('blob:note-export');
  });
});
