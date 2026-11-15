import { useEffect, useRef, useState } from 'react';
import { readPythonFile } from '../python-import';
import './CodeImport.css';

export function CodeImport({ running, onApply }: { running: boolean; onApply: (code: string) => void }) {
  const [preview, setPreview] = useState<{ name: string; code: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const request = useRef(0);
  const picker = useRef<HTMLInputElement>(null);
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => () => { request.current++; }, []);

  function cancel() {
    request.current++;
    setPreview(null);
    setLoading(false);
    setMessage('');
    picker.current?.focus();
  }

  async function select(file: File) {
    const id = ++request.current;
    setPreview(null);
    setMessage('');
    setLoading(true);
    try {
      const code = await readPythonFile(file);
      if (id === request.current) setPreview({ name: file.name, code });
    } catch (error) {
      if (id === request.current) setMessage(error instanceof Error ? error.message : '无法读取文件，请重新选择。');
    } finally {
      if (id === request.current) setLoading(false);
    }
  }

  return <details className="code-import" ref={disclosure}>
    <summary>导入 Python 文件</summary>
    <p>选择本地 UTF-8 .py 文件（最多 100 KB），预览后替换当前草稿。文件只在本机读取；导入不会执行代码。</p>
    <label>选择 Python 文件<input ref={picker} type="file" accept=".py" disabled={running} onChange={event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (file) void select(file);
    }}/></label>
    {running && <p>请先停止运行，再导入文件。</p>}
    <p role="status">{loading ? '正在读取文件…' : message}</p>
    {preview && <section aria-label="待导入代码预览">
      <p><strong>{preview.name}</strong> · {preview.code.length} 字符</p>
      <pre tabIndex={0} aria-label="文件代码">{preview.code}</pre>
      <p>替换会覆盖编辑器中当前的代码，并清除上次运行结果。需要保留的代码请先自行保存。</p>
      <button type="button" className="button secondary compact" disabled={running} onClick={() => {
        const code = preview.code;
        cancel();
        if (disclosure.current) disclosure.current.open = false;
        onApply(code);
      }}>替换当前代码</button>
    </section>}
    {(preview || loading) && <button type="button" className="text-button" onClick={cancel}>取消导入</button>}
  </details>;
}
