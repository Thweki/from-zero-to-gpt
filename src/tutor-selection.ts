/** Explicitly selected material, separate from private notes and editor contents. */
export interface TutorSelection {
  kind: 'text' | 'image';
  title: string;
  text: string;
  /** A local, rasterized preview. Never an external URL or executable SVG. */
  image?: string;
}
export const selectionImageLimit = 240000;
export function validateTutorSelection(value: unknown): TutorSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('选中内容格式无效');
  const v = value as Record<string, unknown>;
  if (!['text', 'image'].includes(String(v.kind)) || typeof v.title !== 'string' || !v.title.trim() || v.title.length > 160 || typeof v.text !== 'string' || !v.text.trim() || v.text.length > 3000) throw new Error('选中内容无效或过长');
  const result: TutorSelection = {kind: v.kind as TutorSelection['kind'], title: v.title, text: v.text};
  if (v.image !== undefined) {
    if (v.kind !== 'image' || typeof v.image !== 'string' || v.image.length > selectionImageLimit || !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(v.image)) throw new Error('图片预览格式无效或过大');
    const encoded = v.image.split(',')[1];
    if (encoded.length % 4 !== 0 || !(v.image.startsWith('data:image/png;') ? encoded.startsWith('iVBORw0KGgo') : encoded.startsWith('/9j/'))) throw new Error('图片内容格式无效');
    result.image = v.image;
  }
  return result;
}
export function selectionSummary(selection: TutorSelection): string {
  return `【选中的${selection.kind === 'image' ? '图表' : '文字'}：${selection.title}】\n${selection.text}`;
}
