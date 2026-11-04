export type ServiceAuthMethod='api-key'|'github-copilot'|'none';
export interface ProviderService {
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
  id?:string;
  name:string;
  baseUrl:string;
  model:string;
  authMethod:ServiceAuthMethod;
  allowLocalHttp?:boolean;
}
export interface ProviderServiceStore {
  snapshot():Promise<ProviderServiceSnapshot>;
  save(draft:ProviderServiceDraft,secret?:string):Promise<ProviderServiceSnapshot>;
  remove(id:string):Promise<ProviderServiceSnapshot>;
  activate(id:string):Promise<ProviderServiceSnapshot>;
  active():Promise<{service:ProviderService;secret?:string}|null>;
}
