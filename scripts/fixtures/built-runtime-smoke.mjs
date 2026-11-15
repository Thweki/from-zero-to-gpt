import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

export const model = 'built-runtime-smoke-model';
export const provider = 'Local smoke provider';
export const question = 'Explain what a function returns.';
export const answer = 'A function returns a value to its caller.';

// Shared assertions exercise dispatch, not just whether the bundle can import.
export async function checkDispatch(request) {
  const status = await request('/api/tutor/status');
  assert.equal(status.status, 200);
  assert.match(status.headers.get('content-type'), /application\/json/);
  const configuration = await status.json();
  assert.equal(configuration.configured, true);
  assert.equal(configuration.model, model);
  assert.equal(configuration.provider, provider);

  const chat = await request('/api/tutor/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({lessonId: 'functions', message: question,
      history: [], mode: 'hint', sessionId: 'built-runtime-smoke'}),
  });
  assert.equal(chat.status, 200);
  assert.deepEqual(await chat.json(), {answer, model, provider, mode: 'hint'});

  const wrongMethod = await request('/api/tutor/chat');
  assert.equal(wrongMethod.status, 405);
  assert.equal(typeof (await wrongMethod.json()).error, 'string');
  const missing = await request('/api/tutor/missing');
  assert.equal(missing.status, 404);
  assert.equal(typeof (await missing.json()).error, 'string');
}

// Run the actual Worker bundle in a disposable process. ASSETS is the only
// platform binding stubbed; provider fetch uses the real loopback HTTP server.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const {default: worker} = await import('../../dist-server/worker.js');
  const assetRequests = [];
  const env = {...process.env, ASSETS: {fetch: async request => {
    assetRequests.push(request);
    return new Response('smoke asset', {status: 203, headers: {'X-Smoke-Asset': 'yes'}});
  }}};
  await checkDispatch((pathname, init) => worker.fetch(new Request(`http://worker.test${pathname}`, {
    ...init, signal: AbortSignal.timeout(3000),
  }), env));
  assert.equal(assetRequests.length, 0, 'API routes must not fall through to ASSETS');
  const assetRequest = new Request('http://worker.test/assets/smoke.txt?version=1');
  const asset = await worker.fetch(assetRequest, env);
  assert.equal(asset.status, 203);
  assert.equal(asset.headers.get('X-Smoke-Asset'), 'yes');
  assert.equal(await asset.text(), 'smoke asset');
  assert.deepEqual(assetRequests, [assetRequest]);
}
