import {Download,Terminal} from 'lucide-react';
const projects={
  2:{file:'regression',title:'从零训练回归模型',description:'纯 Python 标准库：数据划分、训练、验证和模型保存。',command:'python3 regression.py --help'},
  3:{file:'micrograd',title:'你自己的自动微分与神经网络',description:'纯 Python 标量引擎和 XOR MLP，包含数值梯度检查与单元测试。',command:'python3 micrograd.py --help'},
  5:{file:'tiny-gpt',title:'可独立训练的微型 GPT',description:'在本地 CPU 上运行 PyTorch：自定义因果注意力、训练、检查点与生成。浏览器上方实验用于理解概念；完整训练在本地进行。',command:'python3 tiny_gpt.py --help'},
};
export function ProjectDownload({stage}:{stage:number}){const project=projects[stage as keyof typeof projects];if(!project)return null;return <section className="project-download"><span className="mini-label">本阶段的独立作品</span><h3><Terminal size={17}/>{project.title}</h3><p>{project.description}</p><a className="button secondary compact" href={`/downloads/${project.file}.zip`} download><Download size={14}/>下载源码、测试与运行说明</a><small>解压后先阅读 README.md。代码与课程一起开源，不需要模型 API。</small></section>;}
