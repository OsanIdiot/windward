const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {packageDemo}=require('./package-demo.cjs');const root=packageDemo();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.m4a':'audio/mp4','.txt':'text/plain','.md':'text/plain'};
http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/demo\//,'').replace(/^\//,'')||'index.html';}catch(_){res.writeHead(400).end();return;}
  const target=path.resolve(root,name),relative=path.relative(root,target);if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(404).end();return;}
  fs.readFile(target,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'text/plain','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);});
}).listen(Number(process.env.PORT)||4180,'127.0.0.1',()=>console.log('Integrated demo: http://127.0.0.1:4180/demo/'));
