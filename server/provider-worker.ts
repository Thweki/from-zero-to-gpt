import {createInterface} from 'node:readline';
import {ProviderEngine} from './provider-engine';
// stdout is exclusively a private host protocol; library logs go to stderr.
console.log=(...args)=>console.error(...args);
const engine=new ProviderEngine();
const lines=createInterface({input:process.stdin});
lines.on('line',line=>{
  if(line.length>2_000_000)return;
  let request:{id:string;action:string;data:Record<string,unknown>};
  try{request=JSON.parse(line);}catch{return;}
  void engine.request(request.action,request.data).then(result=>process.stdout.write(JSON.stringify({id:request.id,result})+'\n'),()=>process.stdout.write(JSON.stringify({id:request.id,error:'模型服务操作失败，请检查连接或重新授权。'})+'\n'));
});
lines.on('close',()=>process.exit(0));
