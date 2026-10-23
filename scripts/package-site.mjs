import {cp,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

// Sites accepts this Worker layout; ordinary Wrangler uses wrangler.json instead.
const stage=await mkdtemp(join(tmpdir(),'from-zero-site-'));
const archive=resolve('.openai/site-deploy.tar.gz');
try{
  await mkdir(join(stage,'.openai'),{recursive:true});
  await mkdir(join(stage,'dist/server'),{recursive:true});
  await cp('.openai/hosting.json',join(stage,'.openai/hosting.json'));
  await cp('dist-server/worker.js',join(stage,'dist/server/index.js'));
  await cp('dist',join(stage,'dist/client'),{recursive:true});
  const result=spawnSync('tar',['-czf',archive,'-C',stage,'.openai/hosting.json','dist'],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error('Site archive packaging failed');
  console.log(`Sites Worker archive: ${archive}`);
}finally{await rm(stage,{recursive:true,force:true});}
