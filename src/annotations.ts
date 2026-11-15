import type {LessonAnnotation} from './types';

export const maxAnnotations = 50;
export const annotationTextLimit = 4000;
export const annotationModeLabels = {intuition:'直觉理解', math:'数学推导', deep:'深入研究'};

export function validateAnnotations(value:unknown):LessonAnnotation[] {
  if (!Array.isArray(value) || value.length > maxAnnotations) throw new Error('章节批注格式无效');
  const ids = new Set<string>();
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
      typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(item.id) || ids.has(item.id) ||
      !['intuition','math','deep'].includes(item.mode) ||
      typeof item.quote !== 'string' || !item.quote.trim() || item.quote.length > 3000 ||
      typeof item.text !== 'string' || item.text.length > annotationTextLimit ||
      typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) throw new Error('章节批注格式无效');
    ids.add(item.id);
    return {id:item.id, mode:item.mode, quote:item.quote, text:item.text, createdAt:item.createdAt};
  });
}
