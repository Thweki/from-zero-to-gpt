import {describe, expect, it, vi} from 'vitest';
import {buildTutorMessages, handleTutorRequest, validateTutorBody} from '../server/tutor';
import {validateProviderService} from '../server/service-store';

const input = {
  lessonId: 'functions', message: '为什么？', history: [], mode: 'guide',
  difficulty: 'beginner', readingMode: 'intuition', sessionId: 'unicode-tests',
};

// Mirror the native boundary cases with JavaScript's UTF-16 length semantics.
describe.each(['a', '中', '😀'])('tutor text limits: %s', character => {
  it.each([['message', 4000], ['code', 16000], ['error', 8000], ['note', 4000]] as const)(
    '%s accepts the web limit and rejects one extra UTF-16 unit', (field, limit) => {
      const text = character.repeat(limit / character.length);
      const body = {...input, shareCode: true, shareNote: true, [field]: text};
      expect(validateTutorBody(body)[field]).toBe(text);
      expect(() => validateTutorBody({...body, [field]: text + 'a'})).toThrow();
    },
  );

  it('accepts shared content sliced to the frontend/native limits', () => {
    const code = character.repeat(8000).slice(0, 8000);
    const error = character.repeat(3000).slice(0, 3000);
    const note = character.repeat(2000).slice(0, 2000);
    expect(validateTutorBody({...input, shareCode: true, shareNote: true, code, error, note}))
      .toMatchObject({code, error, note});
  });

  it.each([['title', 160], ['text', 3000]] as const)(
    'selection %s uses UTF-16 units', (field, limit) => {
      const text = character.repeat(limit / character.length);
      const selection = {kind: 'text', title: '标题', text: '选区', [field]: text};
      expect(validateTutorBody({...input, selection}).selection?.[field]).toBe(text);
      expect(() => validateTutorBody({...input, selection: {...selection, [field]: text + 'a'}})).toThrow();
    },
  );

  it('preserves a follow-up history entry sliced to 8000 units', () => {
    const content = character.repeat(8001).slice(0, 8000);
    const history = [{role: 'user', content: '上一个问题'}, {role: 'assistant', content}];
    expect(buildTutorMessages(validateTutorBody({...input, history}))[2].content).toBe(content);
    expect(() => validateTutorBody({...input, history: [{role: 'assistant', content: content + 'a'}]})).toThrow();
    expect(() => validateTutorBody({...input, history: Array(12).fill(history[0])})).not.toThrow();
    expect(() => validateTutorBody({...input, history: Array(13).fill(history[0])})).toThrow();
  });

  it.each([['name', 60], ['model', 160]] as const)(
    'service %s uses UTF-16 units after trimming', (field, limit) => {
      const text = character.repeat(limit / character.length);
      const draft = {id: 'unicode-test', name: '服务', model: '模型', baseUrl: 'https://example.com/v1', authMethod: 'none' as const};
      expect(validateProviderService({...draft, [field]: ` ${text} `})[field]).toBe(text);
      expect(() => validateProviderService({...draft, [field]: text + 'a'})).toThrow();
    },
  );
});

it('accepts the 1334-Chinese-character regression case', () => {
  const message = '中'.repeat(1334);
  expect(new TextEncoder().encode(message).length).toBe(4002);
  expect(validateTutorBody({...input, message}).message).toBe(message);
});

it('keeps transport byte caps independent of valid UTF-16 field lengths', async () => {
  const body = {...input, history: Array(3).fill({role: 'assistant', content: '中'.repeat(8000)})};
  expect(() => validateTutorBody(body)).not.toThrow();
  const fetcher = vi.fn();
  const response = await handleTutorRequest(new Request('https://example.com/api/tutor/chat', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
  }), {TUTOR_API_KEY: 'test-only'}, fetcher);
  expect(response.status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});
