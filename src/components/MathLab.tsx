import { useRef } from 'react';
import { RotateCcw, FlaskConical } from 'lucide-react';
import type { Lesson } from '../types';
import { dot, norm, format } from '../math';
import {functionPlotScale,axisTicks} from '../math-viewport';
import {FullscreenButton} from './FullscreenButton';
type Props={lesson:Lesson; values:Record<string,number>; onChange:(values:Record<string,number>)=>void;onObserve?:(origin:HTMLElement)=>void};
export const labDefaults = {x:2,k:1,b:0,ax:3,ay:2,bx:1,by:3,kind:0};
export function MathLab({lesson,values,onChange,onObserve}:Props) {
  const ref=useRef<HTMLElement>(null);
  const v={...labDefaults,...values};
  const set=(key:string,value:number)=>onChange({...v,[key]:value});
  const vectors=lesson.lab==='vector'||lesson.lab==='dot';
  const functionY=(x:number)=>lesson.lab==='linear'?v.k*x+v.b:v.kind===1?2*x+1:v.kind===2?Math.abs(x):x*x;
  const result=functionY(v.x);
  const unit=vectors?Math.min(26,130/Math.max(5,Math.abs(v.ax),Math.abs(v.ay),Math.abs(v.bx),Math.abs(v.by),Math.abs(v.ax+v.bx),Math.abs(v.ay+v.by))):functionPlotScale(functionY,v.x);
  const px=(x:number)=>320+x*unit, py=(y:number)=>155-y*unit;
  const points=Array.from({length:241},(_,i)=>{const x=-12+i/10;return `${px(x)},${py(functionY(x))}`}).join(' ');
  const a=[v.ax,v.ay],b=[v.bx,v.by];
  const product=dot(a,b);
  const range=(key:string,label:string,min=-5,max=5,step=.5)=><label className="slider-label"><span>{label}<output>{format(v[key as keyof typeof v])}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={v[key as keyof typeof v]} onChange={e=>set(key,Number(e.target.value))}/><span className="range-extents"><span>{min}</span><span>{max}</span></span></label>;
  return <section className="math-lab" ref={ref} aria-label="交互式数学实验">
    <div className="lab-header"><span><FlaskConical size={16}/> 交互实验 <small>LIVE</small></span><div><button className="icon-button" aria-label="重置实验参数" onClick={()=>onChange({...labDefaults})}><RotateCcw size={15}/></button><FullscreenButton target={ref} label="全屏实验"/></div></div>
    <div className="lab-body"><div className="plot-area"><div className="plot-equation">{vectors?<><i>a</i> = ({v.ax}, {v.ay}) <span className="muted">{lesson.lab==='dot'?'·':'+'}</span> <i>b</i> = ({v.bx}, {v.by})</>:<><i>f(x)</i> = {lesson.lab==='linear'?`${format(v.k)}x ${v.b>=0?'+':'−'} ${format(Math.abs(v.b))}`:v.kind===1?'2x + 1':v.kind===2?'|x|':'x²'}</>}</div>
    <svg viewBox="0 0 640 310" role="img" aria-label={vectors?'二维向量坐标图':'函数图像，随参数实时更新'}><defs><pattern id={`grid-${lesson.id}`} width={unit} height={unit} patternUnits="userSpaceOnUse" x={320%unit} y={155%unit}><path d={`M${unit} 0H0V${unit}`} fill="none" stroke="var(--grid)" strokeWidth="1"/></pattern><clipPath id={`clip-${lesson.id}`}><rect x="6" y="5" width="625" height="300"/></clipPath><marker id={`arrow-a-${lesson.id}`} markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="var(--accent)" strokeWidth="1.5"/></marker><marker id={`arrow-b-${lesson.id}`} markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="var(--plot-secondary)" strokeWidth="1.5"/></marker></defs>
    <rect x="6" y="5" width="625" height="300" fill={`url(#grid-${lesson.id})`}/><path d="M6 155H630M320 5V305" stroke="var(--axis)" strokeWidth="1.2"/>
    {axisTicks(285,unit).map(n=><text key={`x${n}`} x={px(n)} y="173" textAnchor="middle">{format(n)}</text>)}{axisTicks(130,unit).map(n=><text key={`y${n}`} x="308" y={py(n)+4} textAnchor="end">{format(n)}</text>)}<text x="308" y="173">0</text><text x="624" y="146">x</text><text x="330" y="16">y</text>
    <g clipPath={`url(#clip-${lesson.id})`}>{vectors?<><path d={`M320 155L${px(v.ax)} ${py(v.ay)}`} stroke="var(--accent)" strokeWidth="3" markerEnd={`url(#arrow-a-${lesson.id})`}/><path d={`M320 155L${px(v.bx)} ${py(v.by)}`} stroke="var(--plot-secondary)" strokeWidth="3" markerEnd={`url(#arrow-b-${lesson.id})`}/>{lesson.lab==='vector'?<><path d={`M${px(v.ax)} ${py(v.ay)}l${v.bx*unit} ${-v.by*unit}M${px(v.bx)} ${py(v.by)}l${v.ax*unit} ${-v.ay*unit}`} stroke="var(--axis)" strokeDasharray="5 5" fill="none"/><path d={`M320 155L${px(v.ax+v.bx)} ${py(v.ay+v.by)}`} stroke="var(--axis)" strokeWidth="2"/><text x={px(v.ax+v.bx)+8} y={py(v.ay+v.by)-6}>a+b</text></>:norm(b)>0&&<path d={`M${px(v.ax)} ${py(v.ay)}L${px(product/(norm(b)**2)*v.bx)} ${py(product/(norm(b)**2)*v.by)}`} stroke="var(--axis)" strokeDasharray="5 5"/>}<text className="vector-a" x={px(v.ax)+10} y={py(v.ay)-8}>a</text><text x={px(v.bx)+10} y={py(v.by)-8}>b</text></>:<><polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2.8"/><path data-testid="function-projection" d={`M${px(v.x)} 155V${py(result)}H320`} fill="none" stroke="var(--accent)" strokeDasharray="5 5" opacity=".5"/><circle cx={px(v.x)} cy={py(result)} data-testid="function-target" r="6" fill="var(--accent)" stroke="var(--panel)" strokeWidth="3"/></>}</g></svg>
    <div className="plot-caption"><span className="legend-dot"/>{vectors?lesson.lab==='dot'?'绿色 a · 金色 b · 虚线表示垂直投影':'绿色 a · 金色 b · 灰色 a + b':'移动滑块，观察输入与输出如何一起变化'}<span>坐标系 · 两轴等比例</span></div></div>
    <div className="lab-controls">{vectors?<>{range('ax','a 的 x 分量')}{range('ay','a 的 y 分量')}{range('bx','b 的 x 分量')}{range('by','b 的 y 分量')}</>:<>{lesson.lab==='linear'?<>{range('k','斜率 k',-3,3,.1)}{range('b','截距 b',-4,4,.1)}</>:<label className="select-label">选择一个函数<select aria-label="选择函数" value={v.kind} onChange={e=>set('kind',Number(e.target.value))}><option value={0}>f(x) = x²</option><option value={1}>f(x) = 2x + 1</option><option value={2}>f(x) = |x|</option></select></label>}{range('x','输入 x',-3,3,.1)}</>}
    <div className="live-result"><small>{vectors?lesson.lab==='dot'?'点积 a · b':'向量和 a + b':'函数的输出'}</small><strong data-testid="lab-result">{vectors?lesson.lab==='dot'?format(product):`(${format(v.ax+v.bx)}, ${format(v.ay+v.by)})`:<>f({format(v.x)}) = <em>{format(result)}</em></>}</strong>{vectors&&<span>‖a‖ = {format(norm(a))} · ‖b‖ = {format(norm(b))}</span>}</div></div></div>
    <div className="lab-task"><div><span>试一试</span>{lesson.labTask}</div>{onObserve&&<button type="button" className="text-button observation-trigger" onClick={event=>onObserve(event.currentTarget)}>记录观察</button>}</div>
  </section>;
}
