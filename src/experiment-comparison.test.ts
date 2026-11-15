// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {MathLab} from './components/MathLab';
import {lessonById} from './data/lessons';
import type {LessonId} from './types';

let container:HTMLDivElement,root:Root;
beforeEach(()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(()=>{act(()=>root.unmount());container.remove();});
const onChange=vi.fn();
function render(id:LessonId,values:Record<string,number>={}){
  act(()=>root.render(createElement(MathLab,{lesson:lessonById[id],values,onChange})));
}
function click(label:string){
  const button=Array.from(container.querySelectorAll('button')).find(button=>button.textContent===label);
  expect(button,`Missing action: ${label}`).toBeTruthy();act(()=>button!.click());
}
function row(label:string){
  const tr=Array.from(container.querySelectorAll('tbody tr')).find(tr=>tr.querySelector('th')?.textContent===label);
  expect(tr,`Missing comparison row: ${label}`).toBeTruthy();
  return Array.from(tr!.querySelectorAll('td')).map(cell=>cell.textContent);
}

describe('experiment comparison in the real math lab',()=>{
  beforeEach(()=>onChange.mockClear());
  it('captures effective defaults, keeps the baseline frozen and restores the function choice and input',()=>{
    render('functions');expect(container.querySelector('table')).toBeNull();
    click('保存实验对照点');expect(onChange).not.toHaveBeenCalled();
    expect(row('函数的输出')).toEqual(['4','4','0']);
    render('functions',{kind:1,x:-3,k:99});
    expect(row('函数')).toEqual(['平方函数','一次函数','已改变']);
    expect(row('输入 x')).toEqual(['2','-3','-5']);
    expect(row('函数的输出')).toEqual(['4','-5','-9']);
    click('恢复对照参数');expect(onChange).toHaveBeenLastCalledWith({kind:0,x:2,k:99});
    render('functions',onChange.mock.lastCall![0]);
    expect(row('函数的输出')).toEqual(['4','4','0']);
  });
  it('compares linear outputs, can replace and clear a baseline, and returns keyboard focus',()=>{
    render('linear',{k:2,b:1,x:2});click('保存实验对照点');
    render('linear',{k:3,b:-1,x:2});
    expect(row('斜率 k')).toEqual(['2','3','+1']);
    expect(row('截距 b')).toEqual(['1','-1','-2']);
    expect(row('函数的输出')).toEqual(['5','5','0']);
    click('更新对照点');render('linear',{k:0,b:0,x:0});
    click('恢复对照参数');expect(onChange).toHaveBeenLastCalledWith({k:3,b:-1,x:2});
    click('清除对照点');expect(container.querySelector('table')).toBeNull();
    expect(document.activeElement?.textContent).toBe('保存实验对照点');
  });
  it('compares vector sums and lengths including zero vectors',()=>{
    render('vectors',{ax:0,ay:0,bx:0,by:0});click('保存实验对照点');
    render('vectors',{ax:3,ay:4,bx:-3,by:2});
    expect(row('向量和 x')).toEqual(['0','0','0']);
    expect(row('向量和 y')).toEqual(['0','6','+6']);
    expect(row('a 的长度')).toEqual(['0','5','+5']);
    click('恢复对照参数');expect(onChange).toHaveBeenLastCalledWith({ax:0,ay:0,bx:0,by:0});
  });
  it('compares dot products and discards the baseline on chapter changes',()=>{
    render('dot-product',{ax:1,ay:0,bx:1,by:0});click('保存实验对照点');
    render('dot-product',{ax:1,ay:0,bx:-1,by:0});
    expect(row('点积')).toEqual(['1','-1','-2']);
    render('functions');expect(container.querySelector('table')).toBeNull();
    render('dot-product');expect(container.querySelector('table')).toBeNull();
  });
  it('owns an immutable snapshot even if a caller mutates its parameter object',()=>{
    const values={x:1,kind:2};render('functions',values);click('保存实验对照点');
    values.x=-2;render('functions',values);
    expect(row('函数的输出')).toEqual(['1','2','+1']);
    click('恢复对照参数');expect(onChange).toHaveBeenLastCalledWith({x:1,kind:2});
  });
  it('keeps the baseline through experiment reset but clears it when the experiment closes',()=>{
    render('linear',{k:2,b:1,x:3});click('保存实验对照点');
    act(()=>container.querySelector<HTMLButtonElement>('[aria-label="重置实验参数"]')!.click());
    render('linear',onChange.mock.lastCall![0]);
    expect(row('函数的输出')).toEqual(['7','2','-5']);
    click('恢复对照参数');expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({k:2,b:1,x:3}));
    act(()=>root.render(null));render('linear');
    expect(container.querySelector('table')).toBeNull();
  });
});
