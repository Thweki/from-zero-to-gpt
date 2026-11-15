import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {lessons} from './data/lessons';
import {buildFlashcards, setFlashcardLesson} from './flashcards';
import {emptyProgress, initialState, readState, validateImport, writeState} from './storage';

describe('curriculum flashcards', () => {
  it('makes one card per existing intuition section across the whole course', () => {
    const cards = buildFlashcards(lessons.map(lesson => lesson.id));
    expect(cards.length).toBe(lessons.reduce((sum, lesson) => sum + lesson.intuition.length, 0));
    expect(new Set(cards.map(card => card.id)).size).toBe(cards.length);
    for (const lesson of lessons) {
      expect(lesson.intuition.length).toBeGreaterThan(0);
      expect(cards.filter(card => card.lessonId === lesson.id).map(card => ({title: card.title, paragraphs: card.paragraphs}))).toEqual(lesson.intuition);
    }
  });

  it('keeps deck order and does not duplicate cards when a chapter is added twice', () => {
    expect(buildFlashcards(['linear', 'functions', 'linear'])).toEqual(buildFlashcards(['linear', 'functions']));
    expect(buildFlashcards(['linear', 'functions'])[0].lessonId).toBe('linear');
    expect(buildFlashcards([])).toEqual([]);
  });

  it('adds and removes membership without changing any learning evidence', () => {
    const original = initialState();
    original.progress.functions = {...emptyProgress(), status: 'mastered', note: 'Keep this', code: 'print(42)', quizPassed: true, review: true, labValues: {x: 2}};
    const before = structuredClone(original);
    const added = setFlashcardLesson(original, 'functions', true);
    expect(added.flashcardLessons).toEqual(['functions']);
    expect(added.progress).toBe(original.progress);
    expect(added.lastLesson).toBe(original.lastLesson);
    expect(setFlashcardLesson(added, 'functions', true)).toBe(added);
    const removed = setFlashcardLesson(added, 'functions', false);
    expect(removed.flashcardLessons).toEqual([]);
    expect(removed.progress).toEqual(before.progress);
    expect(original).toEqual(before);
  });
});

describe('flashcard persistence and backups', () => {
  it('accepts old backups and round-trips empty and populated decks', () => {
    const old = initialState();
    expect(validateImport(old)).toEqual(old);
    for (const ids of [[], ['functions', 'linear']]) {
      const backup = {...old, flashcardLessons: ids};
      const restored = validateImport(JSON.parse(JSON.stringify(backup)));
      expect(restored).toEqual(backup);
      expect(restored.flashcardLessons).not.toBe(ids);
    }
  });

  it.each([null, {}, 'functions', Array(1), [null], [1], [['functions']], ['missing'], ['__proto__'], ['functions', 'functions'], Array(84).fill('functions')])('rejects malformed deck membership: %j', value => {
    expect(() => validateImport({...initialState(), flashcardLessons: value})).toThrow('闪卡章节格式无效');
  });

  it('retains deck membership through IndexedDB writes, reads and removal', async () => {
    const state = setFlashcardLesson(initialState(), 'functions', true);
    await writeState(state);
    expect(await readState()).toEqual(state);
    const removed = setFlashcardLesson(await readState(), 'functions', false);
    await writeState(removed);
    expect((await readState()).flashcardLessons).toEqual([]);
  });
});
