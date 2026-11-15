// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {captureReadingPosition,readReadingPosition,restoreReadingPosition,writeReadingPosition} from './reading-position';

beforeEach(()=>{localStorage.clear();vi.stubGlobal('scrollY',0);vi.stubGlobal('scrollTo',vi.fn());});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();document.body.innerHTML='';});

describe('device-local reading positions',()=>{
  it('round-trips a position independently for each lesson and view',()=>{
    expect(readReadingPosition('functions','intuition')).toBeNull();
    writeReadingPosition('functions','intuition',{anchor:'section-1',fraction:.4});
    writeReadingPosition('functions','math',{anchor:'section-2',fraction:.7});
    writeReadingPosition('linear','intuition',{anchor:'experiment',fraction:0});
    expect(readReadingPosition('functions','intuition')).toEqual({anchor:'section-1',fraction:.4});
    expect(readReadingPosition('functions','math')).toEqual({anchor:'section-2',fraction:.7});
    expect(readReadingPosition('linear','intuition')).toEqual({anchor:'experiment',fraction:0});
  });
  it.each(['{','null','[]','{"anchor":"section-1","fraction":-1}','{"anchor":"section-1","fraction":2}','{"anchor":"section-1","fraction":"0"}','{"anchor":"unknown","fraction":0}'])('ignores invalid stored data: %s',raw=>{
    localStorage.setItem('from-zero-to-gpt:reading:v1:functions:intuition',raw);
    expect(readReadingPosition('functions','intuition')).toBeNull();
  });
  it('tolerates blocked storage and quota failures',()=>{
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked');});
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('full');});
    expect(readReadingPosition('functions','math')).toBeNull();
    expect(()=>writeReadingPosition('functions','math',{anchor:'top',fraction:0})).not.toThrow();
  });
});

function article(){
  document.body.innerHTML='<article><div id="lesson-mode-panel" style="scroll-margin-top:120px" data-reading-anchor="panel"><section data-reading-anchor="section-0"></section><section data-reading-anchor="section-1"></section></div></article>';
  const root=document.querySelector('article')!;
  const anchors=root.querySelectorAll<HTMLElement>('[data-reading-anchor]');
  for(const [i,element] of Array.from(anchors).entries())vi.spyOn(element,'getBoundingClientRect').mockReturnValue({top:[-400,-400,20][i],height:[1200,400,500][i]} as DOMRect);
  return root;
}

describe('section-relative positioning',()=>{
  it('captures the section under the sticky tools and its fractional offset',()=>{
    const root=article();vi.stubGlobal('scrollY',700);
    expect(captureReadingPosition(root)).toEqual({anchor:'section-1',fraction:.2});
  });
  it('preserves a deliberate return to the top',()=>{
    expect(captureReadingPosition(article())).toEqual({anchor:'top',fraction:0});
    restoreReadingPosition(article(),{anchor:'top',fraction:0});
    expect(scrollTo).toHaveBeenCalledWith({top:0,behavior:'instant'});
  });
  it('restores using the current layout instead of stale document pixels',()=>{
    const root=article();vi.stubGlobal('scrollY',200);
    vi.spyOn(root.querySelector('[data-reading-anchor="section-1"]')!,'getBoundingClientRect').mockReturnValue({top:600,height:1000} as DOMRect);
    restoreReadingPosition(root,{anchor:'section-1',fraction:.2});
    expect(scrollTo).toHaveBeenCalledWith({top:880,behavior:'instant'});
  });
  it('does not jump when an old section has been removed',()=>{
    restoreReadingPosition(article(),{anchor:'section-99',fraction:.2});
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
