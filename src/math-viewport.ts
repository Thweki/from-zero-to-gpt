/** Equal x/y scale, fitted to the whole permitted input interval, not one sample. */
export function functionPlotViewport(fn:(x:number)=>number,currentX:number){
  const samples=[-3,0,3,currentX].map(fn);
  const originY=samples.every(y=>y>=0)?275:samples.every(y=>y<=0)?35:155;
  const availableY=originY===155?130:260;
  const extent=Math.max(5,Math.abs(currentX),...samples.map(Math.abs));
  return {originY,unit:Math.min(60,availableY/extent)};
}
export function functionPlotScale(fn:(x:number)=>number,currentX:number){
  return functionPlotViewport(fn,currentX).unit;
}
export function axisTicks(halfPixels:number,unit:number){
  const limit=halfPixels/unit;
  const rough=limit/4,power=10**Math.floor(Math.log10(rough));
  const step=[1,2,5,10].find(n=>n*power>=rough)!*power;
  const count=Math.floor(limit/step);
  return Array.from({length:count*2+1},(_,i)=>(i-count)*step).filter(n=>n!==0);
}
