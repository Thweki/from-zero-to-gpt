import 'fake-indexeddb/auto';
import {execFileSync} from 'node:child_process';
import {beforeEach, describe, expect, it} from 'vitest';
import {deleteDB} from 'idb';
import {exerciseHints} from './data/exercise-hints';
import {lessonById} from './data/lessons';
import type {LessonId} from './types';
import {emptyProgress, initialState, readState, validateImport, writeState} from './storage';

describe('experimental exercise hint preference', () => {
  beforeEach(async () => {await deleteDB('from-zero-to-gpt');});

  it('keeps new users and old backups off without changing their data', async () => {
    const old = initialState();
    old.progress.functions = {...emptyProgress(), code: 'my draft', note: 'my note', codePassed: true};
    expect(old.experimentalExerciseHints).not.toBe(true);
    expect(validateImport(JSON.parse(JSON.stringify(old)))).toEqual(old);
    await writeState(old);
    expect(await readState()).toEqual(old);
  });

  it.each([true, false])('round-trips explicit %s through storage and backups', async enabled => {
    const state = {...initialState(), experimentalExerciseHints: enabled};
    const imported = validateImport(JSON.parse(JSON.stringify(state)));
    expect(imported).toEqual(state);
    await writeState(imported);
    expect(await readState()).toEqual(state);
  });

  it.each(['true', 1, 0, null, [], {}])('rejects malformed preference %j', value => {
    expect(() => validateImport({...initialState(), experimentalExerciseHints: value})).toThrow('实验性编程提示设置无效');
  });
});

describe('authored pilot hints', () => {
  it('covers eight existing browser exercises with three distinct cues and checks', () => {
    expect(Object.keys(exerciseHints)).toHaveLength(8);
    for (const [id, hints] of Object.entries(exerciseHints)) {
      const lesson = lessonById[id as LessonId];
      expect(lesson).toBeDefined();
      expect(lesson.runtime).not.toBe('local-python');
      expect(new Set([hints.concept, hints.plan, hints.check]).size).toBe(3);
      expect(hints.checkCode).toContain('assert ');
      expect(hints.checkCode).not.toContain('def ');
    }
    expect(exerciseHints.python).toBeUndefined();
  });

  it('all self-checks accept the lesson reference and reject its unfinished starter', () => {
    for (const [id, hints] of Object.entries(exerciseHints)) {
      const {reference, starter} = lessonById[id as LessonId];
      expect(() => execFileSync('python3', ['-c', `${reference}\n${hints.checkCode}`], {timeout: 10000, stdio: 'pipe'}), id).not.toThrow();
      expect(() => execFileSync('python3', ['-c', `${starter}\n${hints.checkCode}`], {timeout: 10000, stdio: 'pipe'}), id).toThrow();
    }
  });
});
