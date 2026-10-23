/* Python runs only in this dedicated worker. Termination discards the runtime. */
let python;
self.onmessage = async ({data}) => {
  let output='';
  const append = text => {output += String(text)+'\n'; if (output.length > 30000) throw new Error('输出超过 30,000 字符限制');};
  try {
    if (!python) {
      self.postMessage({type:'loading'});
      importScripts('/python/pyodide.js');
      python=await loadPyodide({indexURL:'/python/',stdout:append,stderr:append});
    }
    python.setStdout({batched:append}); python.setStderr({batched:append});
    self.postMessage({type:'running'});
    const globals=python.toPy({});
    try {
      await python.runPythonAsync(data.code,{globals,filename:'experiment.py'});
      if (data.tests) await python.runPythonAsync(data.tests,{globals,filename:'acceptance_tests.py'});
      self.postMessage({type:'done',output:output||'代码已执行，没有标准输出。',passed:!!data.tests});
    } finally {globals.destroy();}
  } catch (e) {self.postMessage({type:'error',output:output+(e.message||String(e))});}
};
