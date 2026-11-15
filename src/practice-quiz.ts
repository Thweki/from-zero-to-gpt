import {lessonById} from './data/lessons';
import type {Lesson,LessonId} from './types';

export type PracticeAnswers = Partial<Record<LessonId,number>>;
export type PracticeResult = {lesson:Lesson;answer:number;correct:boolean};

// Reuse the authored question bank without inventing questions or extending the curriculum.
export function practiceLessons(lesson:Lesson):Lesson[] {
  return [...new Set([lesson.id,...lesson.prerequisites])].slice(0,4).map(id=>lessonById[id]);
}

export function gradePractice(questions:Lesson[],answers:PracticeAnswers):PracticeResult[]|null {
  if(!questions.length||questions.some(lesson=>{
    const answer=answers[lesson.id];
    return answer===undefined||!Number.isInteger(answer)||answer<0||answer>=lesson.quiz.options.length;
  }))return null;
  return questions.map(lesson=>({lesson,answer:answers[lesson.id]!,correct:answers[lesson.id]===lesson.quiz.correct}));
}

export function practiceReport(lesson:Lesson,results:PracticeResult[],completedAt:string) {
  return {
    format:'from-zero-to-gpt-practice',version:1,lessonId:lesson.id,completedAt,
    score:results.filter(result=>result.correct).length,total:results.length,
    questions:results.map(({lesson:source,answer,correct})=>({
      lessonId:source.id,title:source.title,question:source.quiz.question,
      selectedAnswer:source.quiz.options[answer],correctAnswer:source.quiz.options[source.quiz.correct],
      correct,explanation:source.quiz.explanation,
    })),
  };
}
