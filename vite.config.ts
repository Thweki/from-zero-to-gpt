import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>{
  const env={...loadEnv(mode,process.cwd(),''),...process.env};
  return {plugins:[react(),{name:'learning-tutor-api',configureServer(server){
    server.middlewares.use(async(req,res,next)=>{
      if(!req.url?.startsWith('/api/tutor/'))return next();
      try{
        const chunks:Buffer[]=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>64000){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'请求内容过长。'}));return;}chunks.push(chunk);}
        const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
        const {handleTutorRequest}=await server.ssrLoadModule('/server/tutor.ts');
        const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers as Record<string,string>,body:req.method==='POST'?Buffer.concat(chunks):undefined,signal:controller.signal});
        const response=await handleTutorRequest(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
      }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'本地导师服务暂时不可用。'}));}
    });
  }}],server:{host:'0.0.0.0',port:5173,watch:{ignored:['**/artifacts/**','**/test-results/**','**/playwright-report/**']}},build:{chunkSizeWarningLimit:900,rollupOptions:{output:{manualChunks:{katex:['katex'],markdown:['react-markdown','remark-math','rehype-katex']}}}}};
});
