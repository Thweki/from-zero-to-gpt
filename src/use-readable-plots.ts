import {useEffect} from 'react';
/** SVG font sizes use viewBox units. Preserve a readable screen size as plots shrink. */
export function useReadablePlots(ready:boolean){
  useEffect(()=>{
    if(!ready)return;
    const root=document.getElementById('main-content');if(!root)return;
    const plots=new Set<SVGSVGElement>();
    const update=(plot:SVGSVGElement)=>{
      const width=plot.getBoundingClientRect().width,logical=plot.viewBox.baseVal.width;
      if(width>0&&logical>0)plot.style.setProperty('--plot-label-size',`${Math.min(26,12*logical/width)}px`);
    };
    const observer=new ResizeObserver(entries=>entries.forEach(entry=>update(entry.target as SVGSVGElement)));
    const scan=()=>{
      for(const plot of plots)if(!root.contains(plot)){observer.unobserve(plot);plots.delete(plot);}
      root.querySelectorAll<SVGSVGElement>('svg[role="img"][viewBox]').forEach(plot=>{if(!plots.has(plot)){plots.add(plot);observer.observe(plot);update(plot);}});
    };
    scan();const mutations=new MutationObserver(scan);mutations.observe(root,{childList:true,subtree:true});
    return()=>{mutations.disconnect();observer.disconnect();};
  },[ready]);
}
