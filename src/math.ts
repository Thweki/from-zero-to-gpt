export const linear = (x: number, k: number, b: number) => k * x + b;
export const dot = (a: number[], b: number[]) => {
  if (a.length !== b.length) throw new Error('向量维度必须相同');
  return a.reduce((sum, value, i) => sum + value * b[i], 0);
};
export const norm = (a: number[]) => Math.sqrt(dot(a, a));
export const format = (x: number) => Number(x.toFixed(2)).toString();
