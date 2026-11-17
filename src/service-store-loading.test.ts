import {mkdtemp, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {NodeProviderServiceStore} from '../server/service-store';

vi.mock('node:fs/promises', {spy: true});
const filesystem = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
const roots: string[] = [];
afterEach(async () => {
  vi.mocked(readFile).mockReset().mockImplementation(filesystem.readFile);
  await Promise.all(roots.splice(0).map(root => rm(root, {recursive: true, force: true})));
});
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fz-gpt-loading-'));
  roots.push(root);
  return {root, store: new NodeProviderServiceStore({}, root)};
}

describe('service store initialization', () => {
  it('shares a pending disk snapshot with concurrent readers and saves', async () => {
    const {root, store} = await fixture();
    let release!: () => void;
    const gate = new Promise<void>(resolve => {release = resolve;});
    vi.mocked(readFile).mockImplementation(async (...args) => {
      // Hold the initial disk reads, as can happen on a slow filesystem.
      await gate;
      return filesystem.readFile(...args);
    });
    const snapshot = store.snapshot();
    const active = store.active();
    const saved = store.save({id: 'new-service', name: 'New service', baseUrl: 'https://models.example/v1', model: 'test-model', authMethod: 'api-key'}, 'test-only-key');
    try {
      // Let the queued save reach initialization too.
      await Promise.resolve();
      expect(readFile).toHaveBeenCalledTimes(3);
    } finally {
      release();
      await Promise.all([snapshot, active, saved]);
    }
    expect((await snapshot).activeId).toBe('opencode-go');
    expect((await active)?.service.id).toBe('opencode-go');
    expect(await store.snapshot()).toEqual(await saved);
    expect((await store.active())?.service.id).toBe('new-service');
    expect(await new NodeProviderServiceStore({}, root).snapshot()).toEqual(await saved);
  });

  it('retries initialization after a failed disk read', async () => {
    const {store} = await fixture();
    vi.mocked(readFile).mockRejectedValueOnce(new Error('temporary read failure'));
    await expect(store.snapshot()).rejects.toThrow('temporary read failure');
    expect((await store.snapshot()).activeId).toBe('opencode-go');
    expect((await store.active())?.service.id).toBe('opencode-go');
  });
});
