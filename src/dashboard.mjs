import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listReels, reelDir, scriptPath } from './store.mjs';
import { parseScript, lint } from './script.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export function startDashboard(port) {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/state') {
      const reels = listReels().map(r => { let l = null; try { l = lint(parseScript(fs.readFileSync(scriptPath(r.slug), 'utf8'))).score; } catch {} return { ...r, lintScore: l, hasVideo: fs.existsSync(path.join(reelDir(r.slug), 'reel.mp4')) }; });
      res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ reels }));
    }
    const m = u.pathname.match(/^\/video\/([\w-]+)$/);
    if (m) { const f = path.join(reelDir(m[1]), 'reel.mp4'); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': 'video/mp4' }); return fs.createReadStream(f).pipe(res); }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(fs.readFileSync(path.join(here, '..', 'web', 'index.html')));
  });
  srv.listen(port, () => console.log(`Dashboard: http://localhost:${port}  (same Wi-Fi: http://<your-pc-ip>:${port})`));
  return srv;
}
