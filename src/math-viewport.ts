/** Equal x/y scale, fitted to the whole permitted input interval, not one sample. */
export function functionPlotScale(fn:(x:number)=>number,currentX:number){
  const extent=Math.max(5,Math.abs(currentX),...[-3,0,3,currentX].map(x=>Math.abs(fn(x))));
  return Math.min(26,130/extent);
}
export function axisTicks(halfPixels:number,unit:number){
  const limit=halfPixels/unit;
  const rough=limit/4,power=10**Math.floor(Math.log10(rough));
  const step=[1,2,5,10].find(n=>n*power>=rough)!*power;
  const count=Math.floor(limit/step);
  return Array.from({length:count*2+1},(_,i)=>(i-count)*step).filter(n=>n!==0);
}
