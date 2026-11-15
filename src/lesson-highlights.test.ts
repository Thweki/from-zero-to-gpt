// @vitest-environment jsdom
import {afterEach,describe,expect,it} from 'vitest';
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import 'fake-indexeddb/auto';
import {addHighlight,captureHighlight,highlightAvailable,highlightLimit,highlightText,validateHighlights,type HighlightAnchor,type LessonHighlight} from './lesson-highlights';
import {HighlightParagraph,LessonHighlights} from './components/LessonHighlights';
import {emptyProgress,initialState,readState,validateImport,writeState} from './storage';
import {lessonById} from './data/lessons';

const anchor:HighlightAnchor={mode:'intuition',section:0,paragraph:0,source:'同一句，同一句，还有公式。',start:4,end:7};
const highlight:LessonHighlight={...anchor,id:'test-id'};
let root:Root|undefined;
afterEach(()=>{if(root)act(()=>root!.unmount());root=undefined;document.body.replaceChildren();});
function renderParagraph(text='前面的文字 $x^2$ 后面的文字',highlights:LessonHighlight[]=[]){
  (globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true;
  const host=document.createElement('article');host.className='lesson-page';document.body.append(host);root=createRoot(host);
  act(()=>root!.render(createElement(HighlightParagraph,{text,mode:'intuition',section:0,paragraph:0,highlights})));
  return host.querySelector('p')!;
}

describe('persistent passage highlights',()=>{
  it('round-trips through IndexedDB and JSON without changing other learning evidence',async()=>{
    const state=initialState();state.progress.functions={...emptyProgress(),highlights:[highlight],note:'我的笔记',code:'print(1)',review:true,quizPassed:true};
    expect(validateImport(JSON.parse(JSON.stringify(state)))).toEqual(state);
    await writeState(state);expect(await readState()).toEqual(state);
    const old=initialState();old.progress.functions=emptyProgress();expect(validateImport(old)).toEqual(old);
  });
  it.each([
    null,{},[null],[{...highlight,id:'<script>'}],[highlight,highlight],
    [{...highlight,mode:['math']}],[{...highlight,mode:'code'}],[{...highlight,section:-1}],
    [{...highlight,paragraph:1.5}],[{...highlight,start:-1}],[{...highlight,end:Infinity}],
    [{...highlight,end:99}],[{...highlight,start:7,end:4}],
    [{...highlight,source:'a'.repeat(10001)}],[{...highlight,source:' ',start:0,end:1}],
    Array.from({length:highlightLimit+1},(_,i)=>({...highlight,id:`id-${i}`})),
  ])('rejects malformed or excessive imported highlights',value=>{
    expect(()=>validateImport({...initialState(),progress:{functions:{...emptyProgress(),highlights:value}}})).toThrow();
  });
  it('keeps only known fields and rejects invalid additions at the same boundary',()=>{
    expect(validateHighlights([{...highlight,extra:'discard'}])).toEqual([highlight]);
    expect(()=>addHighlight([],{...anchor,end:999},'id')).toThrow();
  });
  it('merges repeated, overlapping and touching passages but keeps distinct occurrences and modes',()=>{
    const first={...highlight,start:0,end:3};
    const second={...highlight,id:'second',start:4,end:7};
    expect(addHighlight([first,second],{...anchor,start:2,end:5},'merged')).toEqual([{...highlight,id:'merged',start:0,end:7}]);
    expect(addHighlight([highlight],anchor,'again')).toHaveLength(1);
    expect(addHighlight([first],anchor,'separate')).toHaveLength(2);
    expect(addHighlight([highlight],{...anchor,mode:'math'},'math')).toHaveLength(2);
  });
  it('permits merging at capacity, but never silently evicts saved passages',()=>{
    const full=Array.from({length:highlightLimit},(_,i)=>({...highlight,id:`id-${i}`,paragraph:i}));
    expect(addHighlight(full,anchor,'merge')).toHaveLength(highlightLimit);
    expect(()=>addHighlight(full,{...anchor,paragraph:100},'new')).toThrow();
    expect(full).toHaveLength(highlightLimit);
  });
  it('uses the paragraph source to refuse stale or missing destinations',()=>{
    const source=highlightText(lessonById.functions.intuition[0].paragraphs[0]);
    expect(highlightAvailable(lessonById.functions,{...anchor,source})).toBe(true);
    expect(highlightAvailable(lessonById.functions,anchor)).toBe(false);
    expect(highlightAvailable(lessonById.functions,{...anchor,section:99})).toBe(false);
  });
});

describe('selection and rendering',()=>{
  it('captures a partial occurrence exactly, even when the same words appear twice',()=>{
    const p=renderParagraph(anchor.source);const node=p.querySelector('span')!.firstChild!;
    const range=document.createRange();range.setStart(node,4);range.setEnd(node,7);
    expect(captureHighlight(range)).toEqual(anchor);
  });
  it('renders only the saved occurrence and can recapture selections across existing marks',()=>{
    const p=renderParagraph(anchor.source,[highlight]);
    expect([...p.querySelectorAll('mark')].map(mark=>mark.textContent)).toEqual(['同一句']);
    expect(p.textContent).toBe(anchor.source);
    const range=document.createRange();range.selectNodeContents(p);
    expect(captureHighlight(range)).toEqual({...anchor,start:0,end:anchor.source.length});
  });
  it('maps selections across and inside formulas to one atomic source representation',()=>{
    const p=renderParagraph();const range=document.createRange();range.selectNodeContents(p);
    const selected=captureHighlight(range)!;
    expect(selected.source).toBe('前面的文字 x^2 后面的文字');
    expect(selected.end).toBe(selected.source.length);
    const math=p.querySelector('.katex-html .mord')!;
    range.selectNodeContents(math);
    const formula=captureHighlight(range)!;
    expect(formula.source.slice(formula.start,formula.end)).toBe('x^2');
  });
  it('does not capture neighboring text, cross-paragraph selections, empty ranges or non-lesson content',()=>{
    const p=renderParagraph();const next=document.createElement('p');next.textContent='下一段';p.after(next);
    const range=document.createRange();range.setStart(p,0);range.setEnd(next,1);
    expect(captureHighlight(range)).toBeNull();
    range.selectNodeContents(p);range.collapse();expect(captureHighlight(range)).toBeNull();
    range.selectNodeContents(next);expect(captureHighlight(range)).toBeNull();
    p.closest('article')!.className='';range.selectNodeContents(p);expect(captureHighlight(range)).toBeNull();
  });
  it('keeps formula rendering intact and ignores highlights from other modes or changed paragraphs',()=>{
    const text='前面的文字 $x^2$ 后面的文字';const source=highlightText(text);
    const p=renderParagraph(text,[{...highlight,source,start:0,end:source.length}]);
    expect(p.querySelectorAll('.katex')).toHaveLength(1);
    expect(p.querySelector('mark .katex')).not.toBeNull();
    act(()=>root!.render(createElement(HighlightParagraph,{text,mode:'math',section:0,paragraph:0,highlights:[highlight]})));
    expect(document.querySelector('mark')).toBeNull();
  });
  it('retains unavailable quotes, disables incorrect jumps and allows their removal',()=>{
    renderParagraph();let removed='';
    act(()=>root!.render(createElement(LessonHighlights,{lesson:lessonById.functions,highlights:[highlight],onJump:()=>{throw new Error('must not jump');},onRemove:id=>{removed=id;}})));
    expect(document.querySelector<HTMLButtonElement>('.highlight-jump')!.disabled).toBe(true);
    expect(document.body.textContent).toContain('原文已变更');
    act(()=>document.querySelector<HTMLButtonElement>('.highlight-remove')!.click());expect(removed).toBe(highlight.id);
  });
});
