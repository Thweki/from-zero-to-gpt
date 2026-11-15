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
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED, BadZipFile
from hashlib import sha256
import json
for name in ['regression','micrograd','tiny-gpt']:
 root=Path('projects')/name
 if not root.exists(): continue
 entries=[]
 for file in sorted(root.rglob('*')):
  if not file.is_file() or '__pycache__' in file.parts or file.suffix in ['.pyc','.pt','.pth','.safetensors','.ckpt'] or any(p.startswith(('.venv','.env','.dev.vars')) for p in file.parts): continue
  entries.append((ZipInfo.from_file(file,Path(name)/file.relative_to(root)),file.read_bytes()))
 # Hash only shipped paths, permissions and bytes; touching a source or changing
 # ignored training artifacts must not trigger another compression pass.
 fingerprint=b'from-zero-projects-v1:'+sha256(json.dumps([
  [info.filename,info.external_attr,sha256(data).hexdigest()] for info,data in entries
 ],ensure_ascii=True).encode()).hexdigest().encode()
 destination=Path('public/downloads')/(name+'.zip')
 try:
  with ZipFile(destination) as archive:
   if archive.comment==fingerprint: continue
 except (FileNotFoundError,BadZipFile): pass
 with ZipFile(destination,'w',ZIP_DEFLATED) as archive:
  for info,data in entries:
   archive.writestr(info,data,compress_type=ZIP_DEFLATED)
  archive.comment=fingerprint
`],{cwd:root,encoding:'utf8'});
if(result.error||result.status!==0)throw new Error('Project packaging failed: '+(result.error?.message||result.stderr));
}
if(isMain(import.meta.url))await packageProjects();
