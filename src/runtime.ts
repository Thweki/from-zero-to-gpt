export const isTauriRuntime=typeof location!=='undefined'&&(location.protocol==='tauri:'||location.hostname==='tauri.localhost');

export async function enableNativeMaterial(){
  if(!isTauriRuntime)return;
  try{
    const {invoke}=await import('@tauri-apps/api/core');
    const status=await invoke<{kind:string;active:boolean}>('native_material_status');
    document.documentElement.dataset.nativeMaterial=status.active?'true':'false';
    document.documentElement.dataset.materialKind=status.kind;
  }catch{document.documentElement.dataset.nativeMaterial='false';}
}

export function tutorApiUrl(path:string,standalone=isTauriRuntime,origin=import.meta.env.VITE_TUTOR_API_ORIGIN){
  if(!standalone)return `/api/tutor/${path}`;
  if(!origin)return null;
  try{
    const url=new URL(origin);
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')return null;
    return new URL(`/api/tutor/${path}`,url).toString();
  }catch{return null;}
}
