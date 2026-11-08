export type ServiceAuthMethod='api-key'|'github-copilot'|'none'|'managed';
export interface ProviderService {
  providerId?:string;
  id:string;
  name:string;
  baseUrl:string;
  model:string;
  authMethod:ServiceAuthMethod;
  allowLocalHttp:boolean;
}
export interface ProviderServiceStatus extends ProviderService {hasCredential:boolean}
export interface ProviderServiceSnapshot {services:ProviderServiceStatus[];activeId:string|null}
export interface ProviderServiceDraft {
  providerId?:string;
  id?:string;
  name:string;
  baseUrl:string;
  model:string;
  authMethod:ServiceAuthMethod;
  allowLocalHttp?:boolean;
}
export interface ProviderServiceStore {
  managedRequest?(action:string,data:Record<string,unknown>):Promise<unknown>;
  managedChat?(messages:unknown,jobId:string,signal:AbortSignal,serviceId:string):Promise<string>;
  snapshot():Promise<ProviderServiceSnapshot>;
  save(draft:ProviderServiceDraft,secret?:string):Promise<ProviderServiceSnapshot>;
  remove(id:string):Promise<ProviderServiceSnapshot>;
  activate(id:string):Promise<ProviderServiceSnapshot>;
  active():Promise<{service:ProviderService;secret?:string}|null>;
}
