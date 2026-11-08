import type {ProviderServiceSnapshot} from './provider-services';
export interface ProviderCatalogEntry {id:string;name:string;modelCount:number;methods:{id:'api_key'|'oauth';name:string;description?:string}[]}
export interface ProviderModelOption {id:string;name:string}
export interface ProviderLoginState {
 sessionId:string;providerId:string;state:'waiting'|'complete'|'error';error?:string;snapshot?:ProviderServiceSnapshot;
 event?:{type:string;message?:string;url?:string;instructions?:string;userCode?:string;verificationUri?:string;links?:{url:string;label?:string}[]};
 notice?:{type:string;message?:string;links?:{url:string;label?:string}[]};
 prompt?:{id:string;type:'text'|'secret'|'select'|'manual_code';message:string;placeholder?:string;options?:{id:string;label:string;description?:string}[]};
}
