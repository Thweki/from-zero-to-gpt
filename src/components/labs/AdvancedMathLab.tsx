import { useId, useRef, type ReactNode } from 'react';
import { FlaskConical, Maximize2, RotateCcw } from 'lucide-react';
import type { ExtendedLabProps } from '../../types';

type Vector2 = [number, number];
type Matrix2 = [Vector2, Vector2];
const GOLD = '#b48b48';
const BLUE = '#6e96ac';
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const fmt = (value: number, digits = 3) => !Number.isFinite(value) ? '未定义' : Math.abs(value) < 1e-10 ? '0' : Math.abs(value) >= 10000 ? value.toExponential(2) : Number(value.toFixed(digits)).toString();

export const advancedMathDefaults: Record<string, number> = {
  a: 2, b: -4, c: 10, x: 2, y: 1, window: 5, base: 1.1, exponent: 2, input: 8,
  rows: 2, cols: 3, cellrow: 1, cellcol: 1, cell: 1,
  a11: 1, a12: 1, a21: 0, a22: 1, bscale: 2, bshear: 1,
  prior: 0.01, sensitivity: 0.9, falsepositive: 0.05, n: 3, p: 0.5, view: 0,
  x1: -2, x2: 0, x3: 2, w1: 1, w2: 2, w3: 1, h: 0.5, point: 2, kind: 0,
  direction: 0.6, rate: 0.1, steps: 8, startx: 3, starty: 2,
};
export const advancedMathParameterKeys = Object.keys(advancedMathDefaults);

export function multiply2(a: Matrix2, b: Matrix2): Matrix2 {
  return [
    [a[0][0]*b[0][0]+a[0][1]*b[1][0], a[0][0]*b[0][1]+a[0][1]*b[1][1]],
    [a[1][0]*b[0][0]+a[1][1]*b[1][0], a[1][0]*b[0][1]+a[1][1]*b[1][1]],
  ];
}
export const apply2 = (a: Matrix2, v: Vector2): Vector2 => [a[0][0]*v[0]+a[0][1]*v[1], a[1][0]*v[0]+a[1][1]*v[1]];
export function binomialProbabilities(n: number, p: number): number[] {
  if (!Number.isInteger(n) || n < 0 || p < 0 || p > 1) throw new Error('无效的二项分布参数');
  let choose = 1;
  return Array.from({length:n+1}, (_, k) => {
    if (k > 0) choose = choose * (n-k+1) / k;
    return choose * p**k * (1-p)**(n-k);
  });
}
export function weightedMoments(xs: number[], weights: number[]) {
  if (!xs.length || xs.length !== weights.length || weights.some(w => w < 0)) throw new Error('需要等长的非负权重');
  const total = weights.reduce((a, b) => a+b, 0);
  if (total === 0) return null;
  const probabilities = weights.map(w => w/total);
  const mean = xs.reduce((sum, x, i) => sum+x*probabilities[i], 0);
  const variance = xs.reduce((sum, x, i) => sum+(x-mean)**2*probabilities[i], 0);
  return {probabilities, mean, variance, std:Math.sqrt(variance)};
}
export function descentPath(start: Vector2, rate: number, steps: number): Vector2[] {
  if (rate <= 0 || !Number.isInteger(steps) || steps < 0) throw new Error('学习率须为正，步数须为非负整数');
  const path: Vector2[] = [[...start]];
  let [x,y] = start;
  for (let i=0; i<steps; i++) {
    const gx=2*(x-1), gy=4*(y+1);
    [x,y]=[x-rate*gx,y-rate*gy];
    path.push([x,y]);
  }
  return path;
}
export function classifyCriticalPoint(first: number, second: number, tolerance = 1e-8) {
  if (Math.abs(first)>tolerance) return '非驻点';
  if (second>tolerance) return '严格局部最小';
  if (second<-tolerance) return '严格局部最大';
  return '二阶检验无法决定';
}

function defaultsFor(id: string): Record<string,number> {
  const overrides:Record<string,Record<string,number>> = {
    logarithms:{base:2}, coordinates:{x:2,y:3}, 'chain-rule':{a:3,b:1},
    'partial-derivatives':{x:1,y:2}, gradients:{x:1,y:2}, optimization:{point:0},
  };
  return {...advancedMathDefaults,...overrides[id]};
}
const bounds: Record<string,[number,number,number?]> = {
  a:[-5,5],b:[-5,5],c:[-10,12],x:[-5,5],y:[-5,5],window:[2,10],
  base:[0.1,4],exponent:[-4,6],input:[0.1,16], rows:[1,4,1],cols:[1,4,1],
  cellrow:[1,4,1],cellcol:[1,4,1],cell:[-9,9],a11:[-3,3],a12:[-3,3],a21:[-3,3],a22:[-3,3],
  bscale:[-2,3],bshear:[-3,3],prior:[0,1],sensitivity:[0,1],falsepositive:[0,1],n:[0,12,1],p:[0,1],view:[0,1,1],
  x1:[-6,6],x2:[-6,6],x3:[-6,6],w1:[0,5],w2:[0,5],w3:[0,5],h:[-1,1],point:[-3,3],kind:[0,3,1],
  direction:[-Math.PI,Math.PI],rate:[0.01,0.8],steps:[0,20,1],startx:[-4,4],starty:[-4,4],
};
function valuesFor(id:string, values:Record<string,number>) {
  const v=defaultsFor(id);
  for(const key of advancedMathParameterKeys) {
    const value=values[key];
    if(Number.isFinite(value)) {
      const [lo,hi,integer]=bounds[key];
      v[key]=clamp(integer?Math.round(value):value,lo,hi);
    }
  }
  v.cellrow=Math.min(v.cellrow,v.rows); v.cellcol=Math.min(v.cellcol,v.cols);
  if(id==='distributions') v.x=clamp(v.x,0,2);
  if(id==='derivatives') v.h=clamp(v.h,0.01,1);
  if(id==='optimization') v.point=clamp(v.point,-2,2);
  return v;
}

type ChartPoint={at:Vector2;label?:string;color?:string;radius?:number};
type ChartSegment={from:Vector2;to:Vector2;color?:string;dash?:boolean;arrow?:boolean};
type ChartCurve={fn:(x:number)=>number;color?:string;dash?:boolean};
type Projection={px:(x:number)=>number;py:(y:number)=>number};
function Cartesian({label,xmin=-5,xmax=5,ymin=-5,ymax=5,curves=[],points=[],segments=[],children}: {
  label:string; xmin?:number;xmax?:number;ymin?:number;ymax?:number;curves?:ChartCurve[];points?:ChartPoint[];segments?:ChartSegment[];
  children?:(project:Projection)=>ReactNode;
}) {
  const uid=useId().replace(/:/g,'');
  const px=(x:number)=>34+(x-xmin)/(xmax-xmin)*412, py=(y:number)=>264-(y-ymin)/(ymax-ymin)*232;
  const xticks=Array.from({length:5},(_,i)=>xmin+(xmax-xmin)*i/4), yticks=Array.from({length:5},(_,i)=>ymin+(ymax-ymin)*i/4);
  const path=(f:(x:number)=>number)=>{
    let started=false;
    return Array.from({length:241},(_,i)=>{
      const x=xmin+(xmax-xmin)*i/240, y=f(x);
      if(!Number.isFinite(y)){started=false;return '';}
      const command=started?'L':'M';started=true;
      return `${command}${px(x)} ${clamp(py(y),-100000,100000)}`;
    }).join(' ');
  };
  return <svg className="am-chart" viewBox="0 0 480 300" role="img" aria-label={label}>
    <title>{label}</title><defs><clipPath id={`am-clip-${uid}`}><rect x="34" y="32" width="412" height="232"/></clipPath><marker id={`am-arrow-${uid}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="context-stroke"/></marker></defs>
    {xticks.map((n,i)=><g key={`x${i}`}><path d={`M${px(n)} 32V264`} stroke="var(--grid)"/><text x={px(n)} y="282" textAnchor="middle">{fmt(n,1)}</text></g>)}
    {yticks.map((n,i)=><g key={`y${i}`}><path d={`M34 ${py(n)}H446`} stroke="var(--grid)"/><text x="27" y={py(n)+3} textAnchor="end">{fmt(n,1)}</text></g>)}
    {xmin<=0&&xmax>=0&&<path d={`M${px(0)} 32V264`} stroke="var(--axis)"/>}{ymin<=0&&ymax>=0&&<path d={`M34 ${py(0)}H446`} stroke="var(--axis)"/>}
    <text x="453" y="280">x</text><text x="18" y="22">y</text>
    <g clipPath={`url(#am-clip-${uid})`}>
      {children?.({px,py})}
      {curves.map((curve,i)=><path key={i} d={path(curve.fn)} fill="none" stroke={curve.color??'var(--accent)'} strokeWidth="2.5" strokeDasharray={curve.dash?'6 4':undefined}/>)}
      {segments.map((line,i)=><path key={i} d={`M${px(line.from[0])} ${py(line.from[1])}L${px(line.to[0])} ${py(line.to[1])}`} fill="none" stroke={line.color??'var(--accent)'} strokeWidth="2" strokeDasharray={line.dash?'5 4':undefined} markerEnd={line.arrow?`url(#am-arrow-${uid})`:undefined}/>)}
      {points.map((point,i)=><g key={i}><circle cx={px(point.at[0])} cy={py(point.at[1])} r={point.radius??4.5} fill={point.color??'var(--accent)'} stroke="var(--panel)" strokeWidth="1.5"/>{point.label&&<text x={px(point.at[0])+7} y={py(point.at[1])-8} className="am-point-label">{point.label}</text>}</g>)}
    </g>
  </svg>;
}
function Bars({probs,labels,label}:{probs:number[];labels:string[];label:string}) {
  const high=Math.max(0.2,...probs)*1.15, slot=410/probs.length;
  return <svg className="am-chart" viewBox="0 0 480 300" role="img" aria-label={label}><title>{label}</title>
    {[0,0.25,0.5,0.75,1].filter(y=>y<=high).map(y=><g key={y}><path d={`M38 ${252-y/high*200}H450`} stroke="var(--grid)"/><text x="31" y={256-y/high*200} textAnchor="end">{fmt(y,2)}</text></g>)}
    {probs.map((p,i)=><g key={i}><rect x={40+slot*i+slot*.15} y={252-p/high*200} width={slot*.7} height={p/high*200} rx="3" fill="var(--accent)" opacity=".8"/><text x={40+slot*(i+.5)} y={243-p/high*200} textAnchor="middle">{fmt(p,3)}</text><text x={40+slot*(i+.5)} y="275" textAnchor="middle">{labels[i]}</text></g>)}
    <path d="M38 252H450" stroke="var(--axis)"/><text x="38" y="24">概率 P</text></svg>;
}
function MatrixView({matrix,label}:{matrix:number[][];label:string}) {
  return <div className="am-matrix"><span>{label}</span><table aria-label={label}><tbody>{matrix.map((row,i)=><tr key={i}>{row.map((n,j)=><td key={j}>{fmt(n)}</td>)}</tr>)}</tbody></table></div>;
}
const loss=(x:number,y:number)=>(x-1)**2+2*(y+1)**2;
const surface=(x:number,y:number)=>x*x+x*y+2*y*y;

export function AdvancedMathLab({lesson,values,onChange}:ExtendedLabProps) {
  const ref=useRef<HTMLElement>(null);
  const v=valuesFor(lesson.id,values);
  const set=(key:string,value:number)=>onChange({...v,[key]:value});
  const preset=(patch:Record<string,number>)=>onChange({...v,...patch});
  const range=(key:string,label:string,min:number,max:number,step=0.1)=><label className="am-range" key={key}><span>{label}<output>{fmt(v[key])}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={v[key]} onChange={e=>set(key,Number(e.target.value))}/><small><span>{fmt(min)}</span><span>{fmt(max)}</span></small></label>;
  const select=(key:string,label:string,options:string[])=><label className="am-select" key={key}>{label}<select aria-label={label} value={v[key]} onChange={e=>set(key,Number(e.target.value))}>{options.map((text,i)=><option value={i} key={i}>{text}</option>)}</select></label>;
  const stat=(label:string,value:ReactNode)=><div className="am-stat" key={label}><span>{label}</span><strong>{value}</strong></div>;
  let visual:ReactNode, controls:ReactNode, result:ReactNode, caption:string;

  if(lesson.id==='algebra') {
    const unique=v.a!==0, solution=unique?(v.c-v.b)/v.a:NaN;
    const bound=Number.isFinite(solution)?Math.max(6,Math.min(20,Math.abs(solution)+2)):6;
    visual=<Cartesian label="ax+b 与水平线 c 的交点" xmin={-bound} xmax={bound} ymin={-12} ymax={14} curves={[{fn:x=>v.a*x+v.b},{fn:()=>v.c,color:GOLD,dash:true}]} points={unique?[{at:[solution,v.c],label:`x=${fmt(solution)}`}]:[]}/>;
    controls=<>{range('a','系数 a',-5,5,0.5)}{range('b','常数 b',-5,5,0.5)}{range('c','右侧 c',-10,12,0.5)}</>;
    result=<>{stat('解的情况',unique?`唯一解 x=${fmt(solution)}`:v.b===v.c?'无穷多解':'无解')}{unique&&stat('代回残差 a·x+b−c',fmt(v.a*solution+v.b-v.c))}</>;
    caption='绿线 y=ax+b · 金色虚线 y=c；交点超出当前窗口时仍在结果中给出。';
  } else if(lesson.id==='coordinates') {
    const px=480*(v.x+v.window)/(2*v.window),py=300*(v.window-v.y)/(2*v.window);
    visual=<Cartesian label="数学点在所选窗口中的位置" xmin={-v.window} xmax={v.window} ymin={-v.window} ymax={v.window} points={[{at:[v.x,v.y],label:`(${fmt(v.x)},${fmt(v.y)})`}]} segments={[{from:[v.x,0],to:[v.x,v.y],dash:true},{from:[0,v.y],to:[v.x,v.y],dash:true}]}/>;
    controls=<>{range('x','数学坐标 x',-5,5)}{range('y','数学坐标 y',-5,5)}{range('window','窗口半宽（两轴）',2,10,1)}</>;
    result=<>{stat('数学坐标',`(${fmt(v.x)}, ${fmt(v.y)})`)}{stat('480×300 内容区域的像素',`(${fmt(px)}, ${fmt(py)})`)}<p>上方图的边框含有刻度留白；像素结果指完整 480×300 内容区域。区间外的点允许映射到画布外。</p></>;
    caption='数学 y 向上增长，像素 y 向下增长。固定数对只改变窗口，也会改变像素位置。';
  } else if(lesson.id==='powers') {
    const y=v.base**v.exponent;
    const ymax=Math.max(2,Math.min(100,Math.max(v.base**3,y)*1.15));
    visual=<Cartesian label="正底数指数函数与当前指数对应的值" xmin={-4} xmax={6} ymin={0} ymax={ymax} curves={[{fn:x=>v.base**x}]} points={[{at:[v.exponent,y],label:`${fmt(v.base)}^${fmt(v.exponent)}=${fmt(y)}`}]} />;
    controls=<>{range('base','正底数 r',0.1,4,0.1)}{range('exponent','指数 n',-4,6,0.25)}</>;
    result=<>{stat('rⁿ',fmt(y))}{stat('初始值100对应的数量',fmt(100*y))}{stat('相邻一轮的比率',fmt(v.base))}</>;
    caption='绿线 y=rˣ。横轴允许实数指数；离散轮数增长只读取其中非负整数点。大数可能超出显示窗口。';
  } else if(lesson.id==='logarithms') {
    const valid=v.base!==1, output=valid?Math.log(v.input)/Math.log(v.base):NaN;
    visual=<Cartesian label="对数函数及其反向指数检查" xmin={0} xmax={16} ymin={-5} ymax={5} curves={valid?[{fn:x=>x>0?Math.log(x)/Math.log(v.base):NaN}]:[]} points={valid?[{at:[v.input,output],label:`log=${fmt(output)}`}]:[]} />;
    controls=<>{range('base','对数底数 b',0.1,4,0.1)}{range('input','正真数 x',0.1,16,0.1)}</>;
    result=valid?<>{stat('log_b(x)',fmt(output))}{stat('还原 b^(log_b x)',fmt(v.base**output))}{stat('自然对数 ln x',fmt(Math.log(v.input)))}</>:<p className="am-warning">底数为 1 时指数函数不可逆，对数未定义。请选择另一个正底数。</p>;
    caption='底数大于1时递增，介于0与1时递减；图中只画真数为正的部分。';
  } else if(lesson.id==='matrices') {
    const matrix=Array.from({length:v.rows},(_,i)=>Array.from({length:v.cols},(_,j)=>i+1===v.cellrow&&j+1===v.cellcol?v.cell:i*v.cols+j+1));
    const transpose=Array.from({length:v.cols},(_,j)=>Array.from({length:v.rows},(_,i)=>matrix[i][j]));
    visual=<div className="am-shape-demo"><div className="am-formula">Aᵢⱼ → (Aᵀ)ⱼᵢ</div><div className="am-matrices"><MatrixView matrix={matrix} label={`A：${v.rows}×${v.cols}`}/><span className="am-transform-symbol" aria-hidden="true">→</span><MatrixView matrix={transpose} label={`Aᵀ：${v.cols}×${v.rows}`}/></div><p>选中 A[{v.cellrow},{v.cellcol}]={fmt(v.cell)}，在转置中位于 Aᵀ[{v.cellcol},{v.cellrow}]。这里下标从 1 开始。</p></div>;
    controls=<>{range('rows','行数 m',1,4,1)}{range('cols','列数 n',1,4,1)}{range('cellrow','编辑第几行',1,v.rows,1)}{range('cellcol','编辑第几列',1,v.cols,1)}{range('cell','选中元素的值',-9,9,1)}</>;
    result=<>{stat('原形状 → 转置形状',`(${v.rows},${v.cols}) → (${v.cols},${v.rows})`)}{stat('两者的元素总数',`${v.rows}×${v.cols}=${v.rows*v.cols}`)}</>;
    caption='行列交换，元素按索引搬到新位置。改变行数或列数会重新生成未编辑位置的顺序整数。';
  } else if(lesson.id==='matrix-multiplication'||lesson.id==='linear-geometry') {
    const productLesson=lesson.id==='matrix-multiplication';
    const a:Matrix2=[[v.a11,v.a12],[v.a21,v.a22]], b:Matrix2=[[v.bscale,0],[v.bshear,1]];
    const ab=multiply2(a,b),ba=multiply2(b,a),matrix=productLesson?ab:a;
    const input:Vector2=[v.x,v.y],output=apply2(matrix,input),other=apply2(ba,input),middle=apply2(b,input);
    const e1=apply2(a,[1,0]),e2=apply2(a,[0,1]),corner=apply2(a,[1,1]);
    const extent=Math.max(4,...output.map(Math.abs),...input.map(Math.abs),...(productLesson?[...other,...middle]:[...e1,...e2]).map(Math.abs))*1.15;
    const determinant=v.a11*v.a22-v.a12*v.a21;
    const segments:ChartSegment[]=productLesson?[
      {from:[0,0],to:input,color:'var(--axis)',arrow:true},
      {from:[0,0],to:middle,color:GOLD,arrow:true,dash:true},
      {from:[0,0],to:output,arrow:true},
      {from:[0,0],to:other,color:BLUE,arrow:true},
    ]:[{from:[0,0],to:input,color:GOLD,arrow:true},{from:[0,0],to:output,arrow:true},{from:[0,0],to:e1,color:BLUE,arrow:true},{from:[0,0],to:e2,color:BLUE,arrow:true}];
    visual=<><div className="am-matrices"><MatrixView matrix={a} label="A"/>{productLesson&&<><MatrixView matrix={b} label="B"/><MatrixView matrix={ab} label="AB"/><MatrixView matrix={ba} label="BA"/></>}</div>
      <Cartesian label={productLesson?'输入、Bv、ABv 与 BAv 的比较':'线性变换后的网格、基向量与输入向量'} xmin={-extent} xmax={extent} ymin={-extent} ymax={extent} segments={segments} points={[{at:output,label:productLesson?'ABv':'Av'},...(productLesson?[{at:other,label:'BAv',color:BLUE}]:[{at:e1,label:'Ae₁',color:BLUE},{at:e2,label:'Ae₂',color:BLUE}])]}>
      {({px,py})=>!productLesson&&<g><polygon points={[[0,0],e1,corner,e2].map(point=>`${px(point[0])},${py(point[1])}`).join(' ')} fill={GOLD} opacity=".18"/>{Array.from({length:7},(_,i)=>i-3).flatMap(n=>{
        const h1=apply2(a,[-3,n]),h2=apply2(a,[3,n]),v1=apply2(a,[n,-3]),v2=apply2(a,[n,3]);
        return [<path key={`h${n}`} d={`M${px(h1[0])} ${py(h1[1])}L${px(h2[0])} ${py(h2[1])}`} stroke="var(--accent)" opacity=".22"/>,<path key={`v${n}`} d={`M${px(v1[0])} ${py(v1[1])}L${px(v2[0])} ${py(v2[1])}`} stroke="var(--accent)" opacity=".22"/>];
      })}</g>}</Cartesian></>;
    controls=<>{range('a11','A 第1行第1列',-3,3,0.5)}{range('a12','A 第1行第2列',-3,3,0.5)}{range('a21','A 第2行第1列',-3,3,0.5)}{range('a22','A 第2行第2列',-3,3,0.5)}{productLesson&&<>{range('bscale','B 水平缩放',-2,3,0.5)}{range('bshear','B 垂直剪切',-3,3,0.5)}</>}{range('x','输入向量 x',-5,5,0.5)}{range('y','输入向量 y',-5,5,0.5)}<div className="am-presets"><span>A 的预设</span><button onClick={()=>preset({a11:1,a12:0,a21:0,a22:1})}>单位</button><button onClick={()=>preset({a11:0,a12:-1,a21:1,a22:0})}>旋转90°</button><button onClick={()=>preset({a11:1,a12:1,a21:0,a22:1})}>剪切</button><button onClick={()=>preset({a11:1,a12:1,a21:1,a22:1})}>压成线</button></div></>;
    result=productLesson?<>{stat('ABv = A(Bv)',`(${fmt(output[0])}, ${fmt(output[1])})`)}{stat('BAv',`(${fmt(other[0])}, ${fmt(other[1])})`)}<p>B=[[缩放,0],[剪切,1]]。两种次序通常不同；先作用的矩阵在右侧。</p></>:<>{stat('变换后 Av',`(${fmt(output[0])}, ${fmt(output[1])})`)}{stat('det A / 面积倍数',`${fmt(determinant)} / ${fmt(Math.abs(determinant))}`)}{stat('方向与可逆性',determinant===0?'压扁，不可逆':determinant<0?'方向翻转，可逆':'方向保持，可逆')}</>;
    caption=productLesson?'灰色 v · 金色 Bv · 绿色 ABv · 蓝色 BAv；所有箭头从同一个原点出发。':'金色为输入向量和单位方格的像，绿色为变换网格与输出，蓝色为两支基向量的像。';
  } else if(lesson.id==='probability') {
    const tp=v.prior*v.sensitivity,fn=v.prior*(1-v.sensitivity),fp=(1-v.prior)*v.falsepositive,tn=(1-v.prior)*(1-v.falsepositive);
    const positive=tp+fp,posterior=positive>0?tp/positive:NaN;
    const rows=[['患病且阳性',tp],['患病且阴性',fn],['健康且阳性',fp],['健康且阴性',tn]] as const;
    visual=<div className="am-probability"><div className="am-formula">P(患病 | 阳性) = 真阳性 / 全部阳性</div><p>假设总体有 10,000 人，下表是概率模型给出的期望人数，可含小数。</p><table className="am-counts"><thead><tr><th>联合事件</th><th>概率</th><th>期望人数</th></tr></thead><tbody>{rows.map(([label,p])=><tr key={label}><th>{label}</th><td>{fmt(p*100)}%</td><td>{fmt(p*10000,1)}</td></tr>)}</tbody></table><div className="am-posterior-label">只看阳性人群（重新作为分母）</div><div className="am-proportion" role="img" aria-label={positive?`阳性中真阳性占${fmt(posterior*100)}%，假阳性占${fmt((1-posterior)*100)}%`:'阳性事件概率为0，条件概率未定义'}>{positive>0?<><span style={{width:`${posterior*100}%`,background:'var(--accent)'}}/><span style={{width:`${(1-posterior)*100}%`,background:GOLD}}/></>:<span style={{width:'100%',background:'var(--grid)'}}/>}</div><div className="am-legend"><span>绿色 真阳性</span><span>金色 假阳性</span></div></div>;
    controls=<>{range('prior','患病先验 P(病)',0,1,0.01)}{range('sensitivity','灵敏度 P(阳|病)',0,1,0.01)}{range('falsepositive','假阳性率 P(阳|健康)',0,1,0.01)}</>;
    result=<>{stat('阳性概率',`${fmt(positive*100)}%`)}{stat('阳性后的患病概率',positive>0?`${fmt(posterior*100)}%`:'未定义：阳性概率为0')}<p>后验依赖先验和两类检测概率。灵敏度与“阳性中患病的比例”使用不同分母。</p></>;
    caption='以联合概率构造人数，再把阳性人群重新归一化；没有假设所有阳性都来自患者。';
  } else if(lesson.id==='distributions') {
    const probs=binomialProbabilities(v.n,v.p);
    const continuous=v.view===1;
    visual=continuous?<Cartesian label="U(0,2) 密度与从0到右端点的概率面积" xmin={-0.25} xmax={2.25} ymin={0} ymax={0.8} curves={[{fn:x=>x>=0&&x<=2?0.5:0}]}>{({px,py})=><rect x={px(0)} y={py(0.5)} width={px(v.x)-px(0)} height={py(0)-py(0.5)} fill="var(--accent)" opacity=".2"/>}</Cartesian>:<Bars probs={probs} labels={probs.map((_,k)=>String(k))} label="二项分布各成功次数的概率"/>;
    controls=<>{select('view','分布类型',['离散：二项分布','连续：均匀分布'])}{continuous?range('x','区间右端点 u（左端0）',0,2,0.05):<>{range('n','独立试验次数 n',0,12,1)}{range('p','每次成功概率 p',0,1,0.05)}</>}</>;
    result=continuous?<>{stat('密度 f(x)', '0.5（在0到2之间）')}{stat(`P(0≤X≤${fmt(v.x)})`,fmt(v.x/2))}{stat('任何指定单点的概率','0')}</>:<>{stat('概率和',fmt(probs.reduce((a,b)=>a+b,0),6))}{stat('均值 np',fmt(v.n*v.p))}{stat('方差 np(1−p)',fmt(v.n*v.p*(1-v.p)))}</>;
    caption=continuous?'绿色阴影面积是概率；曲线高度是密度。区间缩成一点，面积就变成0。':'横轴是成功次数 k，柱高是 P(X=k)。试验次数为0时，全部概率都在 k=0。';
  } else if(lesson.id==='expectation'||lesson.id==='variance') {
    const xs=[v.x1,v.x2,v.x3],moments=weightedMoments(xs,[v.w1,v.w2,v.w3]);
    visual=moments?<><Bars probs={moments.probabilities} labels={xs.map((x,i)=>`x${i+1}=${fmt(x)}`)} label="三种结果的归一化概率"/><div className="am-numberline" role="img" aria-label={`均值${fmt(moments.mean)}，标准差${fmt(moments.std)}`}><svg viewBox="0 0 480 92"><path d="M34 40H446" stroke="var(--axis)"/>{Array.from({length:5},(_,i)=>-6+3*i).map(x=><g key={x}><path d={`M${34+(x+6)/12*412} 36v8`} stroke="var(--axis)"/><text x={34+(x+6)/12*412} y="66" textAnchor="middle">{x}</text></g>)}<path d={`M${34+(Math.max(-6,moments.mean-moments.std)+6)/12*412} 40H${34+(Math.min(6,moments.mean+moments.std)+6)/12*412}`} stroke={GOLD} strokeWidth="7" opacity=".45"/>{xs.map((x,i)=><circle key={i} cx={34+(x+6)/12*412} cy="40" r={3+moments.probabilities[i]*9} fill="var(--accent)" opacity=".55"/>)}<path d={`M${34+(moments.mean+6)/12*412} 20v32`} stroke="var(--accent)" strokeWidth="2.5"/><text x={34+(moments.mean+6)/12*412} y="15" textAnchor="middle">μ={fmt(moments.mean)}</text></svg></div></>:<div className="am-empty">三个权重都为0，无法归一化。请将至少一个权重设为正。</div>;
    controls=<>{range('x1','结果 x₁',-6,6,0.5)}{range('w1','结果1的原始权重',0,5,0.25)}{range('x2','结果 x₂',-6,6,0.5)}{range('w2','结果2的原始权重',0,5,0.25)}{range('x3','结果 x₃',-6,6,0.5)}{range('w3','结果3的原始权重',0,5,0.25)}</>;
    result=moments?<>{stat('期望 μ=Σpᵢxᵢ',fmt(moments.mean))}{stat('方差 Σpᵢ(xᵢ−μ)²',fmt(moments.variance))}{stat('标准差 σ',fmt(moments.std))}<p>概率 pᵢ=权重ᵢ/权重总和。各结果的期望贡献：{xs.map((x,i)=>fmt(x*moments.probabilities[i])).join(' + ')}。</p></>:<p className="am-warning">总权重为0时，期望、方差和标准差都未定义。</p>;
    caption='柱高表示概率，下面的数轴表示结果位置；绿色竖线为均值，金色线段为 μ±σ（超出数轴部分裁剪）。';
  } else if(lesson.id==='limits') {
    const jump=v.view===1,h=v.h,slope=h!==0?2*v.point+h:NaN;
    visual=jump?<Cartesian label="左右趋近0时分别接近0和1的跳跃函数" xmin={-2} xmax={2} ymin={-0.3} ymax={1.5} curves={[{fn:x=>x<0?0:NaN},{fn:x=>x>0?1:NaN,color:GOLD}]} points={h!==0?[{at:[-Math.abs(h),0],label:'左侧值 0'},{at:[Math.abs(h),1],label:'右侧值 1',color:GOLD}]:[]}/>:<Cartesian label="平方函数两点间的割线与极限斜率" xmin={-4} xmax={4} ymin={-1} ymax={18} curves={[{fn:x=>x*x},...(h!==0?[{fn:(x:number)=>v.point**2+slope*(x-v.point),color:GOLD,dash:true}]:[])]} points={[{at:[v.point,v.point**2],label:'固定点'},...(h!==0?[{at:[v.point+h,(v.point+h)**2] as Vector2,label:'移动点',color:GOLD}]:[])]}/>;
    controls=<>{select('view','观察对象',['平方函数差商','左右极限不同的函数'])}{!jump&&range('point','固定输入 x',-3,3,0.1)}{range('h',jump?'趋近步长 h（取绝对值）':'有符号步长 h',-1,1,0.01)}</>;
    result=jump?<>{stat('左极限 / 右极限','0 / 1')}{stat('双侧极限','不存在：两侧不同')}{h===0&&<p>当前 h=0，不采样目标点；请用非零步长观察左右附近。</p>}</>:<>{stat('有限 h 的割线斜率',h!==0?fmt(slope):'未定义：不能除以0')}{stat('h→0 的极限',fmt(2*v.point))}{stat('与极限的误差',h!==0?fmt(Math.abs(h)):'差商在h=0不计算')}</>;
    caption=jump?'左侧绿线的值为0，右侧金线的值为1，x=0处不定义；目标点本身不参与极限判断。':'绿线 y=x²，金色虚线为两点割线。让 h 从正负两侧接近0，比较同一个斜率极限。';
  } else if(lesson.id==='derivatives') {
    const kinds=[{name:'x²',f:(x:number)=>x*x,d:(x:number)=>2*x},{name:'x³',f:(x:number)=>x**3,d:(x:number)=>3*x*x},{name:'|x|',f:(x:number)=>Math.abs(x),d:(x:number)=>x===0?NaN:Math.sign(x)},{name:'sin x',f:Math.sin,d:Math.cos}];
    const current=kinds[v.kind],a=v.point,h=v.h,fa=current.f(a),analytic=current.d(a),left=current.f(a-h),right=current.f(a+h),estimate=(right-left)/(2*h);
    const ymin=v.kind===1?-32:v.kind===3?-2:-1,ymax=v.kind===1?32:v.kind===0?17:v.kind===2?5:2;
    const curves:ChartCurve[]=[{fn:current.f},{fn:x=>left+estimate*(x-a+h),color:GOLD,dash:true}];
    if(Number.isFinite(analytic))curves.push({fn:x=>fa+analytic*(x-a),color:BLUE,dash:true});
    visual=<Cartesian label={`${current.name} 的切线与中心割线`} xmin={-3.5} xmax={3.5} ymin={ymin} ymax={ymax} curves={curves} points={[{at:[a,fa],label:'切点'},{at:[a-h,left],color:GOLD},{at:[a+h,right],color:GOLD}]}/>;
    controls=<>{select('kind','函数',['f(x)=x²','f(x)=x³','f(x)=|x|','f(x)=sin x'])}{range('point','切点 a',-3,3,0.1)}{range('h','正步长 h',0.01,1,0.01)}</>;
    result=<>{stat('解析导数 f′(a)',Number.isFinite(analytic)?fmt(analytic):'不存在：左右导数不同')}{stat('中心差分近似',fmt(estimate))}{Number.isFinite(analytic)?stat('差分绝对误差',fmt(Math.abs(estimate-analytic),6)):<p className="am-warning">对称差分在尖角得到0，但这不是存在的导数。左导数为−1，右导数为1。</p>}</>;
    caption='绿线为函数，蓝色虚线为解析切线，金色虚线通过左右采样点。两条直线重合时只显出最上层颜色。';
  } else if(lesson.id==='chain-rule') {
    const u=v.a*v.x+v.b,outer=2*u,dx=outer*v.a,da=outer*v.x,db=outer,y=u*u;
    const top=Math.max(10,y*1.25,(v.a*2+v.b)**2,(-v.a*2+v.b)**2);
    visual=<><div className="am-chain" aria-label="复合函数计算路径"><div><small>输入</small><strong>x={fmt(v.x)}</strong></div><span>×a，+b<br/>局部导数 {fmt(v.a)}</span><div><small>中间值</small><strong>u={fmt(u)}</strong></div><span>平方<br/>局部导数 {fmt(outer)}</span><div><small>输出</small><strong>y={fmt(y)}</strong></div></div><Cartesian label="复合函数 (ax+b)平方与当前位置切线" xmin={-5} xmax={5} ymin={0} ymax={top} curves={[{fn:x=>(v.a*x+v.b)**2},{fn:x=>y+dx*(x-v.x),color:GOLD,dash:true}]} points={[{at:[v.x,y],label:'当前输入'}]}/></>;
    controls=<>{range('x','输入 x',-5,5,0.1)}{range('a','内层系数 a',-5,5,0.1)}{range('b','内层偏置 b',-5,5,0.1)}</>;
    result=<>{stat('dy/dx=(2u)·a',fmt(dx))}{stat('dy/da=(2u)·x',fmt(da))}{stat('dy/db=2u',fmt(db))}<p>外层敏感度 {fmt(outer)} 与对应局部导数相乘；选择不同自变量，会得到不同的反向结果。</p></>;
    caption='上方保留前向中间值，下方金色切线用总导数。a=0会切断输入x对输出的影响。';
  } else if(lesson.id==='partial-derivatives'||lesson.id==='gradients') {
    const gradientLesson=lesson.id==='gradients',gx=2*v.x+v.y,gy=v.x+4*v.y,norm=Math.hypot(gx,gy),unit:Vector2=[Math.cos(v.direction),Math.sin(v.direction)],directional=gx*unit[0]+gy*unit[1];
    const location:Vector2=[v.x,v.y];
    const segments:ChartSegment[]=gradientLesson?[
      {from:location,to:[v.x+unit[0]*1.4,v.y+unit[1]*1.4],color:GOLD,arrow:true},
      ...(norm>0?[{from:location,to:[v.x+gx/norm*1.4,v.y+gy/norm*1.4] as Vector2,arrow:true}]:[]),
    ]:[{from:location,to:[v.x+1.4,v.y],color:GOLD,arrow:true},{from:location,to:[v.x,v.y+1.4],color:BLUE,arrow:true}];
    visual=<Cartesian label={gradientLesson?'二次曲面的等高线、梯度方向和所选单位方向':'二次曲面等高线与两个坐标截面的方向'} xmin={-6} xmax={6} ymin={-6} ymax={6} points={[{at:location,label:`f=${fmt(surface(v.x,v.y))}`}]} segments={segments}>{({px,py})=><g>{[1,3,6,12,24,40,70].map(level=>{
      const r=Math.sqrt(level),points=Array.from({length:121},(_,i)=>{const theta=2*Math.PI*i/120,y=2*r/Math.sqrt(7)*Math.sin(theta),x=r*Math.cos(theta)-y/2;return `${px(x)},${py(y)}`;}).join(' ');
      return <polyline key={level} points={points} fill="none" stroke="var(--accent)" strokeWidth="1.3" opacity=".32"/>;
    })}{!gradientLesson&&<><path d={`M34 ${py(v.y)}H446`} stroke={GOLD} strokeDasharray="5 4" opacity=".5"/><path d={`M${px(v.x)} 32V264`} stroke={BLUE} strokeDasharray="5 4" opacity=".5"/></>}</g>}</Cartesian>;
    controls=<>{range('x','当前位置 x',-5,5,0.1)}{range('y','当前位置 y',-5,5,0.1)}{gradientLesson&&range('direction','单位方向角 θ（弧度）',-Math.PI,Math.PI,0.01)}</>;
    result=gradientLesson?<>{stat('梯度 ∇f',`(${fmt(gx)}, ${fmt(gy)})`)}{stat('梯度长度',fmt(norm))}{stat('单位方向 u',`(${fmt(unit[0])}, ${fmt(unit[1])})`)}{stat('方向导数 ∇f·u',fmt(directional))}{stat('同位置的最小方向导数',fmt(-norm))}</>:<>{stat('固定 y 时的 x 偏导',fmt(gx))}{stat('固定 x 时的 y 偏导',fmt(gy))}{stat('仅 x 增加0.01：预测 / 实际',`${fmt(gx*0.01,5)} / ${fmt(surface(v.x+0.01,v.y)-surface(v.x,v.y),5)}`)}{stat('仅 y 增加0.01：预测 / 实际',`${fmt(gy*0.01,5)} / ${fmt(surface(v.x,v.y+0.01)-surface(v.x,v.y),5)}`)}</>;
    caption=gradientLesson?'等高线 f=x²+xy+2y²；绿色箭头为梯度方向，金色为所选单位方向。箭头显示长度相同，数值长度单独列出。':'等高线 f=x²+xy+2y²；金色水平线固定y，蓝色竖线固定x，箭头说明取截面的坐标方向。';
  } else if(lesson.id==='optimization') {
    const functions=[
      {name:'(x²−1)²',f:(x:number)=>(x*x-1)**2,first:(x:number)=>4*x*(x*x-1),second:(x:number)=>12*x*x-4,stationary:[-1,0,1],ymin:-1,ymax:11},
      {name:'x³',f:(x:number)=>x**3,first:(x:number)=>3*x*x,second:(x:number)=>6*x,stationary:[0],ymin:-9,ymax:9},
      {name:'x⁴',f:(x:number)=>x**4,first:(x:number)=>4*x**3,second:(x:number)=>12*x*x,stationary:[0],ymin:-1,ymax:17},
      {name:'−x²',f:(x:number)=>-x*x,first:(x:number)=>-2*x,second:()=>-2,stationary:[0],ymin:-5,ymax:1},
    ];
    const current=functions[v.kind],x=clamp(v.point,-2,2),height=current.f(x),first=current.first(x),second=current.second(x);
    visual=<Cartesian label={`${current.name} 的地形、驻点和当前位置切线`} xmin={-2.1} xmax={2.1} ymin={current.ymin} ymax={current.ymax} curves={[{fn:current.f},{fn:t=>height+first*(t-x),color:GOLD,dash:true}]} points={[...current.stationary.map(p=>({at:[p,current.f(p)] as Vector2,color:BLUE,label:'驻点'})),{at:[x,height],label:'当前点'}]}/>;
    controls=<>{select('kind','损失地形',['双井：(x²−1)²','水平穿过：x³','平坦谷底：x⁴','山顶：−x²'])}{range('point','检查位置 x',-2,2,0.1)}<div className="am-presets"><button onClick={()=>preset({point:-1})}>x=−1</button><button onClick={()=>preset({point:0})}>x=0</button><button onClick={()=>preset({point:1})}>x=1</button></div></>;
    result=<>{stat('当前位置损失',fmt(height))}{stat('一阶导数 / 二阶导数',`${fmt(first)} / ${fmt(second)}`)}{stat('二阶检验',classifyCriticalPoint(first,second))}{v.kind===0&&<p>该函数处处非负，在 ±1 达到0，所以两处也是全局最小。x=0虽然一阶导数为0，却是局部最大。</p>}{(v.kind===1||v.kind===2)&&Math.abs(x)<1e-8&&<p>二阶信息相同但图像不同：x³ 在0不是极值，x⁴ 在0是全局最小。二阶检验对此保留不确定。</p>}</>;
    caption='蓝点是解析驻点，绿点是当前位置，金色虚线是切线。分类只说明当前位置的局部检验。';
  } else {
    const path=descentPath([v.startx,v.starty],v.rate,v.steps),last=path[path.length-1],losses=path.map(([x,y])=>loss(x,y)),maxLoss=Math.max(1,...losses),outside=Math.abs(last[0])>6||Math.abs(last[1])>6;
    const segments=path.slice(1).map((point,i)=>({from:path[i],to:point,arrow:true}));
    visual=<><Cartesian label="梯度下降在损失等高线上的真实迭代轨迹" xmin={-6} xmax={6} ymin={-6} ymax={6} segments={segments} points={[{at:path[0],label:'起点',color:GOLD},{at:[1,-1],label:'最小点',color:BLUE},...path.slice(1).filter(([x,y])=>Math.abs(x)<=6&&Math.abs(y)<=6).map((point,i)=>({at:point,radius:3,label:i===path.length-2?'末点':undefined}))]}>{({px,py})=><g>{[0.5,2,6,12,24,50,90].map(level=><ellipse key={level} cx={px(1)} cy={py(-1)} rx={Math.sqrt(level)/12*412} ry={Math.sqrt(level/2)/12*232} fill="none" stroke="var(--accent)" opacity=".28"/>)}</g>}</Cartesian><div className="am-loss-history"><span>每步损失 L（从初始位置算起）</span><div>{losses.map((value,i)=><span key={i} title={`第${i}步：${fmt(value)}`} style={{height:`${Math.max(2,value/maxLoss*68)}px`}}/>)}</div><small>0 步 → {v.steps} 步 · 柱高共用线性尺度</small></div></>;
    controls=<>{range('startx','起点 x',-4,4,0.5)}{range('starty','起点 y',-4,4,0.5)}{range('rate','学习率 η',0.01,0.8,0.01)}{range('steps','显示迭代步数',0,20,1)}<div className="am-presets"><button disabled={v.steps>=20} onClick={()=>set('steps',v.steps+1)}>前进一步</button><button onClick={()=>set('steps',0)}>回到起点</button><button onClick={()=>preset({rate:0.45})}>振荡收敛</button><button onClick={()=>preset({rate:0.6})}>观察发散</button></div></>;
    result=<>{stat('末点 (x,y)',`(${fmt(last[0])}, ${fmt(last[1])})`)}{stat('初始损失 → 当前损失',`${fmt(losses[0])} → ${fmt(losses[losses.length-1])}`)}{stat('x / y 误差每步的因子',`${fmt(1-2*v.rate)} / ${fmt(1-4*v.rate)}`)}{stat('当前学习率的一般稳定性',v.rate<0.5?'两方向误差都会收缩':v.rate===0.5?'y误差幅度通常不减':'y误差通常放大')}{outside&&<p className="am-warning">末点已超出图中 ±6 的窗口，计算仍保留完整轨迹与损失。增大学习率可能使参数迅速发散。</p>}</>;
    caption='地形 L=(x−1)²+2(y+1)²；金点起点、蓝点最小值、绿线更新轨迹。调整起点或学习率会重新计算整条轨迹。';
  }
  return <section className="am-lab" ref={ref} aria-label={`${lesson.title}交互实验`}>
    <style>{labStyles}</style>
    <div className="am-header"><span><FlaskConical size={16}/>交互实验 <small>LIVE</small></span><div><button type="button" aria-label="重置本章数学实验" onClick={()=>onChange(defaultsFor(lesson.id))}><RotateCcw size={16}/></button><button type="button" aria-label="全屏数学实验" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void ref.current?.requestFullscreen?.();}}><Maximize2 size={16}/></button></div></div>
    <div className="am-body"><div className="am-visual">{visual}<p className="am-caption">{caption}</p></div><div className="am-controls">{controls}</div></div>
    <div className="am-results" aria-live="polite" data-testid="lab-result">{result}</div>
    <div className="am-task"><strong>试一试</strong><p>{lesson.labTask}</p></div>
  </section>;
}

const labStyles=`
.am-lab{border:1px solid var(--border);border-radius:9px;background:var(--panel);overflow:hidden;margin:26px 0;color:var(--text)}
.am-header{display:flex;justify-content:space-between;align-items:center;padding:11px 15px;background:var(--panel-soft);border-bottom:1px solid var(--border)}
.am-header>span{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--secondary)}.am-header small{font-size:8px;letter-spacing:1px;color:var(--accent);background:var(--accent-soft);padding:1px 5px;border-radius:3px}.am-header>div{display:flex;gap:5px}.am-header button{display:grid;place-items:center;min-width:30px;min-height:30px;border-radius:5px;color:var(--secondary)}.am-header button:hover{background:var(--accent-soft)}
.am-body{display:grid;grid-template-columns:minmax(0,1fr) 190px}.am-visual{min-width:0;padding:16px 12px 12px}.am-chart{width:100%;height:auto;display:block;overflow:hidden}.am-chart text,.am-numberline text{font-size:10px;font-family:'IBM Plex Mono',Consolas,monospace;fill:var(--secondary)}.am-chart text.am-point-label{fill:var(--text);font-size:10px;paint-order:stroke;stroke:var(--panel);stroke-width:3px;stroke-linejoin:round}.am-caption{font-size:10px;line-height:1.9;color:var(--secondary);margin:8px 7px 0}.am-controls{background:var(--panel-soft);padding:18px 16px;border-left:1px solid var(--border);display:flex;flex-direction:column;gap:15px}.am-range{display:block;font-size:10px}.am-range>span{display:flex;justify-content:space-between;align-items:center;gap:7px;color:var(--secondary)}.am-range output{font-family:'IBM Plex Mono',Consolas,monospace;font-size:11px;color:var(--accent-dark);background:var(--accent-soft);padding:0 5px;border-radius:3px;min-width:30px;text-align:center}.am-range input{display:block;width:100%;accent-color:var(--accent);margin:10px 0 4px;cursor:pointer;min-height:18px}.am-range small{display:flex;justify-content:space-between;font-size:8px;color:var(--muted)}.am-select{font-size:10px;color:var(--secondary)}.am-select select{display:block;width:100%;margin-top:7px;border:1px solid var(--border);border-radius:5px;background:var(--panel);padding:7px 5px;font-size:10px;min-height:34px}.am-presets{display:flex;flex-wrap:wrap;gap:6px}.am-presets>span{width:100%;font-size:10px;color:var(--secondary)}.am-presets button{border:1px solid var(--border);border-radius:5px;font-size:10px;padding:6px 8px;background:var(--panel);min-height:32px}.am-presets button:hover{border-color:var(--accent);background:var(--accent-soft)}
.am-results{display:flex;gap:14px 24px;flex-wrap:wrap;padding:16px 19px;border-top:1px solid var(--border);background:var(--accent-soft)}.am-stat{min-width:130px;flex:1}.am-stat>span{display:block;color:var(--secondary);font-size:10px;margin-bottom:3px}.am-stat strong{font-size:13px;font-weight:550;overflow-wrap:anywhere;font-family:'IBM Plex Mono',Consolas,monospace}.am-results p{width:100%;font-size:11px;line-height:1.9;color:var(--secondary)}.am-results .am-warning{color:var(--text);border-left:3px solid ${GOLD};padding-left:12px}.am-task{display:flex;gap:14px;padding:14px 18px;border-top:1px solid var(--border);font-size:11px;line-height:1.95}.am-task strong{white-space:nowrap;color:var(--accent-dark);font-size:10px}.am-task p{color:var(--secondary)}
.am-formula{font-family:'IBM Plex Mono',Consolas,monospace;text-align:center;font-size:14px;color:var(--accent-dark);padding:12px 0}.am-matrices{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin:6px 0 10px}.am-matrix{text-align:center;max-width:100%;overflow:auto}.am-matrix>span{font-size:10px;color:var(--secondary);display:block;margin-bottom:5px}.am-matrix table{border-left:2px solid var(--axis);border-right:2px solid var(--axis);border-radius:5px;margin:auto;border-spacing:7px 3px;font-family:'IBM Plex Mono',Consolas,monospace;font-size:12px}.am-matrix td{min-width:16px;text-align:right;padding:1px 3px}.am-transform-symbol{color:var(--muted)}.am-shape-demo{padding:15px 8px;min-height:300px;display:flex;flex-direction:column;justify-content:center;gap:15px}.am-shape-demo p,.am-probability>p{font-size:11px;line-height:1.9;color:var(--secondary);text-align:center}.am-counts{width:100%;border-collapse:collapse;margin:17px 0;font-size:11px}.am-counts th,.am-counts td{text-align:right;border-bottom:1px solid var(--border);padding:9px 6px;font-weight:400}.am-counts th:first-child{text-align:left}.am-counts thead{color:var(--secondary)}.am-posterior-label{font-size:11px;color:var(--secondary);margin:18px 0 9px}.am-proportion{width:100%;height:30px;display:flex;border-radius:5px;overflow:hidden}.am-proportion span{height:100%;display:block}.am-legend{display:flex;justify-content:space-between;font-size:10px;color:var(--secondary);margin:7px 0 10px}.am-probability{padding:5px 12px 13px}.am-numberline svg{width:100%;height:auto;display:block}.am-empty{min-height:310px;display:grid;place-items:center;text-align:center;font-size:12px;line-height:2;padding:30px;color:var(--secondary)}.am-chain{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:9px 2px}.am-chain>div{background:var(--accent-soft);border:1px solid var(--border);border-radius:6px;padding:9px 10px;text-align:center}.am-chain small{font-size:9px;color:var(--secondary);display:block}.am-chain strong{font-family:'IBM Plex Mono',Consolas,monospace;font-size:12px;font-weight:500}.am-chain>span{font-size:9px;line-height:1.7;text-align:center;color:var(--secondary)}.am-loss-history{padding:2px 24px 8px}.am-loss-history>span{font-size:10px;color:var(--secondary)}.am-loss-history>div{height:79px;display:flex;align-items:end;gap:3px;border-bottom:1px solid var(--axis);margin-top:4px}.am-loss-history>div>span{flex:1;max-width:26px;background:var(--accent);border-radius:3px 3px 0 0;opacity:.7}.am-loss-history small{font-size:9px;color:var(--secondary)}
.am-lab:fullscreen{background:var(--panel);border:0;border-radius:0;padding:3vh 5vw;overflow:auto}.am-lab:fullscreen .am-body{grid-template-columns:minmax(0,1fr) 240px}.am-lab:fullscreen .am-chart{max-height:58vh}.am-lab:fullscreen .am-visual{display:flex;flex-direction:column;align-items:stretch;justify-content:center}
@media(max-width:760px){.am-body{grid-template-columns:minmax(0,1fr)}.am-controls{border-left:0;border-top:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr;gap:14px 20px;padding:16px}.am-presets{grid-column:1/-1}.am-results{padding:14px;gap:12px 18px}.am-stat{min-width:120px}.am-task{padding:13px;gap:10px}.am-chain{gap:6px}.am-chain>div{padding:7px}.am-chain>span{font-size:8px}.am-matrix table{border-spacing:5px 2px}.am-matrices{gap:8px}.am-lab:fullscreen{padding:12px}.am-lab:fullscreen .am-body{grid-template-columns:minmax(0,1fr)}.am-lab:fullscreen .am-chart{max-height:42vh}.am-caption{font-size:10px}.am-chart{min-height:190px}.am-shape-demo{min-height:230px}}
@media(max-width:380px){.am-controls{gap:13px 12px}.am-range>span{font-size:9px}.am-stat{min-width:105px}.am-matrix table{font-size:11px;border-spacing:3px 2px}.am-chain>span{max-width:62px}}
`;
