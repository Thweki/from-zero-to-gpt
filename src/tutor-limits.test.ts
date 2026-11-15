import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {handleTutorRequest} from '../server/tutor';

const env = {TUTOR_API_KEY: 'test-only-provider-secret'};
const hour = 60 * 60 * 1000;
const start = Date.UTC(2026, 0, 1);
const answer = () => Response.json({choices: [{message: {content: '回答'}}]});
let nextActor = 0;
let actor: string;
let controllers: AbortController[];
let requests: Promise<Response>[];

function send(fetcher: typeof fetch, caller = actor) {
  const controller = new AbortController();
  controllers.push(controller);
  const request = new Request('https://learning.example/api/tutor/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'CF-Connecting-IP': caller},
    body: JSON.stringify({lessonId: 'functions', message: '为什么？', sessionId: 'limiter-test-session'}),
    signal: controller.signal,
  });
  const response = handleTutorRequest(request, env, fetcher);
  requests.push(response);
  return {response, controller};
}

function pendingProvider() {
  const calls: {resolve: (response: Response) => void; reject: (error: Error) => void; signal: AbortSignal}[] = [];
  const fetcher = vi.fn<typeof fetch>((_url, init) => new Promise<Response>((resolve, reject) => {
    const signal = init!.signal!;
    calls.push({resolve, reject, signal});
    if (signal.aborted) reject(new Error('aborted'));
    else signal.addEventListener('abort', () => reject(new Error('aborted')), {once: true});
  }));
  const begin = async () => {
    const request = send(fetcher);
    // Drain request-body reads without advancing the provider timeout.
    await vi.advanceTimersByTimeAsync(0);
    return request;
  };
  return {fetcher, calls, begin};
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(start);
  actor = `limiter-test-${nextActor++}`;
  controllers = [];
  requests = [];
});

afterEach(async () => {
  // Also release pending work when an assertion fails.
  controllers.forEach(controller => controller.abort());
  await Promise.all(requests);
  vi.useRealTimers();
});

describe('导师本地配额与并发限制', () => {
  it('同一调用者每小时允许 60 次，第 61 次不调用上游，其他调用者不受影响', async () => {
    const fetcher = vi.fn(async () => answer());
    for (let i = 0; i < 60; i++) expect((await send(fetcher).response).status).toBe(200);
    expect((await send(fetcher).response).status).toBe(429);
    expect(fetcher).toHaveBeenCalledTimes(60);
    expect((await send(fetcher, `${actor}-other`).response).status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(61);
  });

  it('配额在一小时边界恢复，提前重试不会延长窗口', async () => {
    const fetcher = vi.fn(async () => answer());
    for (let i = 0; i < 60; i++) await send(fetcher).response;
    vi.setSystemTime(start + hour - 1);
    expect((await send(fetcher).response).status).toBe(429);
    vi.setSystemTime(start + hour);
    expect((await send(fetcher).response).status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(61);
  });

  it('窗口过期时重置配额，但保留在途请求及其完成后的并发计数', async () => {
    const fetcher = vi.fn(async () => answer());
    for (let i = 0; i < 59; i++) await send(fetcher).response;
    vi.setSystemTime(start + hour - 1);
    const provider = pendingProvider();
    const old = await provider.begin();
    expect(provider.calls).toHaveLength(1);

    vi.setSystemTime(start + hour + 1);
    const fresh = await provider.begin();
    expect(provider.calls).toHaveLength(2);
    expect((await send(provider.fetcher).response).status).toBe(429);

    provider.calls[0].resolve(answer());
    expect((await old.response).status).toBe(200);
    const replacement = await provider.begin();
    expect(provider.calls).toHaveLength(3);
    expect((await send(provider.fetcher).response).status).toBe(429);
    expect(provider.fetcher).toHaveBeenCalledTimes(3);
    provider.calls[1].resolve(answer());
    provider.calls[2].resolve(answer());
    expect((await fresh.response).status).toBe(200);
    expect((await replacement.response).status).toBe(200);
  });

  it.each(['success', 'network', 'provider-error', 'invalid-json', 'empty-answer', 'cancel'])(
    '最多两个在途请求，%s 后释放一个位置', async outcome => {
      const provider = pendingProvider();
      const first = await provider.begin();
      await provider.begin();
      expect(provider.calls).toHaveLength(2);
      expect((await send(provider.fetcher).response).status).toBe(429);
      expect(provider.fetcher).toHaveBeenCalledTimes(2);

      if (outcome === 'cancel') first.controller.abort();
      else if (outcome === 'network') provider.calls[0].reject(new Error('synthetic network failure'));
      else provider.calls[0].resolve(outcome === 'success' ? answer()
        : outcome === 'provider-error' ? new Response('unavailable', {status: 503})
        : outcome === 'invalid-json' ? new Response('{') : Response.json({choices: []}));
      expect((await first.response).status).toBe(outcome === 'success' ? 200 : outcome === 'cancel' ? 504 : 502);
      if (outcome === 'cancel') expect(provider.calls[0].signal.aborted).toBe(true);

      await provider.begin();
      expect(provider.calls).toHaveLength(3);
      expect((await send(provider.fetcher).response).status).toBe(429);
      expect(provider.fetcher).toHaveBeenCalledTimes(3);
    },
  );

  it('60 秒超时取消上游并释放并发位置', async () => {
    const provider = pendingProvider();
    const first = await provider.begin();
    await vi.advanceTimersByTimeAsync(1000);
    await provider.begin();
    expect((await send(provider.fetcher).response).status).toBe(429);
    await vi.advanceTimersByTimeAsync(59000);
    expect((await first.response).status).toBe(504);
    expect(provider.calls[0].signal.aborted).toBe(true);
    expect(provider.calls[1].signal.aborted).toBe(false);
    await provider.begin();
    expect(provider.calls).toHaveLength(3);
    expect((await send(provider.fetcher).response).status).toBe(429);
    expect(provider.fetcher).toHaveBeenCalledTimes(3);
  });
});
