import type {Lesson} from './types';

type NoteLesson = Pick<Lesson, 'id' | 'number' | 'title'>;

export function createNoteExport(lesson:NoteLesson, note:string){
  if(!note.trim())return null;
  return {
    filename:`from-zero-to-gpt-${lesson.number}-${lesson.id}-notes.md`,
    markdown:`# ${lesson.number} ${lesson.title} · 我的笔记\n\n从零到 GPT · 章节：${lesson.id}\n\n---\n\n${note}${note.endsWith('\n')?'':'\n'}`,
  };
}

export function downloadNote(lesson:NoteLesson, note:string):boolean{
  const file=createNoteExport(lesson,note);
  if(!file)return false;
  const url=URL.createObjectURL(new Blob([file.markdown],{type:'text/markdown;charset=utf-8'}));
  const anchor=document.createElement('a');
  try{
    anchor.href=url;
    anchor.download=file.filename;
    anchor.hidden=true;
    document.body.append(anchor);
    anchor.click();
  }finally{
    anchor.remove();
    // Let the browser consume the download before releasing its URL.
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return true;
}
