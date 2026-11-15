import {lessonById} from './data/lessons';
import type {LearningState, LessonId} from './types';

// Keep only deck membership in storage; answers always come from the curriculum.
export function buildFlashcards(ids: readonly LessonId[]) {
  return [...new Set(ids)].flatMap(lessonId => lessonById[lessonId].intuition.map((section, index) => ({
    id: `${lessonId}:${index}`,
    lessonId,
    title: section.title,
    paragraphs: section.paragraphs,
  })));
}

export function setFlashcardLesson(state: LearningState, id: LessonId, included: boolean): LearningState {
  const ids = state.flashcardLessons ?? [];
  if (ids.includes(id) === included) return state;
  return {...state, flashcardLessons: included ? [...ids, id] : ids.filter(item => item !== id), updatedAt: new Date().toISOString()};
}
