import {useEffect,useRef,useState} from 'react';
import {lessons} from '../data/lessons';
import {validateImport} from '../storage';
import type {LearningState,LessonId} from '../types';
import './ChapterRestore.css';

type Props={current:LearningState;onRestore:(backup:LearningState,selected:LessonId[])=>Promise<void>};
const statusLabels={new:'尚未开始',learning:'学习中',mastered:'自评已掌握'};

export function ChapterRestore({current,onRestore}:Props){
  const [backup,setBackup]=useState<LearningState|null>(null),[selected,setSelected]=useState<LessonId[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(message&&!busy)trigger.current?.focus();},[message,busy]);
  const chapters=lessons.filter(lesson=>backup?.progress[lesson.id]);
  const reset=()=>{setBackup(null);setSelected([]);trigger.current?.focus();};
  const load=async(file?:File)=>{
    if(!file)return;
    setBusy(true);setBackup(null);setSelected([]);setError('');setMessage('');
    try{
      if(file.size>67108864)throw new Error('请选择小于 64 MB 的学习数据文件');
      setBackup(validateImport(JSON.parse(await file.text())));
    }catch(e){setError(e instanceof Error?e.message:'无法读取学习数据');}
    finally{setBusy(false);if(input.current)input.current.value='';}
  };
  const restore=async()=>{
    if(!backup||!selected.length||busy)return;
    setBusy(true);setError('');
    try{
      await onRestore(backup,selected);
      setMessage(`已恢复 ${selected.length} 个章节，其余学习数据已保留。`);reset();
    }catch{setError('章节恢复失败，当前记录未替换。请重试或先导出备份。');}
    finally{setBusy(false);}
  };
  return <section className="settings-card chapter-restore" aria-labelledby="chapter-restore-title">
    <h2 id="chapter-restore-title">从备份恢复章节</h2>
    <p>选择学习 JSON 备份，预览后只恢复需要的章节。未选章节、当前学习断点、外观与上次阅读位置保持不变。</p>
    <button ref={trigger} className="button secondary" disabled={busy} onClick={()=>input.current?.click()}>选择章节备份</button>
    <input ref={input} type="file" accept="application/json,.json" className="visually-hidden" tabIndex={-1} aria-label="选择性恢复备份文件" onChange={e=>void load(e.target.files?.[0])}/>
    {error&&<p role="alert">{error}</p>}
    <p role="status">{busy?'正在处理备份…':message}</p>
    {backup&&<div aria-label="章节恢复预览">
      <p>备份时间：{new Date(backup.updatedAt).toLocaleString()} · {chapters.length} 个章节</p>
      <p id="chapter-restore-warning">所选章节的笔记、代码、导师对话和学习记录将整章替换，不会拼接。建议先导出当前数据。</p>
      {chapters.length===0?<p>这个备份没有可恢复的章节记录。</p>:<>
        <div className="button-row"><button className="text-button" disabled={busy} onClick={()=>setSelected(chapters.map(lesson=>lesson.id))}>全选章节</button><button className="text-button" disabled={busy} onClick={()=>setSelected([])}>清空选择</button></div>
        <fieldset disabled={busy} aria-describedby="chapter-restore-warning">
          <legend>选择要恢复的章节</legend>
          {chapters.map(lesson=>{
            const progress=backup.progress[lesson.id]!;
            return <label className="restore-chapter" key={lesson.id}>
              <input type="checkbox" checked={selected.includes(lesson.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,lesson.id]:ids.filter(id=>id!==lesson.id))}/>
              <span><strong>{lesson.number} · {lesson.title}</strong><small>{current.progress[lesson.id]?'替换现有记录':'新增记录'} · {statusLabels[progress.status]} · 笔记 {progress.note.length} 字 · 代码 {progress.code?progress.code.split('\n').length:0} 行 · 对话 {progress.tutorMessages?.length||0} 条</small></span>
            </label>;
          })}
        </fieldset>
      </>}
      <div className="button-row"><button className="button primary" disabled={busy||!selected.length} onClick={()=>void restore()}>恢复所选章节（{selected.length}）</button><button className="button secondary" disabled={busy} onClick={()=>{setError('');reset();}}>取消恢复</button></div>
    </div>}
  </section>;
}
