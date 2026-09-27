const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const local = new Set(['index.html','lab.css','lab.js','model.js','world.js','ocean.js','painted.js','painted-materials.webp','vendor/three.module.min.js','vendor/three.core.min.js','vendor/LICENSE-three.txt']);
const shared = new Set(['geography.js','navigation.js','engine.js']);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.txt':'text/plain; charset=utf-8','.webp':'image/webp'};
const host = process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 4179);
http.createServer((req,res) => {
  let name;
  try { name = decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'') || 'index.html'; }
  catch { res.writeHead(400).end(); return; }
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  if (!local.has(name) && !shared.has(name)) { res.writeHead(404).end(); return; }
  fs.readFile(path.join(shared.has(name) ? root : __dirname,name),(error,data) => {
    if(error) { res.writeHead(500).end(); return; }
    res.writeHead(200,{'Content-Type':mime[path.extname(name)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD' ? undefined : data);
  });
}).listen(port,host,()=>console.log(`Harbor lab: http://${host}:${port} (isolated, no save access)`));
