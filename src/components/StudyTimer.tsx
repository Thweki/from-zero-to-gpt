import {useEffect, useState} from 'react';
import {elapsedTime, emptySession, formatElapsedTime, pauseSession, startSession} from '../study-timer';
import './StudyTimer.css';

// Keep the clock and its renders outside App and the curriculum's persisted state.
export function ExperimentalStudyTimer({stopKey}: {stopKey?: string}) {
  return import.meta.env.VITE_EXPERIMENTAL_STUDY_TIMER === 'true' ? <StudyTimer stopKey={stopKey}/> : null;
}

function StudyTimer({stopKey}: {stopKey?: string}) {
  const [session, setSession] = useState(emptySession);
  const [now, setNow] = useState(() => performance.now());
  const running = session.startedAt !== null;

  useEffect(() => {
    if (!running) return;
    // Read elapsed time from a monotonic clock, never count interval callbacks:
    // background-tab throttling must not lose time or wall-clock edits add time.
    const refresh = () => setNow(performance.now());
    const interval = window.setInterval(refresh, 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [running]);

  useEffect(() => {
    setSession(current => pauseSession(current, performance.now()));
  }, [stopKey]);

  function toggle() {
    const timestamp = performance.now();
    setNow(timestamp);
    setSession(current => running ? pauseSession(current, timestamp) : startSession(current, timestamp));
  }

  return <section className="study-timer" aria-label="学习计时 · 实验性">
    <div className="study-timer-summary">
      <strong>学习计时 · 实验性</strong>
      <span role="timer" aria-label="本次学习用时" aria-live="off">{formatElapsedTime(elapsedTime(session, now))}</span>
      <span role="status">{running ? '计时中' : session.elapsedMs > 0 ? '已暂停' : '未开始'}</span>
    </div>
    <div className="study-timer-actions">
      <button className="button secondary compact" onClick={toggle}>{running ? '暂停计时' : session.elapsedMs > 0 ? '继续计时' : '开始计时'}</button>
      <button className="button secondary compact" disabled={running || session.elapsedMs === 0} onClick={() => setSession(emptySession)}>重置计时</button>
    </div>
    <small>仅供自己参考；切换章节或标签页仍计时，休息时请暂停。刷新页面会清零。</small>
  </section>;
}
