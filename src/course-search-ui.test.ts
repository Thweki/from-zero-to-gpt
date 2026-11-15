// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import App from './App';
import {emptyProgress,initialState,readState,writeState} from './storage';

vi.mock('./storage',async importOriginal=>({
  ...await importOriginal<typeof import('./storage')>(),readState:vi.fn(),writeState:vi.fn().mockResolvedValue(undefined),
}));
// Plot layout needs a browser; the actual search dialog and reader are rendered here.
vi.mock('./use-readable-plots',()=>({useReadablePlots:()=>{}}));
let root:Root;
let host:HTMLDivElement;
beforeEach(async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  const state=initialState();
  state.progress.linear={...emptyProgress(),mode:'math',note:'keep my note',code:'keep my code',review:true};
  vi.mocked(readState).mockResolvedValue(state);
  vi.mocked(writeState).mockResolvedValue(undefined);
  history.replaceState(null,'','/#/lesson/linear');
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async()=>{root.render(createElement(App));});
});
afterEach(async()=>{
  await act(async()=>root.unmount());host.remove();
  vi.restoreAllMocks();vi.unstubAllGlobals();
});
async function search(query:string){
  await act(async()=>host.querySelector<HTMLInputElement>('[aria-label="搜索知识点"]')!.click());
  const input=host.querySelector<HTMLInputElement>('[aria-label="搜索词"]')!;
  await act(async()=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,query);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
}

it('opens body matches in the correct mode, including the current chapter, without replacing learner work',async()=>{
  await search('线性函数 仿射映射');
  const results=host.querySelectorAll<HTMLButtonElement>('.search-results>button');
  expect(results).toHaveLength(1);
  expect(results[0].textContent).toContain('深入研究');
  expect(results[0].querySelector('.search-snippet')?.textContent).toContain('仿射映射');
  await act(async()=>results[0].click());
  expect(host.querySelector('.search-results')).toBeNull();
  expect(host.querySelector('#tab-deep')?.getAttribute('aria-selected')).toBe('true');
  expect(host.querySelector('#lesson-mode-panel')?.textContent).toContain('仿射映射');
  expect(vi.mocked(writeState).mock.lastCall?.[0].progress.linear).toMatchObject({mode:'deep',note:'keep my note',code:'keep my code',review:true});

  await search('陪域');
  const result=[...host.querySelectorAll<HTMLButtonElement>('.search-results>button')].find(button=>button.textContent?.includes('函数是什么'))!;
  expect(result).toBeDefined();
  await act(async()=>{result.click();});
  await act(async()=>{window.dispatchEvent(new HashChangeEvent('hashchange'));});
  expect(location.hash).toBe('#/lesson/functions');
  expect(host.querySelector('#tab-math')?.getAttribute('aria-selected')).toBe('true');
  expect(host.querySelector('#lesson-mode-panel')?.textContent).toContain('陪域');
});

it('shows no-result feedback and restores all chapters when cleared',async()=>{
  await search('不存在的搜索词');
  expect(host.querySelectorAll('.search-results>button')).toHaveLength(0);
  expect(host.querySelector('.search-count')?.textContent).toBe('找到 0 章');
  expect(host.querySelector('.empty-result')).not.toBeNull();
  await search('   ');
  expect(host.querySelectorAll('.search-results>button')).toHaveLength(83);
  expect(host.querySelector('.search-count')?.textContent).toBe('全部 83 章');
});
