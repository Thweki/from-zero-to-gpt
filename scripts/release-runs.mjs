import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export function verifiedRun(runs,sha,workflow) {
  assert.match(sha,/^[a-f0-9]{40}$/);
  const run=runs.find(run=>run.head_sha===sha&&run.head_branch==='main'&&run.event==='push'
    &&run.status==='completed'&&run.conclusion==='success'&&run.path===`.github/workflows/${workflow}`);
  assert.ok(run,`No successful main ${workflow} run for release commit ${sha}; finish CI before tagging`);
  assert.ok(Number.isSafeInteger(run.id)&&run.id>0,'Invalid workflow run ID');
  return run.id;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const {GITHUB_REPOSITORY:repo,GITHUB_SHA:sha,GITHUB_OUTPUT:output}=process.env;
  assert.match(repo||'',/^[\w.-]+\/[\w.-]+$/);
  assert.match(sha||'',/^[a-f0-9]{40}$/);
  for(const [name,workflow] of [['ci_run','ci.yml'],['build_run','tauri.yml']]) {
    const endpoint=`repos/${repo}/actions/workflows/${workflow}/runs?head_sha=${sha}&branch=main&event=push&status=success&per_page=100`;
    const data=JSON.parse(execFileSync('gh',['api',endpoint],{encoding:'utf8'}));
    const id=verifiedRun(data.workflow_runs,sha,workflow);
    appendFileSync(output,`${name}=${id}\n`);
    console.log(`Verified ${workflow}: https://github.com/${repo}/actions/runs/${id}`);
  }
}
