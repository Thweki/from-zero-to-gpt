export const pageWidthKey='from-zero-to-gpt:page-width';
export const pageWidths=['narrow','standard','wide'] as const;
export type PageWidth=typeof pageWidths[number];

export function isPageWidth(value:unknown):value is PageWidth{
  return pageWidths.some(width=>width===value);
}

export function readPageWidth():PageWidth{
  try{
    const value=localStorage.getItem(pageWidthKey);
    return isPageWidth(value)?value:'standard';
  }catch{return 'standard';}
}

export function savePageWidth(width:PageWidth):boolean{
  try{localStorage.setItem(pageWidthKey,width);return true;}
  catch{return false;}
}
