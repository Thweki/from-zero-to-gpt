import {useRef,useState} from 'react';
import {format} from '../math';
import './ExperimentComparison.css';

export type ComparisonRow={label:string;value:number|string};
type Snapshot={parameters:Record<string,number>;rows:ComparisonRow[]};
type Props={parameters:Record<string,number>;rows:ComparisonRow[];onRestore:(parameters:Record<string,number>)=>void};

/** A temporary comparison point belongs to one mounted lesson, never to progress. */
export function ExperimentComparison({parameters,rows,onRestore}:Props){
  const [baseline,setBaseline]=useState<Snapshot|null>(null);
  const saveButton=useRef<HTMLButtonElement>(null);
  return <section className="experiment-comparison" aria-label="实验参数与结果对照">
    <div className="comparison-actions">
      <button ref={saveButton} type="button" className="button secondary compact" onClick={()=>setBaseline({parameters:{...parameters},rows:rows.map(row=>({...row}))})}>{baseline?'更新对照点':'保存实验对照点'}</button>
      {baseline&&<>
        <button type="button" className="text-button" onClick={()=>onRestore({...baseline.parameters})}>恢复对照参数</button>
        <button type="button" className="text-button" onClick={()=>{setBaseline(null);saveButton.current?.focus();}}>清除对照点</button>
      </>}
    </div>
    <p>先保存一组参数，再改变一个变量，比较结果。对照点仅在当前实验打开期间保留。</p>
    {baseline&&<div className="comparison-table-wrap"><table>
      <caption>实验对照 · 差值为当前值减去对照值</caption>
      <thead><tr><th scope="col">参数／结果</th><th scope="col">对照点</th><th scope="col">当前</th><th scope="col">差值</th></tr></thead>
      <tbody>{rows.map((row,index)=>{
        const saved=baseline.rows[index].value;
        const delta=typeof row.value==='number'&&typeof saved==='number'?row.value-saved:null;
        const display=(value:number|string)=>typeof value==='number'?format(value):value;
        return <tr key={row.label} data-changed={row.value!==saved}>
          <th scope="row">{row.label}</th><td>{display(saved)}</td><td>{display(row.value)}</td><td>{delta===null?(row.value===saved?'—':'已改变'):delta>0?`+${format(delta)}`:format(delta)}</td>
        </tr>;
      })}</tbody>
    </table></div>}
  </section>;
}
