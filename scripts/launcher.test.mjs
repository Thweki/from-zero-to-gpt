import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm,symlink,unlink,stat,utimes,rename} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {acquireLaunchLock,checkPort,dependencyFingerprint,parseOptions,supportedNode,projectRoot} from './launch.mjs';
import {findPython,runPython} from './python.mjs';
import {packageProjects} from './package-projects.mjs';

test('rejects unsupported Node releases before installing dependencies',()=>{
  for(const v of ['18.20.0','20.19.0','22.17.9','22.18.0'])assert.equal(supportedNode(v),false);
  for(const v of ['22.19.0','22.20.0','24.0.0','24.19.0'])assert.equal(supportedNode(v),true);
});
test('validates user ports and rejects shell-like arguments',()=>{
  assert.deepEqual(parseOptions(['--port','5180','--no-open']),{port:5180,open:false,check:false,help:false});
  for(const args of [['--port'],['--port','5173 & calc'],['--port','80'],['--port','65536'],['--unknown']])assert.throws(()=>parseOptions(args));
  assert.equal(parseOptions(['--check']).check,true);
});
test('dependency fingerprint changes with the lock file',async()=>{
  const root=await mkdtemp(join(tmpdir(),'from zero fingerprint '));try{
    await writeFile(join(root,'package.json'),'{}');await writeFile(join(root,'package-lock.json'),'first');
    const before=dependencyFingerprint(root);await writeFile(join(root,'package-lock.json'),'second');assert.notEqual(dependencyFingerprint(root),before);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('an active launch lock cannot be stolen, and release permits another launch',async()=>{
  const root=await mkdtemp(join(tmpdir(),'from zero lock '));try{
    const release=await acquireLaunchLock(root);await assert.rejects(()=>acquireLaunchLock(root),/已有启动程序/);
    await release();const releaseAgain=await acquireLaunchLock(root);await releaseAgain();
  }finally{await rm(root,{recursive:true,force:true});}
});
test('malformed locks are retained instead of silently replacing them',async()=>{
  const root=await mkdtemp(join(tmpdir(),'from zero malformed '));try{
    await mkdir(join(root,'artifacts','launcher'),{recursive:true});const path=join(root,'artifacts','launcher','lock.json');await writeFile(path,'invalid');
    await assert.rejects(()=>acquireLaunchLock(root),/启动锁无法读取/);assert.equal(await readFile(path,'utf8'),'invalid');
  }finally{await rm(root,{recursive:true,force:true});}
});
test('runs a real supported Python interpreter without a shell',()=>{
  const python=findPython();const result=runPython(python,['-I','-c','print(2 + 3)'],{encoding:'utf8'});
  assert.equal(result.status,0);assert.equal(result.stdout.trim(),'5');
});
test('an explicit invalid interpreter does not silently select another one',()=>{
  assert.throws(()=>findPython(join(tmpdir(),'missing from zero python executable')),/FROM_ZERO_PYTHON/);
});
test('a symlink or Windows junction still runs the actual CLI entry',async()=>{
  const root=await mkdtemp(join(tmpdir(),'from zero alias ')),alias=join(root,'project alias');
  try{
    await symlink(projectRoot,alias,process.platform==='win32'?'junction':'dir');
    const result=spawnSync(process.execPath,[join(alias,'scripts','launch.mjs'),'--check'],{cwd:tmpdir(),encoding:'utf8',timeout:20000});
    assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/依赖检查通过/);
  }finally{await unlink(alias).catch(e=>{if(e.code!=='ENOENT')throw e;});await rm(root,{recursive:true,force:true});}
});
test('an occupied port is rejected without closing the existing service',async()=>{
  const server=createServer();await new Promise(yes=>server.listen(0,'127.0.0.1',yes));
  try{await assert.rejects(()=>checkPort(server.address().port),/已被占用/);assert.equal(server.listening,true);}
  finally{await new Promise(yes=>server.close(yes));}
});
test('project ZIP works in a spaced path and excludes local credentials, caches and weights',async()=>{
  const root=await mkdtemp(join(tmpdir(),'from zero projects '));try{
    const project=join(root,'projects','regression');await mkdir(join(project,'__pycache__'),{recursive:true});
    for(const [name,content] of Object.entries({'README.md':'Study project','main.py':'print(5)','.env':'TUTOR_API_KEY=example','model.pt':'weights','model.safetensors':'weights','__pycache__/cache.pyc':'cache'}))await writeFile(join(project,name),content);
    await packageProjects(root);
    const python=findPython();const result=runPython(python,['-I','-c','import json,sys,zipfile; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))',join(root,'public','downloads','regression.zip')],{encoding:'utf8'});
    assert.equal(result.status,0);assert.deepEqual(new Set(JSON.parse(result.stdout)),new Set(['regression/README.md','regression/main.py']));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('unchanged project ZIPs are reused, including after excluded files change',async()=>{
  const root=await mkdtemp(join(tmpdir(),'from zero cached projects '));try{
    const project=join(root,'projects','regression'),archive=join(root,'public','downloads','regression.zip');
    await mkdir(project,{recursive:true});await writeFile(join(project,'main.py'),'print(5)');
    await packageProjects(root);
    const bytes=await readFile(archive),old=new Date('2001-01-01T00:00:00Z');
    await utimes(archive,old,old);
    await utimes(join(project,'main.py'),old,old);
    await writeFile(join(project,'.env'),'local fixture');await writeFile(join(project,'model.pt'),'local weights');
    await packageProjects(root);
    assert.equal((await stat(archive)).mtimeMs,old.getTime(),'cache hit must not rewrite or recompress the ZIP');
    assert.deepEqual(await readFile(archive),bytes);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('project ZIP cache tracks content, additions, renames and removals independently',async()=>{
  const root=await mkdtemp(join(tmpdir(),'from zero changed projects '));try{
    for(const name of ['regression','micrograd']){
      await mkdir(join(root,'projects',name),{recursive:true});
      await writeFile(join(root,'projects',name,'main.py'),'print(5)');
    }
    await packageProjects(root);
    const project=join(root,'projects','regression'),archive=join(root,'public','downloads','regression.zip');
    const untouched=join(root,'public','downloads','micrograd.zip'),old=new Date('2001-01-01T00:00:00Z');
    await utimes(untouched,old,old);
    const python=findPython();
    const contents=()=>{
      const result=runPython(python,['-I','-c','import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({n:z.read(n).decode() for n in z.namelist()}))',archive],{encoding:'utf8'});
      assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
    };
    const original=await stat(join(project,'main.py'));
    await writeFile(join(project,'main.py'),'print(6)');
    await utimes(join(project,'main.py'),original.atime,original.mtime);
    await packageProjects(root);assert.deepEqual(contents(),{'regression/main.py':'print(6)'});
    await writeFile(join(project,'README.md'),'Study');
    await packageProjects(root);assert.deepEqual(contents(),{'regression/main.py':'print(6)','regression/README.md':'Study'});
    await rename(join(project,'main.py'),join(project,'example.py'));
    await packageProjects(root);assert.deepEqual(contents(),{'regression/example.py':'print(6)','regression/README.md':'Study'});
    await unlink(join(project,'README.md'));
    await packageProjects(root);assert.deepEqual(contents(),{'regression/example.py':'print(6)'});
    assert.equal((await stat(untouched)).mtimeMs,old.getTime(),'changing one project must not repack another');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('project ZIP cache rebuilds missing and malformed archives',async()=>{
  const root=await mkdtemp(join(tmpdir(),'from zero restored projects '));try{
    await mkdir(join(root,'projects','regression'),{recursive:true});
    await writeFile(join(root,'projects','regression','main.py'),'print(5)');
    const archive=join(root,'public','downloads','regression.zip');
    await packageProjects(root);const expected=await readFile(archive);
    await unlink(archive);await packageProjects(root);assert.deepEqual(await readFile(archive),expected);
    await writeFile(archive,'interrupted archive');await packageProjects(root);assert.deepEqual(await readFile(archive),expected);
  }finally{await rm(root,{recursive:true,force:true});}
});
