import {lazy,Suspense,type ComponentProps} from 'react';

const TutorPanel=lazy(()=>import('./TutorPanel').then(module=>({default:module.TutorPanel})));

export function DeferredTutorPanel(props:ComponentProps<typeof TutorPanel>){
  return <Suspense fallback={<p role="status">正在打开 AI 导师…</p>}><TutorPanel {...props}/></Suspense>;
}
