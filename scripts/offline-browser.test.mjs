import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, copyFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {build} from 'vite';
import {chromium, expect} from '@playwright/test';

test('production reader: default OFF, cold offline restart, excluded API, and retirement', {timeout: 120000}, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gpt-offline-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const previous = process.env.VITE_EXPERIMENTAL_OFFLINE;
  t.after(() => { if (previous === undefined) delete process.env.VITE_EXPERIMENTAL_OFFLINE; else process.env.VITE_EXPERIMENTAL_OFFLINE = previous; });
  for (const flag of ['0', '1']) {
    process.env.VITE_EXPERIMENTAL_OFFLINE = flag;
    await build({logLevel: 'silent', publicDir: false, build: {outDir: path.join(directory, flag)}});
    await copyFile('public/favicon.svg', path.join(directory, flag, 'favicon.svg'));
  }
  let flag = '0';
  const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml'};
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) {
      res.writeHead(200, {'content-type': 'application/json', 'cache-control': 'no-store'});
      res.end('{"configured":false}'); return;
    }
    try {
      const root = path.join(directory, flag);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + path.sep)) throw new Error('path');
      const content = await readFile(file);
      res.writeHead(200, {'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store'});
      res.end(content);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(origin + '/#/settings');
  await expect(page.getByRole('heading', {name: '学习数据', exact: true})).toBeVisible();
  assert.deepEqual(await page.evaluate(() => caches.keys()), []);
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);

  flag = '1';
  await page.reload();
  await expect(page.getByRole('status').filter({hasText: '教材已可离线重开。'})).toBeVisible({timeout: 30000});
  await page.evaluate(() => fetch('/api/tutor/status'));
  const cached = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async name => (await (await caches.open(name)).keys()).map(request => request.url)))).flat());
  assert.ok(cached.some(url => url.includes('TransformerLab') && url.endsWith('.js')));
  assert.ok(cached.every(url => !/\/api\/|\/python\/|\/downloads\//.test(url)));
  await page.close();
  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto(origin + '/#/lesson/functions');
  await expect(offline.getByRole('heading', {name: '函数是什么', exact: true})).toBeVisible();
  await offline.reload();
  await expect(offline.getByRole('tab', {name: '数学推导', exact: true})).toBeVisible();
  await offline.getByRole('tab', {name: '数学推导', exact: true}).click();
  await expect(offline.locator('.katex').first()).toBeVisible();
  await offline.goto(origin + '/#/lesson/attention');
  await expect(offline.locator('.tf-lab')).toBeVisible();
  assert.equal(await offline.evaluate(() => fetch('/api/tutor/status').then(() => true, () => false)), false);

  await context.setOffline(false);
  flag = '0';
  await offline.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); });
  await expect.poll(() => offline.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  assert.deepEqual(await offline.evaluate(() => caches.keys()), []);
  await offline.reload();
  await expect(offline.locator('.tf-lab')).toBeVisible();
  await context.close();
});
