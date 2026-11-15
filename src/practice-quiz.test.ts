import {describe,expect,it} from 'vitest';
import {lessons,lessonById} from './data/lessons';
import {gradePractice,practiceLessons,practiceReport} from './practice-quiz';

describe('bounded local practice rounds',()=>{
  it('uses only the current lesson and its direct prerequisites across the whole course',()=>{
    for(const lesson of lessons){
      const questions=practiceLessons(lesson);
      expect(questions[0]).toBe(lesson);
      expect(questions.length).toBeGreaterThan(0);
      expect(questions.length).toBeLessThanOrEqual(4);
      expect(new Set(questions.map(question=>question.id)).size).toBe(questions.length);
      expect(questions.slice(1).every(question=>lesson.prerequisites.includes(question.id))).toBe(true);
      const answers=Object.fromEntries(questions.map(question=>[question.id,question.quiz.correct]));
      expect(gradePractice(questions,answers)?.every(result=>result.correct)).toBe(true);
    }
  });
  it('supports an introductory lesson with no prerequisites and bounds duplicated input',()=>{
    expect(practiceLessons({...lessonById.functions,prerequisites:[]})).toEqual([lessonById.functions]);
    const prerequisites=lessons.slice(0,10).map(lesson=>lesson.id);
    expect(practiceLessons({...lessonById.functions,prerequisites:['functions',...prerequisites,...prerequisites]})).toHaveLength(4);
  });
  it.each([undefined,-1,4,0.5,NaN,Infinity])('refuses incomplete or invalid answers (%s)',answer=>{
    expect(gradePractice([lessonById.functions],{functions:answer})).toBeNull();
  });
  it('requires every question and treats option zero as a valid answer',()=>{
    expect(gradePractice([],{})).toBeNull();
    expect(gradePractice([lessonById.functions,lessonById.linear],{functions:0})).toBeNull();
    expect(gradePractice([lessonById.functions],{functions:0})).toEqual([
      {lesson:lessonById.functions,answer:0,correct:lessonById.functions.quiz.correct===0},
    ]);
  });
  it('grades exact choices without mutating the question bank or answers',()=>{
    const questions=practiceLessons(lessonById.linear);
    const answers=Object.fromEntries(questions.map((lesson,i)=>[lesson.id,(lesson.quiz.correct+(i===0?1:0))%lesson.quiz.options.length]));
    const original=JSON.stringify({questions,answers});
    const results=gradePractice(questions,answers)!;
    expect(results[0].correct).toBe(false);
    expect(results.slice(1).every(result=>result.correct)).toBe(true);
    expect(JSON.stringify({questions,answers})).toBe(original);
  });
  it('exports a self-contained report with a separate format and no learning data',()=>{
    const lesson=lessonById.linear;
    const results=gradePractice([lesson],{linear:lesson.quiz.correct})!;
    const report=practiceReport(lesson,results,'2026-11-15T12:00:00.000Z');
    expect(report).toEqual({
      format:'from-zero-to-gpt-practice',version:1,lessonId:'linear',completedAt:'2026-11-15T12:00:00.000Z',score:1,total:1,
      questions:[{lessonId:'linear',title:lesson.title,question:lesson.quiz.question,
        selectedAnswer:lesson.quiz.options[lesson.quiz.correct],correctAnswer:lesson.quiz.options[lesson.quiz.correct],
        correct:true,explanation:lesson.quiz.explanation}],
    });
    expect(report).not.toHaveProperty('progress');
    expect(report.questions[0]).not.toHaveProperty('starter');
  });
});
