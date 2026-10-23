import {spawnSync} from 'node:child_process';

/** No shell splitting: an interpreter path may contain spaces. */
export function findPython(override=process.env.FROM_ZERO_PYTHON){
  const candidates=override?[[override,[]]]:process.platform==='win32'
    ?[['py',['-3']],['python',[]],['python3',[]]]:[['python3',[]],['python',[]]];
  for(const [command,args] of candidates){
    const result=spawnSync(command,[...args,'-I','-c','import json,sys; print(json.dumps(list(sys.version_info[:3])))'],{encoding:'utf8',timeout:5000,windowsHide:true});
    if(result.error||result.status!==0)continue;
    try{
      const version=JSON.parse(result.stdout.trim());
      if(version[0]===3&&version[1]>=10)return {command,args,version:version.join('.')};
    }catch{/* A Windows application alias is not necessarily Python. */}
  }
  throw new Error(override?'FROM_ZERO_PYTHON 无法运行 Python 3.10+，请检查解释器路径。':'需要 Python 3.10+。请从 https://www.python.org/downloads/ 安装；也可用 FROM_ZERO_PYTHON 指定解释器完整路径。');
}

export function runPython(python,args,options={}){
  return spawnSync(python.command,[...python.args,...args],{windowsHide:true,...options});
}
