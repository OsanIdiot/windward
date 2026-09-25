const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const files = new Set(['index.html', 'style.css', 'geography.js', 'navigation.js', 'engine.js', 'sea-ui.js', 'voyage-camera.js', 'voyage-ui.js', 'audio-config.js', 'audio.js', 'play-session.js', 'app.js', 'assets/harbor-town.webp']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
// Serve replaceable audio assets only, without exposing other workspace files.
const isAudio = name => /^assets\/audio\/[a-zA-Z0-9_-]+\.(wav|mp3|ogg|m4a)$/.test(name);
http.createServer((req, res) => {
  let requested;
  try { requested = decodeURIComponent(new URL(req.url, `http://${host}:${port}`).pathname).replace(/^\//, '') || 'index.html'; }
  catch { res.writeHead(400).end('Bad request'); return; }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  if (!files.has(requested) && !isAudio(requested)) { res.writeHead(404).end('Not found'); return; }
  fs.readFile(path.join(__dirname, requested), (error, content) => {
    if (error) { res.writeHead(500).end('Unable to read file'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(requested)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  });
}).listen(port, host, () => console.log(`Windward is running at http://${host}:${port}`));
