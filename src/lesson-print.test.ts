// @vitest-environment jsdom
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {lessons,lessonById} from './data/lessons';
import {LessonHandout} from './components/LessonPrint';

function handout(lesson=lessonById.functions,answers=false){
  const root=document.createElement('div');
  root.innerHTML=renderToStaticMarkup(createElement(LessonHandout,{lesson,stage:1,answers}));
  return root;
}

function readableText(element:Element|null){
  const clone=element?.cloneNode(true) as Element|undefined;
  clone?.querySelectorAll('[role="math"]').forEach(formula=>formula.replaceWith(formula.getAttribute('aria-label')||''));
  return clone?.textContent;
}

describe('read-only chapter handout',()=>{
  it.each(lessons)('$id includes every reading section, starter and reference with rendered math',lesson=>{
    const root=handout(lesson);
    expect(readableText(root.querySelector('h1'))).toBe(lesson.title);
    const headings=Array.from(root.querySelectorAll('h3'),readableText);
    for(const section of [...lesson.intuition,...lesson.math,...lesson.deep])expect(headings).toContain(section.title);
    const paragraphs=Array.from(root.querySelectorAll('p'),readableText);
    for(const section of [...lesson.intuition,...lesson.math,...lesson.deep]){
      for(const paragraph of section.paragraphs)expect(paragraphs).toContain(paragraph);
    }
    expect(root.querySelector('pre code')?.textContent).toBe(lesson.starter);
    expect(Array.from(root.querySelectorAll('a'),a=>a.href)).toEqual(lesson.references.map(reference=>reference.url));
    expect(Array.from(root.querySelectorAll('.handout-url'),url=>url.textContent)).toEqual(lesson.references.map(reference=>reference.url));
    expect(root.querySelectorAll('[role="math"]').length).toBeGreaterThan(0);
    expect(root.querySelector('.katex-error')).toBeNull();
    expect(root.querySelectorAll('input,textarea,button,iframe,script')).toHaveLength(0);
    expect(root.querySelector('.handout-answers')).toBeNull();
  });

  it('keeps answers and hints out until explicitly included',()=>{
    const lesson={...lessonById.functions,quiz:{...lessonById.functions.quiz,hint:'UNIQUE_HINT',explanation:'UNIQUE_EXPLANATION'}};
    expect(handout(lesson).textContent).not.toMatch(/UNIQUE_HINT|UNIQUE_EXPLANATION/);
    const answers=handout(lesson,true).querySelector('.handout-answers');
    expect(answers?.textContent).toContain(`答案：${String.fromCharCode(65+lesson.quiz.correct)}`);
    expect(answers?.textContent).toContain('UNIQUE_HINT');
    expect(answers?.textContent).toContain('UNIQUE_EXPLANATION');
  });

  it('escapes code and prose, and does not expose the reference implementation',()=>{
    const lesson={...lessonById.functions,title:'<img src=x onerror=alert(1)>',starter:'print("<script>alert(1)</script>")',reference:'PRIVATE_REFERENCE_MARKER'};
    const root=handout(lesson,true);
    expect(readableText(root.querySelector('h1'))).toBe(lesson.title);
    expect(root.querySelector('pre code')?.textContent).toBe(lesson.starter);
    expect(root.querySelector('img,script')).toBeNull();
    expect(root.textContent).not.toContain('PRIVATE_REFERENCE_MARKER');
  });
});
