import {useEffect, useRef, useState} from 'react';
import {createLessonSpeech, sectionSpeech, type SpeechState} from '../lesson-speech';
import type {Lesson} from '../types';
import './lesson-read-aloud.css';

export function LessonReadAloud({sections}: {sections: Lesson['math']}) {
  const [selected, setSelected] = useState(0);
  const [state, setState] = useState<SpeechState>('idle');
  const controller = useRef<ReturnType<typeof createLessonSpeech> | null>(null);
  const supported = typeof window !== 'undefined' && typeof window.speechSynthesis?.speak === 'function'
    && typeof window.SpeechSynthesisUtterance === 'function';
  useEffect(() => {
    if (!supported) return;
    const speech = createLessonSpeech(window.speechSynthesis, text => new SpeechSynthesisUtterance(text), setState);
    controller.current = speech;
    const stop = () => speech.stop();
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      speech.dispose(); controller.current = null;
    };
  }, [supported]);
  const active = state === 'speaking' || state === 'paused';
  return <section className="lesson-read-aloud" aria-label="朗读课文 · 实验性">
    <strong>朗读课文 · 实验性</strong>
    <p>只读所选小节的标题和正文，公式请参照页面。语音由浏览器提供，可能需要联网。</p>
    {supported ? <>
      <label>朗读小节<select value={selected} onChange={event => {
        controller.current?.stop(); setSelected(Number(event.target.value));
      }}>{sections.map((section, i) => <option key={i} value={i}>{i + 1} · {section.title}</option>)}</select></label>
      <div className="button-row">
        <button className="button secondary compact" disabled={!sections[selected]} onClick={() => {
          if (state === 'speaking') controller.current?.pause();
          else if (state === 'paused') controller.current?.resume();
          else controller.current?.start(sectionSpeech(sections[selected]));
        }}>{state === 'speaking' ? '暂停朗读' : state === 'paused' ? '继续朗读' : '朗读本节'}</button>
        <button className="button secondary compact" disabled={!active} onClick={() => controller.current?.stop()}>停止朗读</button>
      </div>
      <p role="status">{state === 'error' ? '朗读失败，请检查浏览器语音支持后重试。' : state === 'speaking' ? '正在朗读所选小节' : state === 'paused' ? '朗读已暂停' : '点击朗读开始；切换小节、阅读模式或章节会停止。'}</p>
    </> : <p role="status">当前浏览器不支持朗读，仍可正常阅读课文。</p>}
  </section>;
}
