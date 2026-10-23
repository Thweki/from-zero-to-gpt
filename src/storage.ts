import { openDB } from 'idb';
import type { LearningState, LessonId, LessonProgress } from './types';
export { lessonIds } from './data/lesson-ids';
import { lessonIds } from './data/lesson-ids';
export const emptyProgress = (): LessonProgress => ({ status: 'new', mode: 'intuition', note: '', code: '', review: false });
export const initialState = (): LearningState => ({version:1,theme:'light',lastLesson:'functions',progress:{},updatedAt:new Date().toISOString()});
const database = () => openDB('from-zero-to-gpt', 1, {upgrade(db) {db.createObjectStore('learning');}});
export async function readState(): Promise<LearningState> {
  const db = await database();
  try {const data = await db.get('learning', 'state'); return data ? validateImport(data) : initialState();} finally {db.close();}
}
export async function writeState(state: LearningState) {
  const db = await database();
  try {await db.put('learning', state, 'state');} finally {db.close();}
}
const parameterKeys = new Set('x k b ax ay bx by kind a c y window base exponent input rows cols cellrow cellcol cell a11 a12 a21 a22 bscale bshear prior sensitivity falsepositive n p view x1 x2 x3 w1 w2 w3 h point direction rate steps startx starty w activation w2 v1 v2 c nnStep lr lambda optimizer velocity moment secondMoment iteration dropout mask scalingBudget scalingParameters sftLogit sftPromptTokens dpoPolicyMargin dpoReferenceMargin dpoBeta inferenceTemperature inferenceTopK inferenceUniform cacheLength quantBits quantOutlier loraRank loraAlpha memoryParameters memoryWeightBits memoryBatch memoryContext memoryKVHeads memoryBandwidth factualityThreshold evaluationSeen paperRuns paperEffect'.split(' '));
const isParameter=(key:string)=>parameterKeys.has(key)||/^(ml|tf|gpt)[A-Za-z0-9_]{1,28}$/.test(key);
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function checkedString(v: unknown, max = 100000): string {if(typeof v !== 'string' || v.length > max) throw new Error('学习数据中的文字格式无效或过长'); return v;}
export function validateImport(value: unknown): LearningState {
  if (!isObject(value) || value.version !== 1 || !lessonIds.includes(value.lastLesson as LessonId) || !['light','dark'].includes(value.theme as string) || !isObject(value.progress)) throw new Error('不支持的学习数据格式，请选择本平台导出的 JSON 文件');
  if (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) throw new Error('学习数据时间无效');
  const result = initialState(); result.theme = value.theme as LearningState['theme']; result.lastLesson = value.lastLesson as LessonId; result.updatedAt = value.updatedAt;
  for (const [key, p] of Object.entries(value.progress)) {
    if (!lessonIds.includes(key as LessonId) || !isObject(p) || !['new','learning','mastered'].includes(p.status as string) || !['intuition','math','code','deep'].includes(p.mode as string) || typeof p.review !== 'boolean') throw new Error('章节进度格式无效');
    const progress: LessonProgress = { status:p.status as LessonProgress['status'],mode:p.mode as LessonProgress['mode'],note:checkedString(p.note),code:checkedString(p.code),review:p.review };
    if (p.quizAnswer !== undefined) {if (!Number.isInteger(p.quizAnswer) || Number(p.quizAnswer)<0 || Number(p.quizAnswer)>3) throw new Error('自测数据无效');progress.quizAnswer = p.quizAnswer as number;}
    if (p.quizPassed !== undefined) {if (typeof p.quizPassed !== 'boolean') throw new Error('自测状态无效');progress.quizPassed=p.quizPassed;}
    if (p.lastRun !== undefined) progress.lastRun=checkedString(p.lastRun);
    if(p.tutorDraft!==undefined)progress.tutorDraft=checkedString(p.tutorDraft,4000);
    if(p.tutorMessages!==undefined){if(!Array.isArray(p.tutorMessages)||p.tutorMessages.length>80)throw new Error('导师记录格式无效');progress.tutorMessages=p.tutorMessages.map(m=>{if(!isObject(m)||!['user','assistant'].includes(m.role as string)||typeof m.createdAt!=='string'||!Number.isFinite(Date.parse(m.createdAt)))throw new Error('导师记录格式无效');return {role:m.role as 'user'|'assistant',content:checkedString(m.content,24000),createdAt:m.createdAt};});}
    if (p.labValues !== undefined) {if (!isObject(p.labValues)||Object.keys(p.labValues).length>256) throw new Error('实验参数无效'); progress.labValues = {}; for (const [k,v] of Object.entries(p.labValues)) {if (!isParameter(k) || typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v)>(['x','k','b','ax','ay','bx','by','kind'].includes(k)?100:1e12)) throw new Error('实验参数无效'); progress.labValues[k]=v;}}
    result.progress[key as LessonId]=progress;
  }
  if (value.checkpoint !== undefined) {
    const c=value.checkpoint;
    if (!isObject(c) || !lessonIds.includes(c.lessonId as LessonId) || typeof c.savedAt !== 'string' || !Number.isFinite(Date.parse(c.savedAt))) throw new Error('学习断点格式无效');
    result.checkpoint={lessonId:c.lessonId as LessonId,question:checkedString(c.question),next:checkedString(c.next),savedAt:c.savedAt,code:checkedString(c.code),runResult:checkedString(c.runResult)};
  }
  return result;
}
