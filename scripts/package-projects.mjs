import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
await mkdir('public/downloads',{recursive:true});
const result=spawnSync('python3',['-c',String.raw`
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
for name in ['regression','micrograd','tiny-gpt']:
 root=Path('projects')/name
 if not root.exists(): continue
 with ZipFile(Path('public/downloads')/(name+'.zip'),'w',ZIP_DEFLATED) as archive:
  for file in sorted(root.rglob('*')):
   if not file.is_file() or '__pycache__' in file.parts or file.suffix in ['.pyc','.pt','.pth'] or any(p.startswith('.venv') for p in file.parts): continue
   archive.write(file,Path(name)/file.relative_to(root))
`],{encoding:'utf8'});
if(result.status!==0)throw new Error('Project packaging failed: '+result.stderr);
