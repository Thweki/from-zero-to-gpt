export type ReadingBounds={top:number;bottom:number};

// Coordinates are viewport-relative, just like getBoundingClientRect().
export function readingMap(bounds:ReadingBounds[],viewport:ReadingBounds){
  if(!bounds.length)return null;
  const start=bounds[0].top,end=bounds[bounds.length-1].bottom,length=end-start;
  if(length<=0)return null;
  const fraction=(position:number)=>Math.max(0,Math.min(1,(position-start)/length));
  const visible=viewport.bottom>start&&viewport.top<end&&viewport.bottom>viewport.top;
  let current=visible?0:-1;
  if(visible)bounds.forEach((section,i)=>{if(section.top<=viewport.top)current=i;});
  return {
    sections:bounds.map((section,i)=>({start:fraction(section.top),end:fraction(bounds[i+1]?.top??end)})),
    visible:visible?{start:fraction(viewport.top),end:fraction(viewport.bottom)}:null,
    current,
  };
}
