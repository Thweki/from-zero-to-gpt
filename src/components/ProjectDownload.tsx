import {Download,Terminal} from 'lucide-react';
const projects={
  2:{file:'regression',title:'从零训练回归模型',description:'纯 Python 标准库：数据划分、训练、验证和模型保存。'},
  3:{file:'micrograd',title:'你自己的自动微分与神经网络',description:'纯 Python 标量引擎和 XOR MLP，包含数值梯度检查与单元测试。'},
  5:{file:'tiny-gpt',title:'可独立训练的微型 GPT',description:'在本地 CPU 上运行 PyTorch：自定义因果注意力、训练、检查点、生成，以及 KV Cache、int8 权重存储和 LoRA。浏览器上方实验用于理解概念；完整模型在本地运行。'},
  6:{file:'tiny-gpt',title:'把现代 LLM 技术接进你自己的 GPT',description:'与第五阶段同一个真实模型：对照缓存输出、训练并合并 LoRA、保存 int8 权重，再用缓存逐 Token 生成。无需模型 API；需要本地 Python 与 CPU PyTorch。'},
};
const workflows:Record<string,{command:string;note:string}>={
  'kv-cache':{command:'python tiny_gpt.py benchmark --checkpoint runs/tiny.pt --tokens 24\npython tiny_gpt.py generate --checkpoint runs/tiny.pt --kv-cache --tokens 60 --trace',note:'benchmark 对相同 Token 轨迹逐步比较 logits，并报告实际 CPU 时间与投影位置数。绝对位置窗口滑动后重建缓存。'},
  quantization:{command:'python tiny_gpt.py quantize --checkpoint runs/tiny.pt --output runs/tiny-int8.pt\npython tiny_gpt.py generate --checkpoint runs/tiny-int8.pt --kv-cache --tokens 60',note:'逐输出通道 int8 存储，输出实际张量字节和验证损失差异。前向反量化后使用浮点计算，不声称整数内核加速。'},
  lora:{command:'python tiny_gpt.py lora-train --checkpoint runs/tiny.pt --output runs/adapter.pt\npython tiny_gpt.py merge-lora --checkpoint runs/tiny.pt --adapter runs/adapter.pt --output runs/merged.pt\npython tiny_gpt.py quantize --checkpoint runs/merged.pt --output runs/merged-int8.pt\npython tiny_gpt.py generate --checkpoint runs/merged-int8.pt --kv-cache --tokens 60',note:'只更新低秩参数，并逐张量确认基座未改变。适配器绑定基座文件 SHA-256；合并后可量化并使用 KV Cache。此流程不是 QLoRA。'},
};
export function ProjectDownload({stage,lessonId}:{stage:number;lessonId?:string}){
  const project=projects[stage as keyof typeof projects];
  if(!project)return null;
  const workflow=lessonId?workflows[lessonId]:undefined;
  return <section className="project-download">
    <span className="mini-label">本阶段的独立作品</span>
    <h3><Terminal size={17}/>{project.title}</h3><p>{project.description}</p>
    <a className="button secondary compact" href={`/downloads/${project.file}.zip`} download><Download size={14}/>下载源码、测试与运行说明</a>
    {workflow&&<div className="project-workflow">
      <p>解压并按 README 安装后，先运行 <code>python tiny_gpt.py train --checkpoint runs/tiny.pt</code>，再执行本章实验：</p>
      <pre tabIndex={0} aria-label="本章本地模型命令"><code>{workflow.command}</code></pre><p>{workflow.note}</p>
    </div>}
    <small>解压后先阅读 README.md。代码与课程一起开源，不需要模型 API。</small>
  </section>;
}
