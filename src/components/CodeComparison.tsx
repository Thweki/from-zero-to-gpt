import { useId, useMemo, useState } from 'react';
import { compareCode, comparisonLimits } from '../code-comparison';
import './CodeComparison.css';

export function CodeComparison({ code, reference }: { code: string; reference: string }) {
  const [comparing, setComparing] = useState(false);
  const id = useId();
  const rows = useMemo(() => comparing ? compareCode(code, reference) : null, [comparing, code, reference]);
  const mine = rows?.filter(row => row.kind === 'mine').length ?? 0;
  const theirs = rows?.filter(row => row.kind === 'reference').length ?? 0;
  return <section className="code-comparison">
    <button type="button" className="text-button" aria-expanded={comparing} aria-controls={id} onClick={() => setComparing(!comparing)}>
      {comparing ? '查看完整参考' : '逐行比较我的代码'}
    </button>
    <div id={id}>
      {!comparing ? <pre>{reference}</pre> : <>
        <p>比较当前编辑器与参考实现；缩进和空行也会参与比较。差异不代表错误，不同写法可能同样正确，请运行验收测试验证。</p>
        {rows === null ? <>
          <p role="status">代码过长，暂不逐行比较（每份最多 {comparisonLimits.lines} 行、{comparisonLimits.characters} 字符）。仍可查看完整参考，编辑器内容已保留。</p>
          <pre>{reference}</pre>
        </> : <>
          <p role="status">{mine + theirs === 0 ? '两份代码逐行相同。' : `仅我的代码：${mine} 行 · 仅参考实现：${theirs} 行`}</p>
          {rows.length > 0 && <div className="code-comparison-scroll" tabIndex={0} role="region" aria-label="代码逐行差异，可横向滚动">
            <table>
              <caption>当前代码与参考实现的逐行比较</caption>
              <thead><tr><th scope="col">来源</th><th scope="col">我的行号</th><th scope="col">参考行号</th><th scope="col">代码</th></tr></thead>
              <tbody>{rows.map((row, index) => <tr key={index} data-kind={row.kind}>
                <td>{row.kind === 'same' ? '相同' : row.kind === 'mine' ? '仅我的' : '仅参考'}</td>
                <td>{row.mine ?? '—'}</td><td>{row.reference ?? '—'}</td>
                <td><code>{row.text || ' '}</code></td>
              </tr>)}</tbody>
            </table>
          </div>}
        </>}
      </>}
    </div>
  </section>;
}
