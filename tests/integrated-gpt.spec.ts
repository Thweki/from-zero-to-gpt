import { expect, test } from '@playwright/test';
import {execFileSync} from 'node:child_process';

for(const lesson of [
  {id:'kv-cache',command:'benchmark',boundary:'绝对位置窗口滑动后重建缓存'},
  {id:'quantization',command:'quantize',boundary:'不声称整数内核加速'},
  {id:'lora',command:'lora-train',boundary:'此流程不是 QLoRA'},
]){
  test(`${lesson.id} 从教材到同一个真实 GPT 下载与命令`,async({page})=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`/#/lesson/${lesson.id}`);
    await page.getByText('先修知识、延伸阅读与本地项目',{exact:true}).click();
    const project=page.locator('.project-download');
    await expect(project.getByRole('heading')).toHaveText('把现代 LLM 技术接进你自己的 GPT');
    await expect(project.locator('pre')).toContainText(`python tiny_gpt.py ${lesson.command}`);
    await expect(project).toContainText(lesson.boundary);
    const download=page.waitForEvent('download');
    await project.getByRole('link',{name:'下载源码、测试与运行说明'}).click();
    const zip=await download;
    expect(zip.suggestedFilename()).toBe('tiny-gpt.zip');
    const path=await zip.path();expect(path).toBeTruthy();
    // Inspect the actual downloaded artifact, not only the href or filename.
    const contents=JSON.parse(execFileSync('python3',['-c',
      'import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({"files":z.namelist(),"cli":z.read("tiny-gpt/tiny_gpt.py").decode()}))',path!],{encoding:'utf8'}));
    expect(contents.files).toEqual(expect.arrayContaining(['tiny-gpt/efficient.py','tiny-gpt/benchmark.py','tiny-gpt/test_efficiency.py']));
    expect(contents.cli).toContain('lora-train');expect(contents.cli).toContain('quantize');
    await page.setViewportSize({width:390,height:844});
    await expect(project.locator('pre')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(errors).toEqual([]);
  });
}
