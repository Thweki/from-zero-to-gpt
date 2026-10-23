import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

/** macOS /var aliases and Windows junction/short paths identify the same entry. */
export function isMain(url){
  if(!process.argv[1])return false;
  try{
    const entry=realpathSync.native(process.argv[1]),module=realpathSync.native(fileURLToPath(url));
    return process.platform==='win32'?entry.toLowerCase()===module.toLowerCase():entry===module;
  }catch{return false;}
}
