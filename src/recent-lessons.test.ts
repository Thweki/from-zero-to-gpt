// @vitest-environment jsdom
import {describe, expect, it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {RecentLessons} from './components/RecentLessons';
import {recentLessons} from './recent-lessons';
import {emptyProgress, initialState, validateImport} from './storage';
import {lessonIds} from './data/lesson-ids';
import {lessonById} from './data/lessons';
import type {LearningState} from './types';

describe('recently opened lessons', () => {
  it('does not invent visits from the default lesson, progress, or a checkpoint', () => {
    const state = initialState();
    state.progress.functions = {...emptyProgress(), status:'mastered', review:true};
    state.checkpoint = {lessonId:'functions', savedAt:state.updatedAt, question:'why?', next:'read', code:'', runResult:''};
    expect(recentLessons(state.progress)).toEqual([]);
    expect(renderToStaticMarkup(createElement(RecentLessons, {progress:state.progress}))).toBe('');
  });

  it('selects the six newest unique chapters across the course without mutating progress', () => {
    const progress: LearningState['progress'] = {};
    const ids = [...lessonIds.slice(0, 7), lessonIds.at(-1)!];
    ids.forEach((id, i) => {progress[id] = {...emptyProgress(), lastVisited:new Date(Date.UTC(2026, 0, i + 1)).toISOString()};});
    const before = JSON.stringify(progress);
    expect(recentLessons(progress).map(item => item.id)).toEqual(ids.slice(2).reverse());
    expect(JSON.stringify(progress)).toBe(before);
    progress[ids[0]]!.lastVisited = '2026-02-01T00:00:00Z';
    const reopened = recentLessons(progress).map(item => item.id);
    expect(reopened).toEqual([ids[0], ...ids.slice(3).reverse()]);
    expect(new Set(reopened).size).toBe(6);
  });

  it('compares instants across time zones and keeps catalogue order for ties', () => {
    const progress = {
      linear:{...emptyProgress(), lastVisited:'2026-01-01T12:00:00Z'},
      functions:{...emptyProgress(), lastVisited:'2026-01-01T12:00:00Z'},
      vectors:{...emptyProgress(), lastVisited:'2026-01-01T08:00:00-05:00'},
    };
    expect(recentLessons(progress).map(item => item.id)).toEqual(['vectors', 'functions', 'linear']);
  });

  it('ignores unknown chapters and unusable or absent visit timestamps', () => {
    const progress = {
      functions:{...emptyProgress(), lastVisited:'invalid'},
      linear:emptyProgress(),
      removed:{...emptyProgress(), lastVisited:'2026-01-01T00:00:00Z'},
    };
    expect(recentLessons(progress)).toEqual([]);
  });

  it('preserves history through existing backups and renders semantic lesson links and dates', () => {
    const state = initialState();
    state.progress.linear = {...emptyProgress(), lastVisited:'2026-01-02T12:00:00Z'};
    state.progress.functions = {...emptyProgress(), lastVisited:'2026-01-01T12:00:00Z'};
    const restored = validateImport(JSON.parse(JSON.stringify(state)));
    expect(recentLessons(restored.progress)).toEqual(recentLessons(state.progress));
    const root = document.createElement('div');
    root.innerHTML = renderToStaticMarkup(createElement(RecentLessons, {progress:restored.progress}));
    expect(root.querySelector('section')?.getAttribute('aria-labelledby')).toBe(root.querySelector('h2')?.id);
    expect(Array.from(root.querySelectorAll('ol a')).map(a => a.getAttribute('href'))).toEqual(['#/lesson/linear', '#/lesson/functions']);
    expect(root.querySelector('a')?.textContent).toContain(lessonById.linear.title);
    expect(root.querySelector('time')?.dateTime).toBe(state.progress.linear.lastVisited);
    expect(root.querySelector('time')?.textContent).not.toContain('Invalid');
  });
});
