import {describe, expect, it} from 'vitest';
import {elapsedTime, emptySession, formatElapsedTime, pauseSession, startSession} from './study-timer';

describe('study session clock', () => {
  it('starts at zero and includes time between display callbacks', () => {
    expect(elapsedTime(emptySession, 9000)).toBe(0);
    const running = startSession(emptySession, 0);
    expect(elapsedTime(running, 125123)).toBe(125123);
    expect(startSession(running, 5000)).toBe(running);
  });

  it('preserves fractions of a second across pauses and excludes breaks', () => {
    const paused = pauseSession(startSession(emptySession, 100), 1850);
    expect(elapsedTime(paused, 90000)).toBe(1750);
    expect(pauseSession(paused, 90000)).toBe(paused);
    const resumed = startSession(paused, 90000);
    expect(elapsedTime(resumed, 90250)).toBe(2000);
    expect(emptySession).toEqual({elapsedMs: 0, startedAt: null});
  });

  it('does not subtract elapsed time when a stale display timestamp precedes start', () => {
    expect(elapsedTime({elapsedMs: 1000, startedAt: 100}, 0)).toBe(1000);
  });

  it.each([
    [999, '00:00:00'], [1000, '00:00:01'], [60000, '00:01:00'],
    [3599999, '00:59:59'], [3600000, '01:00:00'], [90061000, '25:01:01'],
  ])('formats %i milliseconds as %s without wrapping hours', (ms, expected) => {
    expect(formatElapsedTime(ms)).toBe(expected);
  });
});
