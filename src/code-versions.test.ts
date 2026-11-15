import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {MAX_CODE_VERSIONS, MAX_VERSION_CODE, MAX_VERSION_NAME, validateCodeVersions} from './code-versions';
import {emptyProgress, initialState, readState, validateImport, writeState} from './storage';

const version = {id:'version-1', name:'循环实现', code:'for x in range(3):\n    print(x)\n', savedAt:'2026-11-15T12:00:00.000Z'};

describe('saved code versions', () => {
  it('keeps old backups compatible without inventing versions', () => {
    const state = initialState();
    state.progress.functions = emptyProgress();
    expect(validateImport(state)).toEqual(state);
    expect(validateImport(state).progress.functions).not.toHaveProperty('codeVersions');
  });

  it('round-trips exact code and separate lesson versions through backup and IndexedDB', async () => {
    const state = initialState();
    state.progress.functions = {...emptyProgress(), code:'unsaved experiment', codeVersions:[version]};
    state.progress.linear = {...emptyProgress(), codeVersions:[{...version, code:''}]};
    const imported = validateImport(JSON.parse(JSON.stringify(state)));
    expect(imported).toEqual(state);
    await writeState(imported);
    expect(await readState()).toEqual(state);
  });

  it('accepts boundaries and strips unknown fields without mutating the source', () => {
    const input = Array.from({length:MAX_CODE_VERSIONS}, (_, i) => ({...version, id:`v-${i}`, name:'名'.repeat(MAX_VERSION_NAME), code:'x'.repeat(MAX_VERSION_CODE), codePassed:true}));
    const output = validateCodeVersions(input);
    expect(output).toHaveLength(MAX_CODE_VERSIONS);
    expect(output[0]).not.toHaveProperty('codePassed');
    expect(input[0]).toHaveProperty('codePassed', true);
    expect(output[0]).not.toBe(input[0]);
  });

  it.each([
    null, {}, [null], [[]], [version, version],
    Array.from({length:MAX_CODE_VERSIONS+1}, (_, i) => ({...version, id:`v-${i}`})),
    [{...version, id:''}], [{...version, id:'x'.repeat(65)}], [{...version, id:'<script>'}],
    [{...version, name:'   '}], [{...version, name:1}], [{...version, name:'x'.repeat(MAX_VERSION_NAME+1)}],
    [{...version, code:null}], [{...version, code:'x'.repeat(MAX_VERSION_CODE+1)}],
    [{...version, savedAt:'yesterday'}], [{...version, savedAt:1}],
  ])('rejects malformed or oversized version data (case %#)', value => {
    const state = initialState();
    state.progress.functions = {...emptyProgress(), codeVersions:value as never};
    expect(() => validateImport(state)).toThrow();
  });
});
