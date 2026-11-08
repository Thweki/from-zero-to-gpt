import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {snapshotSource,verifyPush} from './local-ci.mjs';
test('push gate rejects missing, failed and stale checks, including a second untested ref',()=>{
 const update='refs/heads/main abc refs/heads/main old\n';
 assert.throws(()=>verifyPush(null,update,()=>''));
 assert.throws(()=>verifyPush({status:'failed'},update,()=>''));
 assert.throws(()=>verifyPush({status:'passed',tree:'tested'},update,()=>'different'));
 assert.doesNotThrow(()=>verifyPush({status:'passed',tree:'tested'},update,()=>'tested'));
 assert.throws(()=>verifyPush({status:'passed',tree:'tested'},update+'refs/heads/other other refs/heads/other old\n',sha=>sha==='abc'?'tested':'different'));
});
test('isolated snapshot includes new and modified files, preserves deletions and ignores local secrets',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'local-ci-test-')),source=path.join(root,'source'),destination=path.join(root,'snapshot');
 const git=(...args)=>execFileSync('git',args,{cwd:source,encoding:'utf8'}).trim();
 try{
  execFileSync('git',['init','-q',source]);
  await writeFile(path.join(source,'.gitignore'),'.env\n');await writeFile(path.join(source,'tracked'),'before');await writeFile(path.join(source,'deleted'),'before');git('add','.');git('-c','user.name=Test','-c','user.email=test@localhost','-c','commit.gpgsign=false','commit','-qm','initial');
  const head=git('rev-parse','HEAD');
  await writeFile(path.join(source,'tracked'),'after');await writeFile(path.join(source,'new'),'new');await writeFile(path.join(source,'.env'),'private');await rm(path.join(source,'deleted'));
  const tree=await snapshotSource(source,destination);
  assert.equal(await readFile(path.join(destination,'tracked'),'utf8'),'after');assert.equal(await readFile(path.join(destination,'new'),'utf8'),'new');
  await assert.rejects(readFile(path.join(destination,'.env')));await assert.rejects(readFile(path.join(destination,'deleted')));
  assert.equal(git('rev-parse','HEAD'),head);assert.equal(execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:destination,encoding:'utf8'}).trim(),tree);
  assert.equal(execFileSync('git',['status','--porcelain'],{cwd:destination,encoding:'utf8'}).trim(),'');
 }finally{await rm(root,{recursive:true,force:true});}
});
