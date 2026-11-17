import { useEffect, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { Formula } from './Formula';
import './LessonFormula.css';

function FormulaCopy({ source }: { source: string }) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const active = useRef(true);
  const fallback = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    if (status === 'failed') {
      fallback.current?.focus();
      fallback.current?.select();
    }
  }, [status]);

  async function copy() {
    if (status === 'copying') return;
    setStatus('copying');
    try {
      // Keep the write inside the click gesture for browser clipboard permissions.
      // Missing clipboard support also reaches the manual-copy fallback.
      await navigator.clipboard.writeText(source);
      if (active.current) setStatus('copied');
    } catch {
      if (active.current) setStatus('failed');
    }
  }

  return <div className="formula-copy">
    <div className="formula-copy-actions">
      <button type="button" className="text-button" onClick={() => { void copy(); }} aria-disabled={status === 'copying'}><Copy size={14} aria-hidden="true"/>复制 LaTeX</button>
      <span role="status">{status === 'copied' ? '已复制 LaTeX' : status === 'copying' ? '正在复制…' : status === 'failed' ? '无法访问剪贴板，请手动复制下方源码。' : ''}</span>
    </div>
    {status === 'failed' && <label>LaTeX 源码（不含 $ 分隔符）
      <textarea ref={fallback} readOnly value={source} rows={3} spellCheck={false} onFocus={event => event.currentTarget.select()}/>
    </label>}
  </div>;
}

/** Only lesson display formulas get controls; inline math stays part of the prose. */
export function LessonFormula({ source }: { source: string }) {
  return <><Formula>{source}</Formula><FormulaCopy key={source} source={source}/></>;
}
