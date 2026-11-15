import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import type {Plugin} from 'vite';
import type {OutputBundle} from 'rollup';

export function offlineManifest(bundle: OutputBundle) {
  const assets = Object.keys(bundle).filter(name => /\.(?:js|css|woff2?|ttf|svg)$/.test(name));
  // The course is bundled, not fetched per lesson. Cache a complete build so
  // the first lesson and lazy labs also work after a cold offline restart.
  const shell = [...new Set(['index.html', 'favicon.svg', ...assets])].sort();
  return {shell, assets: shell};
}

export function offlineReading(enabled: boolean): Plugin {
  return {
    name: 'experimental-offline-reading',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const manifest = offlineManifest(bundle);
      const document = bundle['index.html'];
      if (document?.type !== 'asset') throw new Error('Offline reader requires the built index.html');
      const html = String(document.source);
      const worker = readFileSync(new URL('./offline-worker.js', import.meta.url), 'utf8');
      const revision = createHash('sha256').update(worker).update(JSON.stringify(manifest))
        .update(html).digest('hex').slice(0, 16);
      // Always emit the disabled worker too: it retires a previously enabled build.
      this.emitFile({type: 'asset', fileName: 'offline-worker.js', source:
        `const OFFLINE = ${JSON.stringify({enabled, revision, html, ...manifest})};\n${worker}`});
    },
  };
}
