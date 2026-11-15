import {useMemo, useState} from 'react';
import {compareCode} from '../code-diff';
import './CodeComparison.css';

export function CodeComparison({starter, code}: {starter: string; code: string}) {
  const [open, setOpen] = useState(false);
  const diff = useMemo(() => open ? compareCode(starter, code) : null, [open, starter, code]);
  return <details className="code-comparison" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>查看我的改动（与初始代码比较）</summary>
    {diff && (diff.limited
      ? <p>代码较长，暂不显示逐行比较；仍可继续编辑和运行。</p>
      : diff.added === 0 && diff.removed === 0
        ? <p>与初始代码相同。</p>
        : <>
          <p>新增 {diff.added} 行 · 删除 {diff.removed} 行。替换显示为先删除、再新增；空格显示为 ·，制表符显示为 →。仅供阅读，不修改代码。</p>
          <div className="code-comparison-scroll" role="region" aria-label="代码改动明细" tabIndex={0}>
            <table>
              <caption>初始代码 → 当前代码（行号）</caption>
              <thead><tr><th scope="col">初始</th><th scope="col">当前</th><th scope="col">改动</th><th scope="col">代码</th></tr></thead>
              <tbody>{diff.lines.map((line, index) => <tr key={index} data-change={line.kind}>
                <td>{line.before ?? '—'}</td><td>{line.after ?? '—'}</td>
                <td>{line.kind === 'added' ? '+ 新增' : line.kind === 'removed' ? '− 删除' : '相同'}</td>
                <td><code>{line.text.replace(/ /g, '·').replace(/\t/g, '→   ') || '（空行）'}</code></td>
              </tr>)}</tbody>
            </table>
          </div>
        </>)}
  </details>;
}
