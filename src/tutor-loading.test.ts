import {expect,it} from 'vitest';
import {build} from 'vite';

it('keeps the tutor panel out of the startup JavaScript graph',async()=>{
  const result=await build({logLevel:'silent',build:{write:false,minify:false}});
  if(!('output' in result))throw new Error('Expected a single application build');
  const chunks=result.output.filter(file=>file.type==='chunk');
  const entry=chunks.find(chunk=>chunk.isEntry&&chunk.facadeModuleId?.endsWith('/index.html'));
  expect(entry).toBeDefined();
  const initial=new Set<string>();
  const visit=(name:string)=>{
    if(initial.has(name))return;
    initial.add(name);
    chunks.find(chunk=>chunk.fileName===name)?.imports.forEach(visit);
  };
  visit(entry!.fileName);
  const tutor=chunks.find(chunk=>Object.keys(chunk.modules).some(id=>id.endsWith('/components/TutorPanel.tsx')));
  expect(tutor).toBeDefined();
  expect(initial.has(tutor!.fileName)).toBe(false);
  expect(chunks.some(chunk=>chunk.dynamicImports.includes(tutor!.fileName))).toBe(true);
},30000);
