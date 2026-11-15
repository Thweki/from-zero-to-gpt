// A byte cap also keeps decoded text within the learning backup's 100,000-unit limit.
export const MAX_PYTHON_FILE_BYTES = 100_000;

export async function readPythonFile(file: File): Promise<string> {
  if (!/\.py$/i.test(file.name)) throw new Error('请选择 .py 文件。');
  if (file.size > MAX_PYTHON_FILE_BYTES) throw new Error('文件不能超过 100 KB。');
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('无法读取文件，请重新选择。'));
    reader.onabort = () => reject(new Error('文件读取已取消。'));
    reader.readAsArrayBuffer(file);
  });
  let code: string;
  try {
    code = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('请将文件保存为 UTF-8 编码后重试。');
  }
  if (code.includes('\0')) throw new Error('文件包含二进制内容，请选择 Python 文本文件。');
  if (!code.trim()) throw new Error('文件没有可导入的代码。');
  return code;
}
