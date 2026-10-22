// Node >= 22.18: built-in TypeScript type stripping; no extra runtime dependency.
// Executes repository-owned reference examples only, never user-supplied website code.
import { spawnSync } from 'node:child_process';
import { lessons } from '../src/data/lessons.ts';

let failures = 0;
for (const lesson of lessons) {
  const reference = spawnSync('python3', ['-c', lesson.reference + '\n' + lesson.pythonTests], {
    encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024,
  });
  if (reference.error || reference.status !== 0) {
    failures++;
    console.error(`FAIL ${lesson.id}: 参考实现或验收断言失败`);
    console.error(reference.error?.message || reference.stderr);
    continue;
  }
  const starter = spawnSync('python3', ['-c', lesson.starter + '\n' + lesson.pythonTests], {
    encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024,
  });
  if (starter.error || starter.status === 0 || !starter.stderr.includes('AssertionError')) {
    failures++;
    console.error(`FAIL ${lesson.id}: 练习应可运行并由验收断言指出待完成部分`);
    console.error(starter.error?.message || starter.stderr);
    continue;
  }
  console.log(`PASS ${lesson.id}: 参考实现通过，练习的 TODO 被验收测试识别`);
}
console.log(`${lessons.length - failures}/${lessons.length} 课程代码验证通过`);
if (failures) process.exitCode = 1;
