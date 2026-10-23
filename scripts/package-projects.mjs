import { mkdir } from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {findPython,runPython} from './python.mjs';
import {isMain} from './cli-main.mjs';
export async function packageProjects(root=fileURLToPath(new URL('../',import.meta.url))){
const python=findPython();
await mkdir(resolve(root,'public/downloads'),{recursive:true});
const result=runPython(python,['-I','-c',String.raw`
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
for name in ['regression','micrograd','tiny-gpt']:
 root=Path('projects')/name
 if not root.exists(): continue
 with ZipFile(Path('public/downloads')/(name+'.zip'),'w',ZIP_DEFLATED) as archive:
  for file in sorted(root.rglob('*')):
   if not file.is_file() or '__pycache__' in file.parts or file.suffix in ['.pyc','.pt','.pth','.safetensors','.ckpt'] or any(p.startswith(('.venv','.env','.dev.vars')) for p in file.parts): continue
   archive.write(file,Path(name)/file.relative_to(root))
`],{cwd:root,encoding:'utf8'});
if(result.error||result.status!==0)throw new Error('Project packaging failed: '+(result.error?.message||result.stderr));
}
if(isMain(import.meta.url))await packageProjects();
