import { lessons } from './data/lessons';
import type { LearningState, Lesson } from './types';

export interface NoteMatch {
  lesson: Lesson;
  start: number;
  end: number;
  before: string;
  match: string;
  after: string;
}

/** Search only saved personal note text, in course order, without building a second store. */
export function searchNotes(progress: LearningState['progress'], query: string): NoteMatch[] {
  const text = query.trim();
  if (!text) return [];
  // Treat punctuation literally; RegExp indices stay aligned with the original textarea,
  // even for Unicode characters whose lowercase form has a different length.
  const pattern = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu');
  return lessons.flatMap(lesson => {
    const note = progress[lesson.id]?.note;
    if (!note?.trim()) return [];
    const found = pattern.exec(note);
    if (!found) return [];
    const start = found.index, end = start + found[0].length;
    const left = Math.max(0, start - 64), right = Math.min(note.length, end + 64);
    return [{
      lesson, start, end,
      before: (left ? '…' : '') + note.slice(left, start),
      match: note.slice(start, end),
      after: note.slice(end, right) + (right < note.length ? '…' : ''),
    }];
  });
}
