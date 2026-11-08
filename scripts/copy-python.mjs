import { mkdir, copyFile, cp, readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('pyodide/package.json'));
await mkdir('public/python', { recursive: true });
for (const file of ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) {
  await copyFile(join(root, file), join('public/python', file));
}
for (const file of ['LICENSE','CPYTHON-LICENSE']) {
  await copyFile(join('third_party/pyodide',file),join('public/python',file));
}
await mkdir('public/licenses',{recursive:true});
await copyFile('LICENSE','public/licenses/from-zero-to-gpt-LICENSE');
await copyFile('THIRD_PARTY_NOTICES.md','public/licenses/THIRD_PARTY_NOTICES.md');
for (const name of ['react','react-dom','katex','lucide-react','idb']) {
  await copyFile(join('node_modules',name,'LICENSE'),join('public/licenses',`${name}-LICENSE`));
}

await copyFile('node_modules/react-markdown/license','public/licenses/react-markdown-LICENSE');

// The desktop provider sidecar embeds these production dependencies. Retain
// their original notices, including license directories and nested packages.
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
for(const [directory,metadata] of Object.entries(lock.packages)) {
  if(!directory.startsWith('node_modules/')||metadata.dev)continue;
  const files=await readdir(directory).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
  const notices=files.filter(file=>/^(licen[sc]e|notice|copying)([.\-_]|s$|$)/i.test(file));
  if(!notices.length)continue;
  const destination=join('public/licenses/dependencies',directory.replaceAll('node_modules/','').replaceAll('/','__'));
  await mkdir(destination,{recursive:true});
  for(const file of notices)await cp(join(directory,file),join(destination,file),{recursive:true});
}
await cp('third_party/provider-engine','public/licenses/provider-engine',{recursive:true});
