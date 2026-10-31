import { mkdir, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('pyodide/package.json'));
await mkdir('public/python', { recursive: true });
for (const file of ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) {
  await copyFile(join(root, file), join('public/python', file));
}
for (const file of ['LICENSE','CPYTHON-LICENSE']) {
  await copyFile(join('third_party/pyodide',file),join('public/python',file));
}
await mkdir('public/licenses',{recursive:true});
await copyFile('LICENSE','public/licenses/from-zero-to-gpt-LICENSE');
await copyFile('THIRD_PARTY_NOTICES.md','public/licenses/THIRD_PARTY_NOTICES.md');
for (const name of ['react','react-dom','katex','lucide-react','idb']) {
  await copyFile(join('node_modules',name,'LICENSE'),join('public/licenses',`${name}-LICENSE`));
}

await copyFile('node_modules/react-markdown/license','public/licenses/react-markdown-LICENSE');
