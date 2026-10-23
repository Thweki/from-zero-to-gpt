import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

export function verifyManifest(manifest,bytes,expectedCommit){
  if(!/^[a-f0-9]{40}$/.test(expectedCommit)||manifest.schemaVersion!==1||manifest.commitSha!==expectedCommit)throw new Error('Delivery source commit mismatch');
  if(manifest.artifact?.filename!=='site-worker.tar.gz')throw new Error('Unexpected artifact filename');
  const digest=createHash('sha256').update(bytes).digest('hex');
  if(manifest.artifact.sha256!==digest||manifest.artifact.bytes!==bytes.length)throw new Error('Delivery archive integrity mismatch');
  if(manifest.deployment?.automatic!==false)throw new Error('This workflow does not authorize automatic production deployment');
  return digest;
}
export function verifyDelivery(dir='artifacts/ci-release'){
  const manifest=JSON.parse(readFileSync(join(dir,'release-manifest.json'),'utf8'));
  const commit=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const archive=join(dir,'site-worker.tar.gz'),bytes=readFileSync(archive);
  const digest=verifyManifest(manifest,bytes,commit);
  if(readFileSync(join(dir,'SHA256SUMS'),'utf8')!==`${digest}  site-worker.tar.gz\n`)throw new Error('Checksum file mismatch');
  const entries=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n');
  if(entries.some(name=>name.startsWith('/')||name.split('/').includes('..')||!(name==='.openai/hosting.json'||name.startsWith('dist/'))))throw new Error('Unexpected path in delivery archive');
  for(const required of ['.openai/hosting.json','dist/server/index.js','dist/client/index.html','dist/client/python.worker.js','dist/client/python/pyodide.asm.wasm']){
    if(!entries.includes(required))throw new Error(`Missing runtime asset: ${required}`);
  }
  const hosting=JSON.parse(execFileSync('tar',['-xOzf',archive,'.openai/hosting.json'],{encoding:'utf8'}));
  if(hosting.project_id!==manifest.projectId)throw new Error('Existing Site identity mismatch');
  console.log(`Verified source, SHA-256, Site identity and runtime assets for ${commit}. Production unchanged.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{verifyDelivery(process.argv[2]);}catch(error){console.error(error.message);process.exitCode=1;}
}
