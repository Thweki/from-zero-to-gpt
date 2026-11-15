import {splitMathText} from './math-format';
import type {Lesson} from './types';

export type SpeechState = 'idle' | 'speaking' | 'paused' | 'error';
export type SpeechEngine = Pick<SpeechSynthesis, 'speak' | 'cancel' | 'pause' | 'resume' | 'paused'>;

// Read curriculum data, never DOM text (which includes KaTeX duplicates and learner work).
export function sectionSpeech(section: Lesson['math'][number]): string[] {
  return [section.title, ...section.paragraphs].flatMap(text => {
    const prose = splitMathText(text).map(part => part.type === 'math' ? '（公式请参照正文）' : part.value).join('');
    // Short utterances avoid long-text limits; Array.from preserves surrogate pairs.
    return (prose.match(/[^。！？.!?；;\n]+[。！？.!?；;\n]*|[。！？.!?；;\n]+/gu) ?? []).flatMap(sentence => {
      const characters = Array.from(sentence), chunks: string[] = [];
      for (let i = 0; i < characters.length; i += 180) {
        const chunk = characters.slice(i, i + 180).join('').trim();
        if (chunk) chunks.push(chunk);
      }
      return chunks;
    });
  });
}

export function createLessonSpeech(
  engine: SpeechEngine,
  makeUtterance: (text: string) => SpeechSynthesisUtterance,
  onState: (state: SpeechState) => void,
) {
  let state: SpeechState = 'idle', generation = 0, disposed = false;
  let chunks: string[] = [], cursor = 0;
  // Retain the current utterance until completion and reject late browser callbacks.
  let current: SpeechSynthesisUtterance | null = null;
  const update = (next: SpeechState) => { state = next; if (!disposed) onState(next); };
  const clear = () => {
    generation++;
    const active = current !== null || state === 'speaking' || state === 'paused';
    current = null; chunks = []; cursor = 0;
    if (active) {
      try { engine.cancel(); } catch { /* Some embedded browsers expose an unusable engine. */ }
    }
  };
  const fail = () => { clear(); update('error'); };
  const speakNext = () => {
    if (disposed || state !== 'speaking') return;
    if (cursor >= chunks.length) { update('idle'); return; }
    const token = generation;
    try {
      const utterance = makeUtterance(chunks[cursor++]);
      current = utterance;
      utterance.lang = 'zh-CN';
      utterance.onend = () => {
        if (disposed || token !== generation || current !== utterance) return;
        current = null;
        speakNext();
      };
      utterance.onerror = () => {
        if (!disposed && token === generation && current === utterance) fail();
      };
      engine.speak(utterance);
    } catch { fail(); }
  };
  return {
    start(text: string[]) {
      if (disposed) return;
      clear();
      chunks = text.filter(chunk => chunk.trim());
      if (!chunks.length) { update('idle'); return; }
      try {
        // cancel() does not reset the browser's paused flag.
        if (engine.paused) engine.resume();
        update('speaking'); speakNext();
      } catch { fail(); }
    },
    pause() {
      if (disposed || state !== 'speaking') return;
      update('paused');
      try { engine.pause(); } catch { fail(); }
    },
    resume() {
      if (disposed || state !== 'paused') return;
      update('speaking');
      try { engine.resume(); if (!current) speakNext(); } catch { fail(); }
    },
    stop() { if (!disposed) { clear(); update('idle'); } },
    dispose() { disposed = true; clear(); },
  };
}
