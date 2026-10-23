import {execFileSync} from 'node:child_process';
import {readFileSync,statSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const MAX_BYTES=5*1024*1024;
const patterns=[
  ['OpenCode credential',/\boc_sk_[A-Za-z0-9_]{24,}\b/],
  ['GitHub credential',/\b(?:gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['OpenAI credential',/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b/],
  ['AWS access key',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Private key',/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
];
export function inspectContent(content){return patterns.filter(([,pattern])=>pattern.test(content)).map(([name])=>name);}
export function forbiddenPath(path){
  const name=path.split('/').at(-1);
  return /(?:^|\/)(?:node_modules|\.venv[^/]*|__pycache__|\.cache|\.pytest_cache|test-results|playwright-report|artifacts|dist|dist-server)(?:\/|$)/.test(path)
    || /^(?:public\/(?:python|licenses|downloads)\/|\.openai\/(?:site-deploy\.tar\.gz|deploy-receipt\.json)$)/.test(path)
    || (/^\.env/.test(name)&&name!=='.env.example') || /^\.dev\.vars/.test(name)
    || /^(?:\.npmrc|\.netrc|\.git-credentials|id_rsa|id_ed25519)$/.test(name)
    || /\.(?:key|pem|p12|pfx|pt|pth|safetensors|pyc|sqlite|db|bundle)$/i.test(name)
    || /^(?:learning-data|learning-backup).*\.json$/i.test(name);
}
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:64*1024*1024});
export function checkRepository(history=false){
  const failures=[],files=git('ls-files','-z').split('\0').filter(Boolean);
  for(const path of files){
    if(forbiddenPath(path)){failures.push(`${path}: sensitive or generated file`);continue;}
    const stat=statSync(path);
    if(stat.size>MAX_BYTES){failures.push(`${path}: exceeds 5 MiB`);continue;}
    if(stat.isFile())for(const rule of inspectContent(readFileSync(path,'utf8')))failures.push(`${path}: ${rule}`);
  }
  let blobs=0;
  if(history){
    for(const path of new Set(git('log','--all','--format=','--name-only').split('\n').filter(Boolean))){
      if(forbiddenPath(path))failures.push(`history ${path}: sensitive or generated file`);
    }
    const objects=git('rev-list','--objects','--all').trim().split('\n').filter(Boolean).map(row=>row.split(' ')[0]);
    const info=execFileSync('git',['cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],{input:objects.join('\n')+'\n',encoding:'utf8'});
    for(const row of info.trim().split('\n')){
      const [sha,type,size]=row.split(' ');if(type!=='blob')continue;blobs++;
      if(Number(size)>MAX_BYTES){failures.push(`history ${sha}: blob exceeds 5 MiB`);continue;}
      for(const rule of inspectContent(git('cat-file','blob',sha)))failures.push(`history ${sha}: ${rule}`);
    }
  }
  // Report paths/rules only. Never print a matched credential or its source line.
  if(failures.length)throw new Error(failures.join('\n'));
  console.log(`Repository safety passed: ${files.length} tracked files${history?`, ${blobs} historical blobs`:''}. No matched credential values are logged.`);
  return {files:files.length,blobs};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{checkRepository(process.argv.includes('--history'));}catch(error){console.error(error.message);process.exitCode=1;}
}
