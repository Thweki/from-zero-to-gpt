export interface CodeVersion {
  id: string;
  name: string;
  code: string;
  savedAt: string;
}

export const MAX_CODE_VERSIONS = 5;
export const MAX_VERSION_NAME = 60;
export const MAX_VERSION_CODE = 100000;

export function validateCodeVersions(value: unknown): CodeVersion[] {
  if (!Array.isArray(value) || value.length > MAX_CODE_VERSIONS) throw new Error('代码版本数量无效');
  const ids = new Set<string>();
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || typeof item.id !== 'string' || !/^[\w-]{1,64}$/.test(item.id) || ids.has(item.id)
      || typeof item.name !== 'string' || !item.name.trim() || item.name.length > MAX_VERSION_NAME
      || typeof item.code !== 'string' || item.code.length > MAX_VERSION_CODE
      || typeof item.savedAt !== 'string' || item.savedAt.length > 40 || !Number.isFinite(Date.parse(item.savedAt))) {
      throw new Error('代码版本格式无效或内容过长');
    }
    ids.add(item.id);
    return {id:item.id, name:item.name, code:item.code, savedAt:item.savedAt};
  });
}
