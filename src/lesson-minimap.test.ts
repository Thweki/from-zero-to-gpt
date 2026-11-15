import {describe,expect,it} from 'vitest';
import {readingMap} from './lesson-minimap';

describe('spatial reading minimap',()=>{
  const bounds=[{top:100,bottom:180},{top:200,bottom:500},{top:500,bottom:900}];
  it('uses actual section lengths, including the gap before the next heading',()=>{
    const map=readingMap(bounds,{top:300,bottom:700})!;
    expect(map.sections).toEqual([{start:0,end:.125},{start:.125,end:.5},{start:.5,end:1}]);
    expect(map.visible).toEqual({start:.25,end:.75});
    expect(map.current).toBe(1);
  });
  it('clips the visible window to prose and keeps the current section at exact boundaries',()=>{
    expect(readingMap(bounds,{top:0,bottom:300})?.visible).toEqual({start:0,end:.25});
    expect(readingMap(bounds,{top:500,bottom:1200})?.visible).toEqual({start:.5,end:1});
    expect(readingMap(bounds,{top:500,bottom:1200})?.current).toBe(2);
  });
  it('does not show a reading window or current section in the lab or above the prose',()=>{
    for(const viewport of [{top:900,bottom:1300},{top:-400,bottom:100},{top:500,bottom:500}]){
      expect(readingMap(bounds,viewport)).toMatchObject({visible:null,current:-1});
    }
  });
  it('handles empty, unlaid-out, and single-section modes',()=>{
    expect(readingMap([],{top:0,bottom:500})).toBeNull();
    expect(readingMap([{top:0,bottom:0}],{top:0,bottom:500})).toBeNull();
    expect(readingMap([{top:100,bottom:200}],{top:0,bottom:500})).toEqual({sections:[{start:0,end:1}],visible:{start:0,end:1},current:0});
  });
  it('updates proportions when layout changes and moves backwards on upward scroll',()=>{
    expect(readingMap(bounds,{top:600,bottom:800})?.current).toBe(2);
    expect(readingMap(bounds,{top:150,bottom:350})?.current).toBe(0);
    expect(readingMap([{top:100,bottom:200},{top:200,bottom:300}],{top:150,bottom:250})?.sections[0].end).toBe(.5);
  });
});
