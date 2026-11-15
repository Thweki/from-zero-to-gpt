import {lessons} from './data/lessons';
import type {LearningState, Lesson, ViewMode} from './types';
import type {LessonSection} from './components/LessonNavigation';

export const activityLabels: Record<LessonSection, string> = {
  reading: '阅读未记录', experiment: '实验未记录', quiz: '自测待验证', code: '代码待验收（可选）',
};

export function activitySection(value?: string): LessonSection | undefined {
  return value && Object.hasOwn(activityLabels, value) ? value as LessonSection : undefined;
}

export const activityMode = (section: LessonSection): ViewMode => section === 'code' ? 'code' : 'intuition';

// Derive the inbox from existing evidence, never from mastery or a second checklist.
export function unfinishedActivities(progress: LearningState['progress'], course: readonly Lesson[] = lessons) {
  return course.flatMap(lesson => {
    const saved = progress[lesson.id];
    if (!saved || !(saved.status !== 'new' || saved.lastVisited || saved.readCompleted ||
      saved.experimented || saved.quizAnswer !== undefined || saved.quizPassed || saved.lastRun || saved.codePassed)) return [];
    const sections: LessonSection[] = [];
    if (!saved.readCompleted) sections.push('reading');
    if (!saved.experimented) sections.push('experiment');
    if (!saved.quizPassed) sections.push('quiz');
    if (!saved.codePassed) sections.push('code');
    return sections.length ? [{lesson, sections}] : [];
  });
}
