import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { handleTutorRequest } from '../dist-server/tutor.mjs';
const root=path.resolve('dist'),port=Number(process.env.PORT||8787);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.zip':'application/zip'};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://'+req.headers.host);
    if(url.pathname.startsWith('/api/tutor/')){
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>64000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
      const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
      const response=await handleTutorRequest(new Request(url,{method:req.method,headers:req.headers,body:req.method==='POST'?Buffer.concat(chunks):undefined,signal:controller.signal}),process.env);
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    if(!(await stat(file)).isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Learning platform: http://${process.env.HOST||'127.0.0.1'}:${port}`));
