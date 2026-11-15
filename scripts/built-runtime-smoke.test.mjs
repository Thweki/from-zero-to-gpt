import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {answer, checkDispatch, model, provider, question} from './fixtures/built-runtime-smoke.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'built-runtime-smoke-'));
  const cleanup = [];
  const calls = [];
  const stub = createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      calls.push({method: request.method, url: request.url,
        body: JSON.parse(Buffer.concat(chunks).toString())});
      response.writeHead(200, {'Content-Type': 'application/json'});
      response.end(JSON.stringify({choices: [{message: {content: answer}}]}));
    } catch {
      response.writeHead(400);
      response.end();
    }
  });
  t.after(async () => {
    try {
      for (const stop of cleanup) await stop();
    } finally {
      await new Promise(resolve => {
        stub.close(resolve);
        stub.closeAllConnections();
      });
      await rm(directory, {recursive: true, force: true, maxRetries: 3});
    }
  });
  await new Promise((resolve, reject) => {
    stub.once('error', reject);
    stub.listen(0, '127.0.0.1', resolve);
  });
  // Allowlist OS essentials: never inherit provider credentials, NODE_OPTIONS,
  // proxy settings, .env files, or the user's persistent service configuration.
  const env = {};
  for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  Object.assign(env, {
    TMPDIR: directory, TEMP: directory, TMP: directory,
    FROM_ZERO_DATA_DIR: directory, HOST: '127.0.0.1', PORT: '0',
    TUTOR_BASE_URL: `http://127.0.0.1:${stub.address().port}/v1`,
    TUTOR_ALLOW_LOCAL_HTTP: '1', TUTOR_API_KEY: 'synthetic-smoke-key',
    TUTOR_MODEL: model, TUTOR_PROVIDER: provider,
  });
  return {env, cleanup, assertProviderCall() {
    assert.equal(calls.length, 1, 'chat must reach the local provider exactly once');
    const [call] = calls;
    assert.equal(call.method, 'POST');
    assert.equal(call.url, '/v1/chat/completions');
    assert.equal(call.body.model, model);
    assert.equal(call.body.stream, false);
    assert.equal(call.body.messages[0].role, 'system');
    assert.equal(call.body.messages.at(-1).role, 'user');
    assert.equal(JSON.parse(call.body.messages.at(-1).content).question, question);
  }};
}

function start(local, script) {
  const child = spawn(process.execPath, [script], {cwd: root, env: local.env, stdio: ['ignore', 'pipe', 'pipe']});
  let output = '', spawnError, timedOut = false;
  child.stdout.on('data', chunk => { output = (output + chunk).slice(-12000); });
  child.stderr.on('data', chunk => { output = (output + chunk).slice(-12000); });
  child.on('error', error => { spawnError = error; });
  const closed = new Promise(resolve => child.once('close', code => resolve(code)));
  // Hard lifetime cap also covers imports and handlers that ignore AbortSignal.
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 12000);
  closed.then(() => clearTimeout(timer));
  local.cleanup.push(async () => {
    child.kill('SIGKILL');
    await closed;
    clearTimeout(timer);
  });
  return {child, closed, output: () => output, async success() {
    const code = await closed;
    assert.ifError(spawnError);
    assert.equal(timedOut, false, `Runtime exceeded 12 seconds:\n${output}`);
    assert.equal(code, 0, `Runtime failed:\n${output}`);
  }};
}

test('built Node server dispatches HTTP API and static assets', {timeout: 20000}, async t => {
  const local = await fixture(t);
  // serve.mjs logs the configured port, so reserve an ephemeral port first.
  const reservation = createServer();
  await new Promise((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  local.env.PORT = String(reservation.address().port);
  await new Promise(resolve => reservation.close(resolve));
  const runtime = start(local, 'scripts/serve.mjs');
  const base = await Promise.race([
    new Promise(resolve => runtime.child.stdout.on('data', () => {
      const match = runtime.output().match(/Learning platform: (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) resolve(match[1]);
    })),
    runtime.closed.then(() => { throw new Error(`Server exited before readiness:\n${runtime.output()}`); }),
  ]);
  await checkDispatch((pathname, init) => fetch(base + pathname, {
    ...init, signal: AbortSignal.timeout(3000),
  }));
  const page = await fetch(base + '/', {signal: AbortSignal.timeout(3000)});
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(await page.text(), /From Zero to GPT/);
  local.assertProviderCall();
});

test('built Worker dispatches API requests and delegates assets', {timeout: 20000}, async t => {
  const local = await fixture(t);
  const runtime = start(local, 'scripts/fixtures/built-runtime-smoke.mjs');
  await runtime.success();
  local.assertProviderCall();
});
