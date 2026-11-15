import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import ts from 'typescript';

test('the production type check rejects errors in runtime and tooling entry points', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const configPath = resolve(root, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, path => readFileSync(path, 'utf8'));
  expect(config.error).toBeUndefined();
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  expect(parsed.errors).toEqual([]);

  // These files are transpiled/bundled without semantic checks by their runners.
  // Inject a real type error in memory so the test proves tsc actually visits each
  // entry point, without changing source files or depending on a failing build.
  const entryPoints = [
    'server/worker.ts',
    'server/provider-worker.ts',
    'scripts/native-content.ts',
    'vite.config.ts',
    'vitest.config.ts',
    'playwright.config.ts',
  ].map(path => resolve(root, path));
  const host = ts.createCompilerHost(parsed.options);
  const readFile = host.readFile.bind(host);
  host.readFile = path => {
    const source = readFile(path);
    if (source === undefined || !entryPoints.includes(resolve(path))) return source;
    return `${source}\nconst typecheckRegression: never = 'must be rejected';\n`;
  };
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);
  for (const path of entryPoints) {
    const source = program.getSourceFile(path);
    const errors = source ? program.getSemanticDiagnostics(source) : [];
    expect(errors.some(error => error.code === 2322
      && ts.flattenDiagnosticMessageText(error.messageText, '\n').includes("'never'")), path).toBe(true);
  }
});
