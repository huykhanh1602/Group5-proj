import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const publicFiles = new Set(['index.html', 'app.js', 'game.js', 'matchmaking.js', 'style.css']);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
http.createServer(async (req, res) => {
  try {
    const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
    if (!publicFiles.has(name)) { res.writeHead(404); return res.end('Not found'); }
    const body = await readFile(path.join(root, name));
    res.writeHead(200, { 'Content-Type': `${mime[path.extname(name)]}; charset=utf-8`, 'Cache-Control': 'no-cache' }); res.end(body);
  } catch { res.writeHead(500); res.end('Server error'); }
}).listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('playhtml.fun running at http://localhost:3000'));
