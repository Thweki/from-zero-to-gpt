import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe, expect, it, vi} from 'vitest';
import type {OutputBundle} from 'rollup';
import {offlineManifest} from '../scripts/offline-build';

const source = readFileSync(new URL('../scripts/offline-worker.js', import.meta.url), 'utf8');
const base = 'https://course.test/learn/';
const prefix = `from-zero-to-gpt:offline:${base}:`;
const paths = ['index.html', 'assets/reader.js', 'assets/lab.js', 'assets/reader.css', 'assets/font.woff2'];
type Event = {waitUntil: (promise: Promise<unknown>) => void; respondWith: (promise: Promise<Response>) => void; request?: Request};

function worker(enabled = true) {
  const stores = new Map<string, Map<string, Response>>();
  const cache = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: vi.fn(async (key: string) => store.get(key)?.clone()),
      put: vi.fn(async (key: string, value: Response) => { store.set(key, value.clone()); }),
    };
  };
  const caches = {open: vi.fn(async (name: string) => cache(name)), keys: async () => [...stores.keys()], delete: vi.fn(async (name: string) => stores.delete(name))};
  const fetcher = vi.fn(async (input: string | Request, _options?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;
    const type = url.endsWith('.html') ? 'text/html' : url.endsWith('.css') ? 'text/css' : url.endsWith('.js') ? 'text/javascript' : 'font/woff2';
    return new Response(`asset:${url}`, {headers: {'content-type': type}});
  });
  const handlers = new Map<string, (event: Event) => void>();
  const self = {registration: {scope: base, unregister: vi.fn(async () => true)}, clients: {claim: vi.fn(async () => {})}, skipWaiting: vi.fn(async () => {}), addEventListener: (type: string, handler: (event: Event) => void) => handlers.set(type, handler)};
  runInNewContext(source, {OFFLINE: {enabled, revision: 'new', html: '<html>exact build shell</html>', shell: paths, assets: paths}, self, caches, fetch: fetcher, URL, Response});
  async function dispatch(type: string, request?: Request) {
    const pending: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    handlers.get(type)?.({request, waitUntil: promise => pending.push(promise), respondWith: promise => { response = promise; }});
    await Promise.all(pending);
    return response;
  }
  const request = (path: string, init?: RequestInit) => new Request(new URL(path, base), init);
  return {stores, caches, fetcher, self, handlers, dispatch, request};
}

describe('experimental offline worker', () => {
  it('installs the complete immutable reader, then serves cold navigations and lazy labs offline', async () => {
    const w = worker();
    await w.dispatch('install');
    expect(w.fetcher).toHaveBeenCalledTimes(paths.length - 1);
    expect(w.fetcher.mock.calls.every(([, options]) => (options as RequestInit)?.credentials === 'omit')).toBe(true);
    await w.dispatch('activate');
    expect(w.self.clients.claim).toHaveBeenCalledOnce();
    w.fetcher.mockRejectedValue(new Error('offline'));
    const navigation = w.request('');
    Object.defineProperty(navigation, 'mode', {value: 'navigate'});
    expect(await (await w.dispatch('fetch', navigation))?.text()).toBe('<html>exact build shell</html>');
    expect(await (await w.dispatch('fetch', w.request('assets/lab.js')))?.text()).toContain('lab.js');
    expect(w.fetcher).toHaveBeenCalledTimes(paths.length - 1);
  });

  it.each([
    ['api/tutor/status', undefined], ['api/tutor/chat', {method: 'POST'}],
    ['python/pyodide.asm.wasm', undefined], ['downloads/project.zip', undefined],
    ['assets/unknown.js', undefined], ['https://elsewhere.test/assets/reader.js', undefined],
    ['assets/reader.js?token=private', undefined], ['assets/reader.js', {headers: {Authorization: 'synthetic'}}],
    ['assets/reader.js', {headers: {Range: 'bytes=0-10'}}], ['assets/reader.js', {method: 'POST'}],
  ] as [string, RequestInit | undefined][])('never intercepts excluded request %s', async (path, init) => {
    const w = worker();
    expect(await w.dispatch('fetch', w.request(path, init))).toBeUndefined();
    expect(w.caches.open).not.toHaveBeenCalled();
    expect(w.fetcher).not.toHaveBeenCalled();
  });

  it.each(['network', 'quota', '404', 'html', 'redirect'])('discards incomplete installation after %s failure', async failure => {
    const w = worker();
    if (failure === 'network') w.fetcher.mockRejectedValueOnce(new Error('offline'));
    if (failure === 'quota') w.caches.open.mockResolvedValueOnce({match: vi.fn(), put: vi.fn().mockRejectedValue(new Error('quota'))});
    if (failure === '404') w.fetcher.mockResolvedValueOnce(new Response('', {status: 404}));
    if (failure === 'html') w.fetcher.mockResolvedValueOnce(new Response('index', {headers: {'content-type': 'text/html'}})).mockResolvedValueOnce(new Response('index', {headers: {'content-type': 'text/html'}}));
    if (failure === 'redirect') {
      const response = new Response('login');
      Object.defineProperty(response, 'redirected', {value: true});
      w.fetcher.mockResolvedValueOnce(response);
    }
    await expect(w.dispatch('install')).rejects.toThrow('Offline installation incomplete');
    expect(w.stores.has(prefix + 'new')).toBe(false);
    expect(w.self.clients.claim).not.toHaveBeenCalled();
  });

  it('retires only this app scope and leaves learning storage and unrelated caches alone', async () => {
    const w = worker(false);
    w.stores.set(prefix + 'old', new Map());
    w.stores.set('unrelated-app', new Map());
    w.stores.set('from-zero-to-gpt:offline:https://course.test/other/:old', new Map());
    await w.dispatch('install');
    await w.dispatch('activate');
    expect(w.self.skipWaiting).toHaveBeenCalledOnce();
    expect(w.self.registration.unregister).toHaveBeenCalledOnce();
    expect(w.fetcher).not.toHaveBeenCalled();
    expect(w.handlers.has('fetch')).toBe(false);
    expect([...w.stores.keys()]).toEqual(['unrelated-app', 'from-zero-to-gpt:offline:https://course.test/other/:old']);
  });

  it('keeps the old build until activation and cleans obsolete generations afterward', async () => {
    const w = worker();
    w.stores.set(prefix + 'old', new Map());
    await w.dispatch('install');
    expect(w.stores.has(prefix + 'old')).toBe(true);
    expect(w.self.skipWaiting).not.toHaveBeenCalled();
    await w.dispatch('activate');
    expect([...w.stores.keys()]).toEqual([prefix + 'new']);
  });

  it('recovers an evicted asset online without letting quota failure break the response', async () => {
    const w = worker();
    w.caches.open.mockResolvedValueOnce({match: vi.fn(), put: vi.fn().mockRejectedValue(new Error('quota'))});
    expect(await (await w.dispatch('fetch', w.request('assets/lab.js')))?.text()).toContain('lab.js');
  });

  it('falls back to the network if cache storage becomes unavailable', async () => {
    const w = worker();
    w.caches.open.mockRejectedValueOnce(new Error('storage disabled'));
    expect(await (await w.dispatch('fetch', w.request('assets/lab.js')))?.text()).toContain('lab.js');
    expect(w.fetcher).toHaveBeenCalledOnce();
  });

  it('never replaces an evicted shell with a potentially different deployment', async () => {
    const w = worker();
    const navigation = w.request('index.html');
    Object.defineProperty(navigation, 'mode', {value: 'navigate'});
    expect(await (await w.dispatch('fetch', navigation))?.text()).toBe('<html>exact build shell</html>');
    expect(w.fetcher).not.toHaveBeenCalled();
  });
});

it('derives the cache allowlist from build assets, including lazy chunks but excluding source maps and public downloads', () => {
  const bundle = Object.fromEntries(['index.html', 'assets/reader.js', 'assets/lazy.js', 'assets/font.woff2', 'assets/style.css', 'assets/reader.js.map'].map(fileName => [fileName, {type: 'asset', fileName, source: ''}])) as OutputBundle;
  expect(offlineManifest(bundle).shell).toEqual(['assets/font.woff2', 'assets/lazy.js', 'assets/reader.js', 'assets/style.css', 'favicon.svg', 'index.html']);
});
