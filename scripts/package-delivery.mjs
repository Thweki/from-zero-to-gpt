import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';

const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const commit=git('rev-parse','HEAD');
if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('Expected a complete source commit');
if(process.env.GITHUB_SHA&&process.env.GITHUB_SHA!==commit)throw new Error('Checkout does not match GITHUB_SHA');
if(git('status','--porcelain','--untracked-files=all'))throw new Error('Commit source changes before packaging a delivery artifact');
const pkg=JSON.parse(await readFile('package.json','utf8'));
const hosting=JSON.parse(await readFile('.openai/hosting.json','utf8'));
const dir='artifacts/ci-release',filename='site-worker.tar.gz';
await mkdir(dir,{recursive:true});
await copyFile('.openai/site-deploy.tar.gz',`${dir}/${filename}`);
const archive=await readFile(`${dir}/${filename}`),sha256=createHash('sha256').update(archive).digest('hex');
const manifest={schemaVersion:1,commitSha:commit,appVersion:pkg.version,projectId:hosting.project_id,
  artifact:{filename,sha256,bytes:archive.length},
  github:{repository:process.env.GITHUB_REPOSITORY||null,runId:process.env.GITHUB_RUN_ID||null},
  deployment:{automatic:false,method:'Supported Sites native saved-version publication',audience:'preserve existing audience'}};
await writeFile(`${dir}/release-manifest.json`,JSON.stringify(manifest,null,2)+'\n');
await writeFile(`${dir}/SHA256SUMS`,`${sha256}  ${filename}\n`);
console.log(`Delivery candidate prepared for ${commit}; no production deployment was performed.`);
