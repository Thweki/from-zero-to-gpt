import type {Lesson} from './types';
/** Freeze only the selected experiment's controls, never notes or editor code. */
export function experimentContext(lesson:Lesson,root:Element|null,values:Record<string,number>){
  const clean=(text:string)=>text.replace(/\s+/g,' ').trim();
  const relevant=lesson.lab==='function'?['x','kind']:lesson.lab==='linear'?['x','k','b']:['vector','dot'].includes(lesson.lab)?['ax','ay','bx','by']:Object.keys(values);
  const parameters=Object.fromEntries(relevant.filter(key=>values[key]!==undefined).map(key=>[key,values[key]]));
  const equation=root?.querySelector('.plot-equation')?.textContent;
  const result=root?.querySelector('[data-testid="lab-result"],.live-result strong,[data-testid="modern-lab-results"]')?.textContent||root?.querySelector('.live-result')?.textContent;
  const controls=Object.keys(parameters).length?'':Array.from(root?.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input[type="range"],input[type="number"],select')||[]).slice(0,12).map(control=>{
    const name=control.getAttribute('aria-label')||control.labels?.[0]?.textContent||'实验控件';
    const value=control instanceof HTMLSelectElement?control.selectedOptions[0]?.textContent||control.value:control.value;
    return `${clean(name).slice(0,80)}=${clean(value).slice(0,120)}`;
  }).join('；');
  return [`章节：${lesson.title}`,equation&&`当前函数／向量：${clean(equation)}`,result&&`当前结果：${clean(result).slice(0,1400)}`,Object.keys(parameters).length&&`实验参数：${JSON.stringify(parameters)}`,controls&&`当前控件：${controls}`].filter(Boolean).join('\n').slice(0,3000);
}
