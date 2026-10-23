import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {mkdir,open,readFile,unlink,writeFile} from 'node:fs/promises';
import {get} from 'node:http';
import {createServer} from 'node:net';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {findPython} from './python.mjs';

export const projectRoot=fileURLToPath(new URL('../',import.meta.url));
export function supportedNode(version){const [major,minor]=version.split('.').map(Number);return major>22||(major===22&&minor>=18);}
export function parseOptions(args,defaultPort='5173'){
  const options={port:defaultPort,open:true,check:false,help:false};
  for(let i=0;i<args.length;i++){
    if(args[i]==='--no-open')options.open=false;
    else if(args[i]==='--check')options.check=true;
    else if(args[i]==='--help'||args[i]==='-h')options.help=true;
    else if(args[i]==='--port')options.port=args[++i];
    else throw new Error(`未知选项：${args[i]}。运行 --help 查看用法。`);
  }
  if(!/^\d+$/.test(String(options.port))||Number(options.port)<1024||Number(options.port)>65535)throw new Error('端口必须为 1024–65535 的整数。');
  options.port=Number(options.port);return options;
}
export function dependencyFingerprint(root=projectRoot){
  return createHash('sha256').update(readFileSync(join(root,'package.json'))).update(readFileSync(join(root,'package-lock.json')))
    .update(`${process.platform}/${process.arch}/${process.versions.modules}`).digest('hex');
}
export async function acquireLaunchLock(root=projectRoot){
  const dir=join(root,'artifacts','launcher'),path=join(dir,'lock.json'),token=randomUUID();await mkdir(dir,{recursive:true});
  for(let attempt=0;attempt<2;attempt++){
    try{
      const file=await open(path,'wx');try{await file.writeFile(JSON.stringify({pid:process.pid,token}));}finally{await file.close();}
      return async()=>{try{if(JSON.parse(await readFile(path,'utf8')).token===token)await unlink(path);}catch(error){if(error.code!=='ENOENT')throw error;}};
    }catch(error){
      if(error.code!=='EEXIST')throw error;
      let old;try{old=JSON.parse(await readFile(path,'utf8'));}catch{throw new Error('启动锁无法读取。确认旧启动程序已结束后，可删除 artifacts/launcher/lock.json 再试。');}
      if(!Number.isSafeInteger(old.pid)||old.pid<=0)throw new Error('启动锁格式异常，请检查 artifacts/launcher/lock.json。');
      try{process.kill(old.pid,0);}catch(probe){if(probe.code==='ESRCH'){await unlink(path).catch(e=>{if(e.code!=='ENOENT')throw e;});continue;}}
      throw new Error('这个项目已有启动程序正在准备或运行，请使用原来的窗口。');
    }
  }
  throw new Error('启动锁正被另一个进程更新，请稍后重试。');
}
function npmCommand(args){
  // Windows npm.cmd needs cmd.exe. Only fixed internal arguments enter this command.
  return process.platform==='win32'?{command:process.env.ComSpec||'cmd.exe',args:['/d','/s','/c',`npm ${args.join(' ')}`]}:{command:'npm',args};
}
export async function checkPort(port){
  await new Promise((yes,no)=>{const server=createServer();server.once('error',()=>no(new Error(`端口 ${port} 已被占用或不可用。请关闭旧实例，或使用 --port 指定端口。`)));server.listen(port,'127.0.0.1',()=>server.close(yes));});
}
function responds(port,signal){
  return new Promise(yes=>{
    const request=get({hostname:'127.0.0.1',port,path:'/',agent:false,signal,timeout:1000},response=>{
      let body='';response.on('data',chunk=>{if(body.length<16384)body+=chunk;});response.on('end',()=>yes(response.statusCode===200&&body.includes('From Zero to GPT')));
    });request.on('timeout',()=>request.destroy());request.on('error',()=>yes(false));
  });
}
async function waitForServer(port,signal){
  const end=Date.now()+30000;
  while(!signal.aborted&&Date.now()<end){if(await responds(port,signal))return true;await delay(200,undefined,{signal}).catch(()=>{});}
  if(signal.aborted)return false;throw new Error('服务在 30 秒内未就绪，请查看上面的启动输出。');
}
function openBrowser(url){
  let command,args;
  if(process.platform==='win32'){command='rundll32.exe';args=['url.dll,FileProtocolHandler',url];}
  else if(process.platform==='darwin'){command='open';args=[url];}
  else if(process.env.DISPLAY||process.env.WAYLAND_DISPLAY){command='xdg-open';args=[url];}
  else{console.log('当前没有图形桌面，请在浏览器中打开上述地址。');return;}
  const child=spawn(command,args,{stdio:'ignore',detached:true});
  child.once('error',()=>console.log('未能自动打开浏览器，请手动打开上述地址。'));
  child.once('exit',code=>{if(code)console.log('浏览器未能打开，请手动打开上述地址。');});child.unref();
}

export async function main(args=process.argv.slice(2)){
  let release,active,interrupted=false;const controller=new AbortController();
  const stop=()=>{interrupted=true;controller.abort();active?.kill('SIGTERM');};
  const run=(command,argv,label)=>new Promise((yes,no)=>{
    if(interrupted){no(new Error('已停止'));return;}
    const child=spawn(command,argv,{cwd:projectRoot,stdio:'inherit'});active=child;
    child.once('error',error=>{if(active===child)active=null;no(new Error(`${label}无法启动：${error.code||error.message}`));});
    child.once('exit',(code,signal)=>{if(active===child)active=null;if(code===0&&!interrupted)yes();else no(new Error(`${label}已退出（${signal||code}）。请查看上面的具体输出。`));});
  });
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  try{
    const options=parseOptions(args,process.env.FROM_ZERO_PORT||'5173');
    if(options.help){console.log('From Zero to GPT 一键启动\n用法：启动脚本 [--no-open] [--port 5173] [--check]\n--check 仅检查依赖，不安装或启动\n关闭：在此窗口按 Ctrl+C。需要 Node 22.18+、Python 3.10+；首次安装需要网络。');return 0;}
    if(!supportedNode(process.versions.node))throw new Error('需要 Node.js 22.18+，推荐从 https://nodejs.org/ 安装 Node 24 LTS。');
    process.chdir(projectRoot);
    const python=findPython(),npm=npmCommand(['--version']),probe=spawnSync(npm.command,npm.args,{encoding:'utf8',windowsHide:true,timeout:10000});
    if(probe.error||probe.status!==0)throw new Error('无法运行 npm。请安装包含 npm 的 Node.js 24 LTS，并重新打开终端。');
    console.log(`From Zero to GPT · Node ${process.versions.node} · Python ${python.version} · npm ${probe.stdout.trim()}`);
    if(options.check){console.log('依赖检查通过。');return 0;}
    release=await acquireLaunchLock();await checkPort(options.port);
    const marker=join(projectRoot,'node_modules','.from-zero-install.json'),fingerprint=dependencyFingerprint();
    let installed=false;try{installed=JSON.parse(await readFile(marker,'utf8')).fingerprint===fingerprint;}catch{/* Fresh checkout or interrupted install. */}
    installed=installed&&existsSync(join(projectRoot,'node_modules','vite','bin','vite.js'))&&existsSync(join(projectRoot,'node_modules','pyodide','pyodide.asm.wasm'));
    if(!installed){
      console.log('首次准备或依赖已变更：按锁文件安装项目依赖（npm ci）…');
      const install=npmCommand(['ci','--no-audit','--no-fund']);await run(install.command,install.args,'依赖安装');
      await writeFile(marker,JSON.stringify({fingerprint})+'\n');
    }else console.log('依赖已就绪，复用本地安装。');
    console.log('正在准备浏览器 Python 与可下载工程…');
    await run(process.execPath,['scripts/copy-python.mjs'],'Python 资源准备');
    await run(process.execPath,['scripts/package-projects.mjs'],'学习工程打包');
    const url=`http://localhost:${options.port}`;
    const server=run(process.execPath,[join(projectRoot,'node_modules','vite','bin','vite.js'),'--host','127.0.0.1','--port',String(options.port),'--strictPort'],'本地服务');
    const ready=await Promise.race([waitForServer(options.port,controller.signal),server.then(()=>false)]);
    if(ready){console.log(`\n学习平台已启动：${url}\n保留此窗口；按 Ctrl+C 关闭。AI 导师可选，不配置密钥也能学习。\n`);if(options.open)openBrowser(url);}
    await server;return 0;
  }catch(error){if(interrupted){console.log('\n本地服务已停止。');return 0;}console.error(`\n启动失败：${error.message}`);return 1;}
  finally{controller.abort();active?.kill('SIGTERM');if(release)await release();process.off('SIGINT',stop);process.off('SIGTERM',stop);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
