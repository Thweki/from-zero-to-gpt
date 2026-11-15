import {isTauriRuntime} from './runtime';

export const offlineEnabled = import.meta.env.PROD && import.meta.env.VITE_EXPERIMENTAL_OFFLINE === '1' && !isTauriRuntime;
export type OfflineStatus = 'disabled' | 'preparing' | 'ready' | 'unavailable';
let status: OfflineStatus = offlineEnabled ? 'preparing' : 'disabled';
const listeners = new Set<() => void>();
export const offlineSnapshot = () => status;
export function subscribeOffline(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function publish(value: OfflineStatus) {
  status = value;
  listeners.forEach(listener => listener());
}

export async function prepareOfflineReading(enabled = offlineEnabled) {
  if (!import.meta.env.PROD || isTauriRuntime) return;
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    if (enabled) publish('unavailable');
    return;
  }
  const script = new URL(`${import.meta.env.BASE_URL}offline-worker.js`, location.href);
  const scope = new URL('./', script).href;
  try {
    if (!enabled) {
      // Do not register anything for a fresh default-OFF installation.
      const existing = await navigator.serviceWorker.getRegistration(scope);
      if (existing?.active?.scriptURL === script.href) await existing.update();
      return;
    }
    const registration = await navigator.serviceWorker.register(script.href, {scope, updateViaCache: 'none'});
    const worker = registration.installing || registration.waiting || registration.active;
    if (!worker) throw new Error('No offline worker');
    const update = () => {
      if (worker.state === 'activated' || registration.active) publish('ready');
      else if (worker.state === 'redundant') publish('unavailable');
    };
    worker.addEventListener('statechange', update);
    update();
  } catch {
    publish('unavailable');
  }
}
