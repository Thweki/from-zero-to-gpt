import type {Lesson} from './types';
import {lessonById} from './data/lessons';

function fenced(content:string,language:string){
  // A longer fence preserves literal code and notes even when they contain Markdown.
  const length=Math.max(3,...Array.from(content.matchAll(/`+/g),match=>match[0].length+1));
  const fence='`'.repeat(length);
  return `${fence}${language}\n${content}${content.endsWith('\n')?'':'\n'}${fence}`;
}

export function createLessonDownload(lesson:Lesson,note?:string){
  const blocks=[
    `# ${lesson.number} ${lesson.title}`,
    lesson.english,
    lesson.subtitle,
    '从零到 GPT · 本章教材\n\n包含四种阅读模式、练习与参考答案。交互实验需在应用中运行。',
    '## 先修知识',
    lesson.prerequisites.length?lesson.prerequisites.map(id=>`- ${lessonById[id].number} ${lessonById[id].title}`).join('\n'):'无需额外先修知识。',
    '## 学习目标',
    lesson.goals.map(goal=>`- ${goal}`).join('\n'),
    '## 这个概念解决什么问题？',
    lesson.problem,
  ];
  const sections=(heading:string,items:Lesson['math'],withFormulas=false)=>{
    blocks.push(`## ${heading}`);
    const shown=new Set<string>();
    const formula=(value:string)=>{
      const trimmed=value.trim();
      if(!trimmed||shown.has(trimmed))return;
      shown.add(trimmed);
      blocks.push(`$$\n${trimmed}\n$$`);
      if(trimmed===lesson.formula.trim())blocks.push(lesson.formulaCaption);
    };
    for(const section of items){
      blocks.push(`### ${section.title}`,...section.paragraphs);
      if(withFormulas&&section.formula)formula(section.formula);
    }
    if(withFormulas)formula(lesson.formula);
  };
  sections('直觉理解',lesson.intuition);
  blocks.push('## 交互实验任务',lesson.labTask);
  sections('数学推导',lesson.math,true);
  blocks.push(
    '## 代码实现',
    `运行环境：${lesson.runtime==='local-python'?'本地 Python（依赖与运行步骤请参阅应用内本章工程说明）':'浏览器 Python（Pyodide）'}`,
    '### 本章编程任务',lesson.exercise,
    '### 起始代码',fenced(lesson.starter,'python'),
    '### 验收测试',fenced(lesson.pythonTests,'python'),
    '### 参考实现（先尝试，再查看）',fenced(lesson.reference,'python'),
    lesson.codeExplanation,
  );
  sections('深入研究',lesson.deep);
  blocks.push(
    '## 容易混淆的地方',...lesson.misconceptions,
    '## 理解检查',lesson.quiz.question,
    lesson.quiz.options.map((option,i)=>`${String.fromCharCode(65+i)}. ${option}`).join('\n\n'),
    '### 提示',lesson.quiz.hint,
    '### 参考答案（先思考，再查看）',
    `答案：${String.fromCharCode(65+lesson.quiz.correct)}`,lesson.quiz.explanation,
    '## 延伸阅读',
    ...lesson.references.map(reference=>`### ${reference.title}\n\n<${reference.url}>\n\n${reference.note}`),
  );
  if(note?.trim())blocks.push('## 我的本章笔记',fenced(note,'text'));
  return {
    filename:`from-zero-to-gpt-${lesson.number}-${lesson.id}.md`,
    mimeType:'text/markdown;charset=utf-8',
    content:blocks.join('\n\n')+'\n',
  };
}

export function saveLessonDownload(file:ReturnType<typeof createLessonDownload>){
  const url=URL.createObjectURL(new Blob([file.content],{type:file.mimeType}));
  const link=document.createElement('a');
  try{
    link.href=url;
    link.download=file.filename;
    document.body.append(link);
    link.click();
  }finally{
    link.remove();
    // Give the browser time to consume the URL before releasing its backing Blob.
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
