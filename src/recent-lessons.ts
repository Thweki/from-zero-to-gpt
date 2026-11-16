import {lessonIds} from './data/lesson-ids';
import type {LearningState} from './types';

// Use the course catalogue so stale or unknown IDs cannot produce broken links.
export function recentLessons(progress: LearningState['progress']) {
  return lessonIds.flatMap(id => {
    const lastVisited = progress[id]?.lastVisited;
    return lastVisited && Number.isFinite(Date.parse(lastVisited)) ? [{id, lastVisited}] : [];
  }).sort((a, b) => Date.parse(b.lastVisited) - Date.parse(a.lastVisited)).slice(0, 6);
}
