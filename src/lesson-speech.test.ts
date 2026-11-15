import {describe, expect, it, vi} from 'vitest';
import {createLessonSpeech, sectionSpeech} from './lesson-speech';
import {lessons} from './data/lessons';

function fixture() {
  const engine = {speak: vi.fn(), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(), paused: false};
  const states = vi.fn();
  const make = vi.fn((text: string) => ({text, lang: '', onend: null, onerror: null}) as SpeechSynthesisUtterance);
  const speech = createLessonSpeech(engine, make, states);
  const utterance = () => engine.speak.mock.lastCall![0] as SpeechSynthesisUtterance;
  const end = () => utterance().onend?.call(utterance(), {} as SpeechSynthesisEvent);
  return {engine, states, make, speech, utterance, end};
}

describe('section narration text', () => {
  it('reads the heading and paragraphs once, replacing inline math and omitting standalone formulas', () => {
    expect(sectionSpeech({title: '理解函数', paragraphs: ['先观察。再理解！', '公式 $x^2$ 可以参考。'], formula: 'never speak this'}))
      .toEqual(['理解函数', '先观察。', '再理解！', '公式 （公式请参照正文） 可以参考。']);
  });
  it('bounds long Chinese and emoji utterances without losing text or splitting surrogate pairs', () => {
    const text = '汉🙂'.repeat(250);
    const chunks = sectionSpeech({title: '', paragraphs: [text]});
    expect(chunks.join('')).toBe(text);
    expect(chunks.every(chunk => Array.from(chunk).length <= 180 && !/[\uD800-\uDFFF]/u.test(chunk))).toBe(true);
  });
  it('produces nonempty bounded narration for every curriculum reading section', () => {
    for (const lesson of lessons) for (const mode of ['intuition', 'math', 'deep'] as const) for (const section of lesson[mode]) {
      const chunks = sectionSpeech(section);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.trim() && Array.from(chunk).length <= 180)).toBe(true);
    }
  });
});

describe('speech lifecycle', () => {
  it('does not autoplay; speaks one Chinese chunk at a time and completes', () => {
    const f = fixture();
    expect(f.engine.speak).not.toHaveBeenCalled();
    f.speech.start(['标题', '正文']);
    expect(f.engine.speak).toHaveBeenCalledTimes(1);
    expect(f.utterance()).toMatchObject({text: '标题', lang: 'zh-CN'});
    f.end(); expect(f.utterance().text).toBe('正文');
    f.end(); expect(f.states).toHaveBeenLastCalledWith('idle');
  });
  it('pauses and resumes the same utterance', () => {
    const f = fixture(); f.speech.start(['正文']); f.speech.pause();
    expect(f.engine.pause).toHaveBeenCalledOnce(); expect(f.states).toHaveBeenLastCalledWith('paused');
    f.speech.resume();
    expect(f.engine.resume).toHaveBeenCalledOnce(); expect(f.engine.speak).toHaveBeenCalledOnce();
    expect(f.states).toHaveBeenLastCalledWith('speaking');
  });
  it('holds a chunk boundary reached while paused until resume', () => {
    const f = fixture(); f.speech.start(['第一句', '第二句']); f.speech.pause(); f.end();
    expect(f.engine.speak).toHaveBeenCalledOnce();
    f.speech.resume(); expect(f.utterance().text).toBe('第二句');
  });
  it('invalidates late end and error callbacks when replacing a section', () => {
    const f = fixture(); f.speech.start(['旧标题', '旧正文']);
    const old = f.utterance();
    f.speech.start(['新正文']);
    old.onend?.call(old, {} as SpeechSynthesisEvent);
    old.onerror?.call(old, {} as SpeechSynthesisErrorEvent);
    expect(f.engine.speak).toHaveBeenCalledTimes(2);
    expect(f.utterance().text).toBe('新正文'); expect(f.states).toHaveBeenLastCalledWith('speaking');
  });
  it('stops a paused session and resets the engine pause on the next explicit start', () => {
    const f = fixture(); f.speech.start(['正文']); f.speech.pause(); f.engine.paused = true;
    const old = f.utterance(); f.speech.stop();
    old.onend?.call(old, {} as SpeechSynthesisEvent);
    expect(f.states).toHaveBeenLastCalledWith('idle'); expect(f.engine.cancel).toHaveBeenCalledOnce();
    f.speech.start(['重读']); expect(f.engine.resume).toHaveBeenCalledOnce();
    expect(f.utterance().text).toBe('重读');
  });
  it('reports speech errors, clears remaining chunks, and allows retry', () => {
    const f = fixture(); f.speech.start(['标题', '正文']); const old = f.utterance();
    old.onerror?.call(old, {} as SpeechSynthesisErrorEvent);
    expect(f.states).toHaveBeenLastCalledWith('error');
    old.onend?.call(old, {} as SpeechSynthesisEvent); expect(f.engine.speak).toHaveBeenCalledOnce();
    f.speech.start(['重试']); expect(f.utterance().text).toBe('重试');
  });
  it.each(['speak', 'pause', 'resume'] as const)('handles synchronous %s failure', method => {
    const f = fixture();
    if (method !== 'speak') f.speech.start(['正文']);
    if (method === 'resume') f.speech.pause();
    f.engine[method].mockImplementation(() => { throw new Error('engine unavailable'); });
    if (method === 'speak') f.speech.start(['正文']); else f.speech[method]();
    expect(f.states).toHaveBeenLastCalledWith('error');
  });
  it('disposes active speech and ignores callbacks and commands after unmount', () => {
    const f = fixture(); f.speech.start(['标题', '正文']); const old = f.utterance();
    f.speech.dispose(); f.states.mockClear();
    old.onend?.call(old, {} as SpeechSynthesisEvent);
    old.onerror?.call(old, {} as SpeechSynthesisErrorEvent);
    f.speech.start(['忽略']); f.speech.pause(); f.speech.resume(); f.speech.stop();
    expect(f.engine.cancel).toHaveBeenCalledOnce(); expect(f.engine.speak).toHaveBeenCalledOnce();
    expect(f.states).not.toHaveBeenCalled();
  });
  it('does not cancel unrelated speech when never started, completed, or empty', () => {
    const f = fixture(); f.speech.stop(); f.speech.start([' ']); f.speech.start(['正文']); f.end(); f.speech.dispose();
    expect(f.engine.cancel).not.toHaveBeenCalled();
  });
});
