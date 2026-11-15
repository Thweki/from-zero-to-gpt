import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { emptyProgress, initialState, readState, validateImport, writeState } from './storage';
import { hasSeenLesson, reviewQueue, scheduleReview } from './review-queue';

const now = Date.parse('2026-11-15T12:00:00.000Z');
const day = 86_400_000;

describe('experimental review scheduling', () => {
  it('defaults off, including old backups with existing progress', () => {
    const state = initialState();
    state.progress.functions = { ...emptyProgress(), status: 'mastered' };
    expect(validateImport(state)).toEqual(state);
    expect(reviewQueue(state, now)).toEqual([]);
    expect(reviewQueue({ ...state, reviewQueueEnabled: false }, now)).toEqual([]);
  });

  it('enrolls previously seen chapters, excludes unseen notes/bookmarks, and never mutates progress', () => {
    const state = initialState();
    state.reviewQueueEnabled = true;
    state.progress.functions = { ...emptyProgress(), lastVisited: new Date(now).toISOString() };
    state.progress.linear = { ...emptyProgress(), status: 'mastered' };
    state.progress.vectors = { ...emptyProgress(), review: true, note: 'read later' };
    const before = JSON.stringify(state);
    expect(reviewQueue(state, now).map(entry => entry.id)).toEqual(['functions', 'linear']);
    expect(hasSeenLesson(undefined)).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('orders due chapters by due time, includes the exact boundary, and excludes future reviews', () => {
    const state = initialState();
    state.reviewQueueEnabled = true;
    state.progress.functions = { ...emptyProgress(), status: 'learning', reviewSchedule: { step: 1, dueAt: new Date(now).toISOString() } };
    state.progress.linear = { ...emptyProgress(), status: 'learning', reviewSchedule: { step: 1, dueAt: new Date(now - day).toISOString() } };
    state.progress.vectors = { ...emptyProgress(), status: 'mastered', reviewSchedule: { step: 2, dueAt: new Date(now + 1).toISOString() } };
    expect(reviewQueue(state, now).map(entry => entry.id)).toEqual(['linear', 'functions']);
    expect(reviewQueue(state, now + 1).map(entry => entry.id)).toEqual(['linear', 'functions', 'vectors']);
  });

  it('spaces remembered reviews at 1/3/7/14/30 days and caps the interval', () => {
    let schedule;
    for (const days of [1, 3, 7, 14, 30, 30, 30]) {
      schedule = scheduleReview(schedule, 'remembered', now);
      expect(Date.parse(schedule.dueAt)).toBe(now + days * day);
    }
    expect(schedule?.step).toBe(5);
  });

  it('resets a forgotten chapter to ten minutes, then restarts at one day', () => {
    const previous = { step: 5, dueAt: new Date(now - day).toISOString() };
    const retry = scheduleReview(previous, 'again', now);
    expect(retry).toEqual({ step: 0, dueAt: new Date(now + 600_000).toISOString() });
    expect(scheduleReview(retry, 'remembered', now + 600_000)).toEqual({ step: 1, dueAt: new Date(now + 600_000 + day).toISOString() });
    expect(previous.step).toBe(5);
  });

  it('round-trips enabled/disabled schedules through JSON and IndexedDB without changing learning evidence', async () => {
    const state = initialState();
    state.reviewQueueEnabled = true;
    state.progress.functions = { ...emptyProgress(), status: 'mastered', review: true, quizAnswer: 2, quizPassed: true, code: 'my code', note: 'my notes', reviewSchedule: scheduleReview(undefined, 'remembered', now) };
    expect(validateImport(JSON.parse(JSON.stringify(state)))).toEqual(state);
    await writeState(state);
    expect(await readState()).toEqual(state);
    state.reviewQueueEnabled = false;
    await writeState(state);
    const restored = await readState();
    expect(restored).toEqual(state);
    expect(reviewQueue(restored, now + day)).toEqual([]);
    expect(reviewQueue({ ...restored, reviewQueueEnabled: true }, now + day).map(entry => entry.id)).toEqual(['functions']);
  });

  it.each([null, [], {}, { step: -1, dueAt: new Date(now).toISOString() }, { step: 6, dueAt: new Date(now).toISOString() }, { step: 1.5, dueAt: new Date(now).toISOString() }, { step: '1', dueAt: new Date(now).toISOString() }, { step: 1, dueAt: 'tomorrow' }, { step: 1, dueAt: 0 }])('rejects malformed review schedules %j', reviewSchedule => {
    const state = initialState();
    state.progress.functions = { ...emptyProgress(), reviewSchedule } as never;
    expect(() => validateImport(state)).toThrow('间隔复习计划无效');
  });

  it.each([null, 1, 'true', [], {}])('rejects malformed experimental flags %j', reviewQueueEnabled => {
    expect(() => validateImport({ ...initialState(), reviewQueueEnabled })).toThrow('间隔复习设置无效');
  });
});
