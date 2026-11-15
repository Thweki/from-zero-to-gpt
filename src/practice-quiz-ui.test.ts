// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {PracticeQuiz} from './components/PracticeQuiz';
import {LessonReader} from './components/LessonReader';
import {lessonById} from './data/lessons';
import {practiceLessons} from './practice-quiz';
import {emptyProgress} from './storage';
import type {Lesson,LessonProgress} from './types';

vi.mock('./components/LessonLab',()=>({LessonLab:()=>null}));
vi.mock('./components/CodeLab',()=>({CodeLab:()=>null}));
let container:HTMLDivElement,root:Root;
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(()=>{
  act(()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();
});
const render=(lesson=lessonById.linear,navigate=vi.fn())=>act(()=>root.render(createElement(PracticeQuiz,{lesson,navigate})));
const quiz=()=>container.querySelector('.practice-quiz')!;
function click(text:string){
  const button=Array.from(quiz().querySelectorAll('button')).find(node=>node.textContent?.includes(text));
  expect(button,`button: ${text}`).toBeDefined();act(()=>button!.click());
}
function answer(lesson:Lesson,choice=lesson.quiz.correct){
  const input=quiz().querySelector<HTMLInputElement>(`input[name="practice-${lesson.id}"][value="${choice}"]`)!;
  act(()=>input.click());
}
function complete(lesson=lessonById.linear){
  click('开始小测');practiceLessons(lesson).forEach(question=>answer(question));click('提交本轮');
}

describe('practice interaction and isolation',()=>{
  it('withholds explanations until all questions are submitted and focuses the result heading',()=>{
    render();click('开始小测');
    expect(document.activeElement).toBe(quiz().querySelector('h2'));
    const submit=quiz().querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(true);
    const questions=practiceLessons(lessonById.linear);
    questions.forEach((lesson,i)=>{
      expect(quiz().textContent).not.toContain(lesson.quiz.explanation);
      answer(lesson);
      expect(submit.disabled).toBe(i!==questions.length-1);
    });
    expect(quiz().querySelectorAll('fieldset')).toHaveLength(questions.length);
    click('提交本轮');
    expect(quiz().textContent).toContain(`本轮答对 ${questions.length} / ${questions.length}`);
    expect(quiz().querySelectorAll('.practice-result')).toHaveLength(questions.length);
    expect(quiz().querySelectorAll('input')).toHaveLength(0);
    expect(document.activeElement?.textContent).toBe('本轮结果');
    expect(quiz().textContent).not.toContain('只重做错题');
  });
  it('retries only missed questions with fresh answers, then can restart the whole round',()=>{
    render();click('开始小测');
    const current=lessonById.linear;
    practiceLessons(current).forEach(lesson=>answer(lesson,lesson.id===current.id?(lesson.quiz.correct+1)%4:lesson.quiz.correct));
    click('提交本轮');click('只重做错题');
    expect(quiz().querySelectorAll('fieldset')).toHaveLength(1);
    expect(quiz().querySelectorAll('input:checked')).toHaveLength(0);
    expect(quiz().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    answer(current);click('提交本轮');
    expect(quiz().textContent).toContain('本轮答对 1 / 1');
    click('重新开始全部题目');
    expect(quiz().querySelectorAll('fieldset')).toHaveLength(practiceLessons(current).length);
    expect(quiz().querySelectorAll('input:checked')).toHaveLength(0);
  });
  it('clears abandoned answers on exit and on lesson changes',()=>{
    render();click('开始小测');answer(lessonById.linear);
    click('结束并清除');click('开始小测');
    expect(quiz().querySelectorAll('input:checked')).toHaveLength(0);
    answer(lessonById.linear);render(lessonById.functions);
    expect(quiz().querySelectorAll('input')).toHaveLength(0);
    click('开始小测');expect(quiz().querySelectorAll('input:checked')).toHaveLength(0);
    act(()=>root.unmount());root=createRoot(container);render();
    expect(quiz().querySelectorAll('input')).toHaveLength(0);
  });
  it('navigates to a prerequisite only on explicit review',()=>{
    const navigate=vi.fn();render(lessonById.linear,navigate);complete();
    expect(navigate).not.toHaveBeenCalled();
    const prerequisite=practiceLessons(lessonById.linear)[1];
    click(`回看 ${prerequisite.title}`);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(prerequisite.id);
  });
  it('downloads only after the learner requests it and releases the download URL',async()=>{
    vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
    let exported:Blob|undefined;
    const create=vi.fn((blob:Blob)=>{exported=blob;return 'blob:practice';});
    const revoke=vi.fn();vi.stubGlobal('URL',class extends URL {static createObjectURL=create;static revokeObjectURL=revoke;});
    const download=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
    render();complete();expect(create).not.toHaveBeenCalled();
    click('下载本轮');expect(create).toHaveBeenCalledTimes(1);expect(download).toHaveBeenCalledTimes(1);
    expect(exported?.type).toBe('application/json');
    const text=await new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.readAsText(exported!);});
    expect(JSON.parse(text)).toMatchObject({format:'from-zero-to-gpt-practice',lessonId:'linear',total:practiceLessons(lessonById.linear).length});
    expect(container.querySelector('a[download]')).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);expect(revoke).toHaveBeenCalledWith('blob:practice');
  });
  it('retains results and reports a failed download truthfully',()=>{
    vi.stubGlobal('URL',class extends URL {static createObjectURL=vi.fn(()=>{throw new Error('unavailable');});});
    render();complete();click('下载本轮');
    expect(quiz().textContent).toContain('无法下载结果');
    expect(quiz().querySelectorAll('.practice-result')).toHaveLength(practiceLessons(lessonById.linear).length);
  });
  it('integrates into the reader without touching saved evidence, and survives a mode change',()=>{
    const lesson=lessonById.linear,patch=vi.fn(),navigate=vi.fn();
    const progress:LessonProgress={...emptyProgress(),mode:'math',quizAnswer:lesson.quiz.correct,quizPassed:true,status:'mastered',note:'keep my note',code:'keep my code'};
    const original=JSON.stringify(progress);
    const reader=(mode:LessonProgress['mode'])=>act(()=>root.render(createElement(LessonReader,{lesson,progress:{...progress,mode},stage:1,patch,navigate,onCheckpoint:vi.fn(),onObserve:vi.fn()})));
    reader('math');click('开始小测');answer(lesson,(lesson.quiz.correct+1)%4);
    reader('deep');expect(quiz().querySelectorAll('input:checked')).toHaveLength(1);
    practiceLessons(lesson).slice(1).forEach(question=>answer(question));click('提交本轮');
    expect(patch).not.toHaveBeenCalled();expect(navigate).not.toHaveBeenCalled();
    expect(JSON.stringify(progress)).toBe(original);
    expect(container.querySelector('.learning-evidence')?.textContent).toContain('已验证');
    expect(container.querySelector('.learning-evidence')?.textContent).toContain('自评已掌握');
    expect(quiz().getAttribute('aria-label')).toBe('随堂小测');
  });
});
