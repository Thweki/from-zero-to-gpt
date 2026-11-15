import {useId, useState} from 'react';
import {MAX_CODE_VERSIONS, MAX_VERSION_CODE, MAX_VERSION_NAME, type CodeVersion} from '../code-versions';
import './CodeVersions.css';

type Props = {
  code: string;
  versions: CodeVersion[];
  onChange: (versions: CodeVersion[]) => void;
  onRestore: (code: string) => void;
};

export function CodeVersions({code, versions, onChange, onRestore}: Props) {
  const nameId = useId();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const full = versions.length >= MAX_CODE_VERSIONS;
  const tooLong = code.length > MAX_VERSION_CODE;
  function save() {
    if (full || tooLong || !name.trim() || name.length > MAX_VERSION_NAME) return;
    const id = crypto.getRandomValues(new Uint32Array(4)).join('-');
    onChange([...versions, {id, name:name.trim(), code, savedAt:new Date().toISOString()}]);
    setName('');
    setMessage('已添加代码版本；保存状态见页面顶部。');
  }
  return <details className="code-versions">
    <summary>我的代码版本（{versions.length}/{MAX_CODE_VERSIONS}）</summary>
    <p>尝试另一种写法前，给当前代码留一个版本。仅保存在本章，随学习记录一起备份。</p>
    <div className="code-version-save">
      <label htmlFor={nameId}>版本名称</label>
      <input id={nameId} value={name} maxLength={MAX_VERSION_NAME} placeholder="例如：循环实现，准备尝试递归" onChange={event=>setName(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing){event.preventDefault();save();}}}/>
      <button className="button secondary compact" disabled={full||tooLong||!name.trim()} onClick={save}>保存当前代码为版本</button>
    </div>
    {full&&<p>本章已保存 {MAX_CODE_VERSIONS} 个版本；请先删除不需要的版本再保存。</p>}
    {tooLong&&<p>当前代码超过 {MAX_VERSION_CODE} 字符，无法保存为版本。</p>}
    <p role="status">{message}</p>
    {versions.length===0&&<p>还没有保存的代码版本。</p>}
    <ul>{versions.map(version=><li key={version.id}>
      <details>
        <summary>{version.name} <time dateTime={version.savedAt}>{new Date(version.savedAt).toLocaleString()}</time></summary>
        <pre aria-label={`代码版本：${version.name}`} tabIndex={0}>{version.code||'（空代码）'}</pre>
        <div className="button-row">
          <button className="button secondary compact" disabled={version.code===code} onClick={()=>{
            if(!window.confirm(`恢复“${version.name}”会替换当前编辑器内容并清除运行结果。未保存为版本的修改将丢失，是否继续？`))return;
            onRestore(version.code);
            setMessage(`已恢复“${version.name}”；请重新运行并测试。`);
          }}>恢复到编辑器</button>
          <button className="text-button" onClick={()=>{
            if(!window.confirm(`删除代码版本“${version.name}”？当前编辑器内容不受影响。`))return;
            onChange(versions.filter(item=>item.id!==version.id));
            setMessage(`已删除“${version.name}”。`);
          }}>删除版本</button>
        </div>
      </details>
    </li>)}</ul>
  </details>;
}
