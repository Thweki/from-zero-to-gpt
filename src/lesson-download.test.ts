import {describe,expect,it} from 'vitest';
import {lessons,lessonById} from './data/lessons';
import {createLessonDownload} from './lesson-download';

describe('lesson Markdown downloads',()=>{
  it.each(lessons)('exports the complete authored lesson: $id',lesson=>{
    const file=createLessonDownload(lesson);
    expect(file.filename).toBe(`from-zero-to-gpt-${lesson.number}-${lesson.id}.md`);
    expect(file.mimeType).toBe('text/markdown;charset=utf-8');
    expect(file.content).toContain(`# ${lesson.number} ${lesson.title}`);
    for(const value of [lesson.english,lesson.subtitle,lesson.problem,lesson.labTask,lesson.exercise,lesson.codeExplanation,lesson.formulaCaption,...lesson.goals,...lesson.misconceptions])expect(file.content).toContain(value);
    for(const section of [...lesson.intuition,...lesson.math,...lesson.deep]){
      expect(file.content).toContain(`### ${section.title}`);
      for(const paragraph of section.paragraphs)expect(file.content).toContain(paragraph);
    }
    for(const formula of new Set([lesson.formula,...lesson.math.map(s=>s.formula)].filter(Boolean))){
      expect(file.content.split(`$$\n${formula!.trim()}\n$$`)).toHaveLength(2);
    }
    for(const code of [lesson.starter,lesson.reference,lesson.pythonTests])expect(file.content).toContain(code);
    expect(file.content).toContain(lesson.quiz.question);
    for(const [i,option] of lesson.quiz.options.entries())expect(file.content).toContain(`${String.fromCharCode(65+i)}. ${option}`);
    expect(file.content).toContain(`答案：${String.fromCharCode(65+lesson.quiz.correct)}`);
    expect(file.content).toContain(lesson.quiz.hint);
    expect(file.content).toContain(lesson.quiz.explanation);
    for(const reference of lesson.references){
      expect(file.content).toContain(reference.url);
      expect(file.content).toContain(reference.title);
      expect(file.content).toContain(reference.note);
    }
    for(const id of lesson.prerequisites)expect(file.content).toContain(lessonById[id].title);
    expect(file.content).not.toContain('## 我的本章笔记');
    expect(file.content).toContain('交互实验需在应用中运行');
    expect(file.content).toContain(lesson.runtime==='local-python'?'本地 Python':'浏览器 Python');
  });

  it('includes notes only when supplied, preserving Unicode, whitespace and Markdown literally',()=>{
    const note='  我的理解 🧠\n```\n# 笔记标题\n````\n<script>example</script>\n';
    const file=createLessonDownload(lessonById.functions,note);
    expect(file.content).toContain(`## 我的本章笔记\n\n\`\`\`\`\`text\n${note}\`\`\`\`\``);
    expect(createLessonDownload(lessonById.functions,' \n ').content).not.toContain('## 我的本章笔记');
  });

  it('keeps code containing backtick fences inside one Python block',()=>{
    const starter='example = """\n```\n````\n"""';
    const file=createLessonDownload({...lessonById.functions,starter});
    expect(file.content).toContain(`\`\`\`\`\`python\n${starter}\n\`\`\`\`\``);
  });
});
