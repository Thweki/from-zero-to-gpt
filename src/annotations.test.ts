import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {validateAnnotations,maxAnnotations,annotationTextLimit} from './annotations';
import {emptyProgress,initialState,readState,validateImport,writeState} from './storage';

const annotation={id:'annotation-1',mode:'math' as const,quote:'f(x) = x²',text:'负数也能得到正数。',createdAt:'2026-11-15T12:00:00.000Z'};

describe('local passage annotations',()=>{
  it('round-trips quotes and comments through IndexedDB and backup without overwriting learner work',async()=>{
    const state=initialState();
    state.progress.functions={...emptyProgress(),annotations:[annotation],note:'chapter note',code:'print(42)',review:true,quizPassed:true,observationDraft:'observation',tutorDraft:'question'};
    state.progress.linear={...emptyProgress(),annotations:[{...annotation,text:'another chapter'}]};
    await writeState(state);
    expect(await readState()).toEqual(state);
    expect(validateImport(JSON.parse(JSON.stringify(state)))).toEqual(state);
    state.progress.functions.annotations=[];
    await writeState(state);
    expect(await readState()).toEqual(state);
  });

  it('accepts older backups without annotations and preserves unfinished comments',()=>{
    const old=initialState();old.progress.functions=emptyProgress();
    expect(validateImport(old)).toEqual(old);
    expect(validateAnnotations([{...annotation,text:''}])).toEqual([{...annotation,text:''}]);
  });

  it('accepts the exact limits and strips unknown properties without interpreting user text',()=>{
    const full=Array.from({length:maxAnnotations},(_,i)=>({...annotation,id:`note-${i}`,quote:'a'.repeat(3000),text:'b'.repeat(annotationTextLimit)}));
    expect(validateAnnotations(full)).toEqual(full);
    expect(validateAnnotations([{...annotation,text:'<script>alert(1)</script>',extra:'ignored'}])).toEqual([{...annotation,text:'<script>alert(1)</script>'}]);
  });

  it.each([
    null,{},'note',[null],[[]],Array(maxAnnotations+1).fill(annotation),[annotation,annotation],
    [{...annotation,id:'../bad'}],[{...annotation,id:''}],[{...annotation,id:'a'.repeat(65)}],
    [{...annotation,mode:'code'}],[{...annotation,mode:['math']}],
    [{...annotation,quote:' '}],[{...annotation,quote:1}],[{...annotation,quote:'a'.repeat(3001)}],
    [{...annotation,text:null}],[{...annotation,text:'a'.repeat(annotationTextLimit+1)}],
    [{...annotation,createdAt:'yesterday'}],[{...annotation,createdAt:1}],
  ])('rejects malformed annotation data in backups (%#)',annotations=>{
    const state=initialState();state.progress.functions={...emptyProgress(),annotations} as never;
    expect(()=>validateImport(state)).toThrow('章节批注格式无效');
  });
});
