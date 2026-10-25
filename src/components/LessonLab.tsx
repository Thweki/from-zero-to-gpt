import {lazy,Suspense,useRef} from 'react';
import {FlaskConical,RotateCcw} from 'lucide-react';
import type {ExtendedLabProps} from '../types';
import {MathLab} from './MathLab';
import {FullscreenButton} from './FullscreenButton';
const AdvancedMathLab=lazy(()=>import('./labs/AdvancedMathLab').then(m=>({default:m.AdvancedMathLab})));
const MachineLearningLab=lazy(()=>import('./labs/MachineLearningLab').then(m=>({default:m.MachineLearningLab})));
const NeuralLab=lazy(()=>import('./labs/NeuralLab').then(m=>({default:m.NeuralLab})));
const TransformerLab=lazy(()=>import('./labs/TransformerLab').then(m=>({default:m.TransformerLab})));
const GPTLab=lazy(()=>import('./labs/GPTLab').then(m=>({default:m.GPTLab})));
const ModernLLMLab=lazy(()=>import('./labs/ModernLLMLab').then(m=>({default:m.ModernLLMLab})));
const advanced={'math-advanced':AdvancedMathLab,'machine-learning':MachineLearningLab,'neural-network':NeuralLab,transformer:TransformerLab,gpt:GPTLab,'modern-llm':ModernLLMLab};
export function LessonLab(props:ExtendedLabProps){
  const ref=useRef<HTMLElement>(null);
  if(['function','linear','vector','dot'].includes(props.lesson.lab))return <MathLab {...props}/>;
  const Lab=advanced[props.lesson.lab as keyof typeof advanced];
  return <section className="extended-lab" ref={ref} aria-label="交互式数学实验">{!['math-advanced','modern-llm'].includes(props.lesson.lab)&&<div className="lab-header"><span><FlaskConical size={16}/>动手实验 <small>LIVE</small></span><div><button className="icon-button" aria-label="重置实验参数" onClick={()=>props.onChange({})}><RotateCcw size={15}/></button><FullscreenButton target={ref} label="全屏实验"/></div></div>}<Suspense fallback={<p className="lab-loading">正在打开可交互的实验…</p>}><Lab {...props}/></Suspense>{props.onObserve&&!['math-advanced','modern-llm'].includes(props.lesson.lab)&&<div className="observation-entry"><span>把刚才的发现留在本章笔记里。</span><button type="button" className="text-button observation-trigger" onClick={event=>props.onObserve?.(event.currentTarget)}>记录观察</button></div>}</section>;
}
