// JavaScript string lengths (UTF-16 code units), shared by editing and storage.
export const learningLimits = {
  text: 100_000,
  observationDraft: 4_000,
  observationSnapshot: 3_000,
  tutorDraft: 4_000,
  tutorMessage: 24_000,
} as const;
export const textLimitMessage = (limit: number) => `最多 ${limit.toLocaleString('en-US')} 个文字单位（UTF-16）；超长修改未应用，请缩短后重试，原有内容已保留。`;
