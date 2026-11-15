// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { MAX_PYTHON_FILE_BYTES, readPythonFile } from './python-import';

describe('local Python file decoding', () => {
  it('preserves indentation, Chinese text, and CRLF while accepting a UTF-8 BOM', async () => {
    const code = '# 中文\r\ndef square(x):\r\n    return x * x\r\n';
    expect(await readPythonFile(new File(['\uFEFF', code], 'exercise.PY'))).toBe(code);
  });

  it('accepts exactly the byte limit', async () => {
    const code = '#'.repeat(MAX_PYTHON_FILE_BYTES);
    expect(await readPythonFile(new File([code], 'exercise.py'))).toBe(code);
  });

  it.each([
    ['exercise.txt', 'print(1)', '.py'],
    ['exercise.py', '#'.repeat(MAX_PYTHON_FILE_BYTES + 1), '100 KB'],
    ['exercise.py', '中'.repeat(34_000), '100 KB'],
    ['exercise.py', '', '没有可导入'],
    ['exercise.py', ' \r\n\t', '没有可导入'],
    ['exercise.py', 'print(1)\0', '二进制'],
  ])('rejects invalid input: %s (%#)', async (name, text, message) => {
    await expect(readPythonFile(new File([text], name))).rejects.toThrow(message);
  });

  it('rejects invalid UTF-8 without replacing characters silently', async () => {
    await expect(readPythonFile(new File([new Uint8Array([0xff, 0xfe, 65])], 'bad.py'))).rejects.toThrow('UTF-8');
  });

  it('reports a file read failure without exposing the underlying error', async () => {
    const read = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function (this: FileReader) {
      this.dispatchEvent(new ProgressEvent('error'));
    });
    try {
      await expect(readPythonFile(new File(['print(1)'], 'lost.py'))).rejects.toThrow('无法读取文件');
    } finally { read.mockRestore(); }
  });
});
