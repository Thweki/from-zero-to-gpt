export function ObservationNote({snapshot,draft,onDraft,onSave,onLater,saveStatus}:{snapshot:string;draft:string;onDraft:(value:string)=>void;onSave:()=>void;onLater:()=>void;saveStatus:string}){
  return <section className="observation-note" aria-label="实验观察笔记">
    <h3>记下刚才的发现</h3>
    <details open><summary>记录时的实验状态</summary><pre>{snapshot}</pre></details>
    <label>我的观察<textarea className="observation-input" aria-label="这次实验的观察" placeholder="我改变了什么？看到了什么？还有哪里没想通？" maxLength={4000} value={draft} onChange={event=>onDraft(event.target.value)}/></label>
    <span className="autosave" role="status">{saveStatus==='saving'?'草稿保存中':saveStatus==='saved'?'观察草稿已本地保存':'草稿保存失败，请复制备份'}</span>
    <div className="button-row"><button type="button" className="button primary compact" disabled={!draft.trim()} onClick={onSave}>保存观察，回到实验</button><button type="button" className="text-button" onClick={onLater}>暂存，继续实验</button></div>
    <p>保存会追加到本章笔记；不会覆盖原有内容。</p>
  </section>;
}
