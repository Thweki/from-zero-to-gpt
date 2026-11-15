// @vitest-environment jsdom
import {afterEach, expect, it, vi} from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
async function setup(flag?: string) {
  vi.resetModules();
  vi.stubEnv('PROD', true);
  vi.stubEnv('BASE_URL', '/');
  vi.stubEnv('VITE_EXPERIMENTAL_OFFLINE', flag);
  vi.stubGlobal('isSecureContext', true);
  const register = vi.fn();
  const getRegistration = vi.fn();
  Object.defineProperty(navigator, 'serviceWorker', {configurable: true, value: {register, getRegistration}});
  return {register, getRegistration, module: await import('./offline-reading')};
}

it.each([undefined, '0', 'true'])('defaults OFF unless the build flag is exactly 1 (%s)', async flag => {
  const {register, module} = await setup(flag);
  await module.prepareOfflineReading();
  expect(module.offlineEnabled).toBe(false);
  expect(module.offlineSnapshot()).toBe('disabled');
  expect(register).not.toHaveBeenCalled();
});

it('reports ready only after successful worker activation', async () => {
  const {register, module} = await setup('1');
  let onChange = () => {};
  const worker = {state: 'installing', addEventListener: vi.fn((_event, callback) => { onChange = callback; })};
  register.mockResolvedValue({installing: worker});
  await module.prepareOfflineReading();
  expect(register).toHaveBeenCalledWith(new URL('/offline-worker.js', location.href).href, {scope: new URL('/', location.href).href, updateViaCache: 'none'});
  expect(module.offlineSnapshot()).toBe('preparing');
  worker.state = 'activated'; onChange();
  expect(module.offlineSnapshot()).toBe('ready');
});

it('reports installation or registration failure without breaking the reader', async () => {
  const {register, module} = await setup('1');
  register.mockResolvedValue({installing: {state: 'redundant', addEventListener: vi.fn()}});
  await module.prepareOfflineReading();
  expect(module.offlineSnapshot()).toBe('unavailable');
  register.mockRejectedValue(new Error('storage unavailable'));
  await expect(module.prepareOfflineReading()).resolves.toBeUndefined();
  expect(module.offlineSnapshot()).toBe('unavailable');
});

it('does not register in development or an insecure context', async () => {
  const {register, module} = await setup('1');
  vi.stubEnv('PROD', false);
  await module.prepareOfflineReading();
  expect(register).not.toHaveBeenCalled();
  vi.stubEnv('PROD', true);
  vi.stubGlobal('isSecureContext', false);
  await module.prepareOfflineReading();
  expect(module.offlineSnapshot()).toBe('unavailable');
  expect(register).not.toHaveBeenCalled();
});

it('refreshes only its own old worker when the build flag is disabled', async () => {
  const {register, getRegistration, module} = await setup();
  const update = vi.fn();
  getRegistration.mockResolvedValue({active: {scriptURL: new URL('/offline-worker.js', location.href).href}, update});
  await module.prepareOfflineReading();
  expect(update).toHaveBeenCalledOnce();
  getRegistration.mockResolvedValue({active: {scriptURL: new URL('/other-worker.js', location.href).href}, update});
  await module.prepareOfflineReading();
  expect(update).toHaveBeenCalledOnce();
  expect(register).not.toHaveBeenCalled();
});
