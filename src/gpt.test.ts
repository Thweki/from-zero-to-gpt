import { describe, expect, it } from 'vitest';
import { samplingDistribution, sampleIndex, seededUniform } from './components/labs/GPTLab';
import { stage5Lessons } from './data/stage5';

describe('GPT generation probability rules', () => {
  it('includes the top-p crossing token and renormalizes', () => {
    const result = samplingDistribution([.5, .3, .15, .05].map(Math.log), 1, 0, .7);
    expect(result.kept).toEqual([0, 1]);
    expect(result.final[0]).toBeCloseTo(.625, 12);
    expect(result.final[1]).toBeCloseTo(.375, 12);
    expect(result.final.slice(2)).toEqual([0, 0]);
  });
  it('uses top-k before the cumulative top-p calculation', () => {
    const result = samplingDistribution([.5, .3, .15, .05].map(Math.log), 1, 2, .6);
    expect(result.kept).toEqual([0]); // 0.5 / (0.5 + 0.3) = 0.625
    expect(result.final).toEqual([1, 0, 0, 0]);
  });
  it('remains stable for large logits and changes sharpness with temperature', () => {
    const cold = samplingDistribution([1000, 1002], .5, 0, 1);
    const hot = samplingDistribution([1000, 1002], 2, 0, 1);
    expect(cold.final[1]).toBeGreaterThan(hot.final[1]);
    expect(cold.final.reduce((a, b) => a + b)).toBeCloseTo(1, 14);
  });
  it('samples using cumulative intervals and deterministic seed/step inputs', () => {
    expect(sampleIndex([.625, .375, 0], .624)).toBe(0);
    expect(sampleIndex([.625, .375, 0], .625)).toBe(1);
    expect(sampleIndex([0, 0, 1], 0)).toBe(2);
    expect(seededUniform(42, 3)).toBe(seededUniform(42, 3));
    expect(seededUniform(42, 3)).not.toBe(seededUniform(42, 4));
  });
  it('rejects undefined probability controls', () => {
    expect(() => samplingDistribution([0, 1], 0, 0, 1)).toThrow();
    expect(() => samplingDistribution([0, 1], 1, 0, 0)).toThrow();
    expect(() => sampleIndex([.5, .5], 1)).toThrow();
  });
});
describe('stage five original course', () => {
  it('has thirteen complete chapters with distinct runnable learning targets', () => {
    expect(stage5Lessons).toHaveLength(13);
    expect(new Set(stage5Lessons.map(l => l.reference)).size).toBe(13);
    for (const lesson of stage5Lessons) {
      expect(lesson.intuition.length).toBeGreaterThanOrEqual(2);
      expect(lesson.math.length).toBeGreaterThanOrEqual(2);
      expect(lesson.quiz.options).toHaveLength(4);
      expect(lesson.pythonTests).toContain('assert');
      expect(lesson.references.every(r => new URL(r.url).protocol === 'https:')).toBe(true);
    }
  });
});
