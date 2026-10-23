export interface PythonFailure {type:string;message:string;explanation:string;line?:number;filename?:string;location:string;stdout:string;source?:string;raw:string;}
const hints:Record<string,string>={
  NameError:'这个名字还没有定义。检查拼写，以及它是否在使用之前被赋值。',
  SyntaxError:'Python 无法读懂这段语法。检查这一行及上一行的括号、引号和冒号。',
  IndentationError:'缩进层级不符合 Python 语法。检查代码块是否对齐。',
  TabError:'缩进混用了 Tab 和空格。可统一使用空格缩进。',
  TypeError:'参与运算或函数调用的类型不匹配。检查每个值的类型和参数数量。',
  ZeroDivisionError:'除数为零。检查这一行的分母，以及它是怎样计算出来的。',
  IndexError:'访问的位置超出了序列范围。检查索引和当前序列长度。',
  KeyError:'字典中没有这个键。检查键的拼写和字典里实际存在的内容。',
  ValueError:'值无法用于这次操作。结合原始提示检查输入值或转换方式。',
  ModuleNotFoundError:'当前 Python 环境没有找到这个模块。浏览器环境与本地 Python 支持的包可能不同。',
  ImportError:'导入没有成功。检查模块名称，以及当前浏览器环境是否支持它。',
  AssertionError:'一个断言没有成立。对照期望值与实际结果，检查尚未满足的条件。',
  RecursionError:'递归调用超过了限制。检查是否存在终止条件，以及每一步是否接近它。',
  OverflowError:'这次数值计算超出了可表示范围。检查输入的数量级。',
};
/** Read both new named files and previously saved, unclassified Pyodide traces. */
export function analyzePythonFailure(result:string):PythonFailure|null{
  if(!result.startsWith('运行错误\n'))return null;
  const raw=result.slice('运行错误\n'.length),lines=raw.trimEnd().split('\n');
  const exception=[...lines].reverse().find(line=>/^[A-Za-z_][\w.]*(?:Error|Exception|Interrupt|Exit)(?::|$)/.test(line));
  const match=exception?.match(/^([\w.]+)(?::\s*(.*))?$/);
  const type=match?.[1]||'Python 错误',message=match?.[2]||'';
  const frames=[...raw.matchAll(/File "(experiment\.py|acceptance_tests\.py)", line (\d+)[^\n]*/g)];
  // Prefer the innermost actual user frame, even if a test called that function.
  const frame=frames.filter(f=>f[1]==='experiment.py').at(-1)||frames.at(-1);
  const filename=frame?.[1],line=frame?Number(frame[2]):undefined;
  const following=frame?raw.slice(frame.index!+frame[0].length).split('\n')[1]:undefined;
  const source=following&&/^\s+\S/.test(following)&&!/^\s*(?:File |Traceback|\^)/.test(following)?following.trim():undefined;
  const firstTrace=raw.search(/(?:PythonError:\s*)?Traceback \(most recent call last\):|(?:PythonError:\s*)?\s*File "(?:experiment|acceptance_tests)\.py"/);
  const stdout=firstTrace>0?raw.slice(0,firstTrace).trimEnd():'';
  const tests=filename==='acceptance_tests.py';
  return {type,message,line,filename,source,raw,stdout,
    location:line?`${tests?'验收测试（不是用户代码）':'用户代码 experiment.py'} · 第 ${line} 行`:'没有可确认的用户代码行号',
    explanation:tests&&type==='AssertionError'?'Python 已执行到验收断言，但结果尚未符合本章要求。请比较输入、返回值与测试条件；这里的行号属于验收测试。':hints[type]||'执行在此处停止。结合错误名称与原始提示，先检查自己的相关代码。'};
}
