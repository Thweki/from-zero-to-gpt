import {useEffect, useSyncExternalStore} from 'react';
import type {LearningState} from './types';

const systemQuery = '(prefers-color-scheme: dark)';
const getSystemTheme = () => window.matchMedia?.(systemQuery).matches ? 'dark' : 'light';
function subscribeSystemTheme(onChange: () => void) {
  const media = window.matchMedia?.(systemQuery);
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
}

/** Keep the saved preference separate from the OS-dependent rendered theme. */
export function useTheme(preference: LearningState['theme'], ready: boolean) {
  const systemTheme = useSyncExternalStore(subscribeSystemTheme, getSystemTheme);
  const theme = preference === 'system' ? systemTheme : preference;
  useEffect(() => {
    // Do not replace the first-paint hint before IndexedDB has loaded.
    if (!ready) return;
    document.documentElement.dataset.theme = theme;
    const chrome = getComputedStyle(document.documentElement).getPropertyValue('--chrome-bg').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', chrome || (theme === 'dark' ? '#191b1d' : '#f7f7f2'));
    // A paint hint only: IndexedDB remains the canonical, exported preference.
    try { localStorage.setItem('from-zero-to-gpt:theme', preference); } catch { /* Storage can be unavailable. */ }
  }, [preference, theme, ready]);
  return theme;
}
