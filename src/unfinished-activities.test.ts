import {describe, expect, it} from 'vitest';
import {activityMode, activitySection, unfinishedActivities} from './unfinished-activities';
import {emptyProgress, initialState, validateImport} from './storage';
import type {LessonProgress} from './types';

const started = (): LessonProgress => ({...emptyProgress(), status: 'learning'});
describe('unfinished activities across lessons', () => {
  it('excludes untouched chapters and records created only for notes or bookmarks', () => {
    expect(unfinishedActivities({})).toEqual([]);
    expect(unfinishedActivities({functions: {...emptyProgress(), note: '保存一个问题', review: true}})).toEqual([]);
  });

  it('lists missing evidence in curriculum order rather than insertion order', () => {
    const result = unfinishedActivities({linear: started(), functions: {...started(), readCompleted: true, experimented: true}});
    expect(result.map(entry => [entry.lesson.id, entry.sections])).toEqual([
      ['functions', ['quiz', 'code']], ['linear', ['reading', 'experiment', 'quiz', 'code']],
    ]);
  });

  it.each([
    {lastVisited: '2026-11-15T12:00:00Z'}, {readCompleted: true}, {experimented: true},
    {quizAnswer: 0}, {quizPassed: true}, {lastRun: 'AssertionError'}, {codePassed: true},
  ])('includes activity in auxiliary views even when status is new: %j', evidence => {
    expect(unfinishedActivities({functions: {...emptyProgress(), ...evidence}})).toHaveLength(1);
  });

  it('does not infer completion from self-assessed mastery, selected answers or legacy run output', () => {
    const progress: LessonProgress = {...started(), status: 'mastered', quizAnswer: 0, quizPassed: false, lastRun: '✓ 本章单元测试通过'};
    expect(unfinishedActivities({functions: progress})[0].sections).toEqual(['reading', 'experiment', 'quiz', 'code']);
  });

  it('removes completed activities and restores invalidated code without mutating records', () => {
    const saved = {...started(), readCompleted: true, experimented: true, quizPassed: true, codePassed: true};
    const progress = Object.freeze({functions: Object.freeze(saved)});
    expect(unfinishedActivities(progress)).toEqual([]);
    expect(unfinishedActivities({functions: {...saved, codePassed: false}})[0].sections).toEqual(['code']);
    expect(progress.functions.codePassed).toBe(true);
  });

  it('derives the same list after backup import, including old records with no evidence fields', () => {
    const state = initialState();
    state.progress = {functions: started(), linear: {...started(), readCompleted: true}};
    const before = JSON.stringify(state);
    expect(unfinishedActivities(validateImport(JSON.parse(before)).progress)).toEqual(unfinishedActivities(state.progress));
    expect(JSON.stringify(state)).toBe(before);
  });

  it('accepts only known activity destinations and chooses a mode with that activity', () => {
    for (const section of ['reading', 'experiment', 'quiz', 'code'] as const) {
      expect(activitySection(section)).toBe(section);
      expect(activityMode(section)).toBe(section === 'code' ? 'code' : 'intuition');
    }
    for (const invalid of [undefined, '', 'constructor', '__proto__', 'deep']) expect(activitySection(invalid)).toBeUndefined();
  });
});
