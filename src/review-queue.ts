import { lessonIds } from './data/lesson-ids';
import type { LearningState, LessonProgress, ReviewSchedule } from './types';

const intervals = [1, 3, 7, 14, 30];
export type ReviewRating = 'again' | 'remembered';

// A note or bookmark alone does not enroll an unseen chapter.
export function hasSeenLesson(progress?: LessonProgress): boolean {
  return !!progress && (progress.status !== 'new' || !!progress.lastVisited);
}

export function reviewQueue(state: LearningState, now: number) {
  if (state.reviewQueueEnabled !== true) return [];
  return lessonIds.filter(id => hasSeenLesson(state.progress[id]))
    .map(id => ({ id, due: state.progress[id]?.reviewSchedule ? Date.parse(state.progress[id]!.reviewSchedule!.dueAt) : 0 }))
    .filter(entry => entry.due <= now)
    .sort((a, b) => a.due - b.due);
}

export function scheduleReview(previous: ReviewSchedule | undefined, rating: ReviewRating, now: number): ReviewSchedule {
  const step = rating === 'again' ? 0 : Math.min((previous?.step ?? 0) + 1, intervals.length);
  const delay = step === 0 ? 10 * 60_000 : intervals[step - 1] * 86_400_000;
  return { step, dueAt: new Date(now + delay).toISOString() };
}

export function validateReviewSchedule(value: unknown): ReviewSchedule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('间隔复习计划无效');
  const { step, dueAt } = value as Record<string, unknown>;
  if (!Number.isInteger(step) || Number(step) < 0 || Number(step) > intervals.length || typeof dueAt !== 'string' || !Number.isFinite(Date.parse(dueAt))) throw new Error('间隔复习计划无效');
  return { step: step as number, dueAt };
}
