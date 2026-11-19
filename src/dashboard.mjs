import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { listReels, getMeta, saveMeta, createReel, reelDir, scriptPath } from './store.mjs';
import { parseScript, lint, virality } from './script.mjs';
import { listJobs, enqueue, startWorker } from './jobs.mjs';
import { summary, calibrate } from './analytics.mjs';
import { listSwipe, addItem, decide, discover, fmtViews } from './swipe.mjs';
import { listAccounts, applySecrets } from './accounts.mjs';
import { detectProvider } from './voice.mjs';
import { accountInsights } from './instagram.mjs';
import { repurpose } from './repurpose.mjs';
import { styleList } from './render2.mjs';
import { has, findFont } from './util.mjs';
import { browserAvailable, findBrowser } from './browser.mjs';

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json' };
let stylesCache = null;
const safe = s => /^[\w-]+$/.test(s || '');

function scriptView(slug) {
  const text = fs.readFileSync(scriptPath(slug), 'utf8'); const sc = parseScript(text); const l = lint(sc);
  const m = getMeta(slug); const v = virality(sc, m.durations);
  const lines = sc.beats.map((b, i) => ({ text: b, role: i === 0 ? 'hook' : i === sc.beats.length - 1 ? 'cta' : 'body', visual: sc.visuals[i]?.type || null }));
  return { slug, text, lines, lint: l, virality: v, runtime: Math.round(v.duration), meta: m };
}

export function startDashboard({ port = 4177, lan = false, worker = true } = {}) {
  applySecrets();
  const token = lan ? crypto.randomBytes(8).toString('hex') : null;
  const stop = worker ? startWorker() : () => {};
  const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
  const readBody = req => new Promise(r => { let b = ''; req.on('data', d => (b += d)); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });

  const srv = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://x');
      if (token) { // LAN mode: require the token (query once, then cookie)
        const ck = (req.headers.cookie || '').match(/rk=([a-f0-9]+)/)?.[1];
        if (u.searchParams.get('token') === token) { res.setHeader('set-cookie', `rk=${token}; Path=/; HttpOnly; SameSite=Strict`); res.writeHead(302, { location: '/' }); return res.end(); }
        if (ck !== token) return send(res, 401, 'Open the dashboard with the ?token=… link printed in the terminal.', 'text/plain');
      } else if (req.headers.host && !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host)) return send(res, 403, 'localhost only (use --lan for phone access)', 'text/plain'); // DNS-rebinding guard
      const p = u.pathname; const body = req.method === 'POST' ? await readBody(req) : {};

      if (p === '/api/state') {
        if (!stylesCache) { try { stylesCache = await styleList(); } catch { stylesCache = []; } }
        return send(res, 200, { reels: listReels(), styles: stylesCache, accounts: listAccounts(), jobs: listJobs().slice(0, 12), provider: detectProvider('auto'),
          health: { ffmpeg: has('ffmpeg'), browser: browserAvailable() && !!findBrowser(), font: !!findFont(), instagram: listAccounts().length > 0, elevenlabs: !!process.env.ELEVENLABS_API_KEY, heygen: !!process.env.HEYGEN_API_KEY } });
      }
      if (p === '/api/reel' && req.method === 'POST') { const s = createReel(body.title || 'Untitled', body.text || `# ${body.title || 'Untitled'}\nYour hook here.\n`); return send(res, 200, { slug: s }); }
      let m;
      if ((m = p.match(/^\/api\/script\/([\w-]+)$/))) {
        if (!safe(m[1]) || !getMeta(m[1])) return send(res, 404, { error: 'no such reel' });
        if (req.method === 'POST') { fs.writeFileSync(scriptPath(m[1]), String(body.text || '')); }
        return send(res, 200, scriptView(m[1]));
      }
      if ((m = p.match(/^\/api\/has\/([\w-]+)$/))) return send(res, 200, { reel: fs.existsSync(path.join(reelDir(m[1]), 'reel.mp4')), draft: fs.existsSync(path.join(reelDir(m[1]), 'draft.mp4')) });
      if (p === '/api/render' && req.method === 'POST') { if (!safe(body.slug)) return send(res, 400, {}); return send(res, 200, enqueue('render', { slug: body.slug, style: body.style, voice: body.voice, lang: body.lang, draft: !!body.draft })); }
      if (p === '/api/schedule' && req.method === 'POST') { const mt = getMeta(body.slug); if (!mt) return send(res, 404, {}); Object.assign(mt, { status: 'scheduled', scheduledAt: new Date(body.at).toISOString(), caption: body.caption ?? mt.caption ?? mt.title, account: body.account || mt.account, trial: !!body.trial }); saveMeta(body.slug, mt); return send(res, 200, mt); }
      if (p === '/api/unschedule' && req.method === 'POST') { const mt = getMeta(body.slug); if (mt) { mt.status = 'rendered'; delete mt.scheduledAt; saveMeta(body.slug, mt); } return send(res, 200, {}); }
      if (p === '/api/post-now' && req.method === 'POST') { const mt = getMeta(body.slug); Object.assign(mt, { caption: body.caption ?? mt.caption ?? mt.title, account: body.account || mt.account, trial: !!body.trial }); saveMeta(body.slug, mt); return send(res, 200, enqueue('post', { slug: body.slug })); }
      if (p === '/api/swipe') return send(res, 200, { items: listSwipe({ status: u.searchParams.get('status') || undefined, niche: u.searchParams.get('niche') || undefined }).map(i => ({ ...i, viewsLabel: fmtViews(i.views) })) });
      if (p === '/api/swipe/add' && req.method === 'POST') return send(res, 200, addItem(body));
      if (p === '/api/swipe/decide' && req.method === 'POST') return send(res, 200, decide(body.id, body.status));
      if (p === '/api/swipe/discover' && req.method === 'POST') return send(res, 200, { added: await discover(body.account, body.usernames || [], body.niche) });
      if (p === '/api/analytics') { const s = summary(); let acct = null; try { if (listAccounts().length) acct = await accountInsights(u.searchParams.get('account') || undefined); } catch (e) { acct = { error: e.message }; } return send(res, 200, { ...s, account: acct, calibration: calibrate() }); }
      if (p === '/api/analyze' && req.method === 'POST') return send(res, 200, enqueue('analyze', {}));
      if (p === '/api/repurpose' && req.method === 'POST') { if (!safe(body.slug)) return send(res, 400, {}); const r = await repurpose(body.slug, { style: body.style }); return send(res, 200, { files: r.files.map(f => path.basename(f)), meta: getMeta(body.slug) }); }
      if (p === '/api/hooks' && req.method === 'POST') { const mt = getMeta(body.slug); mt.hooks = [...(mt.hooks || []), body.hook]; saveMeta(body.slug, mt); return send(res, 200, mt.hooks); }
      if ((m = p.match(/^\/file\/([\w-]+)\/([\w./-]+)$/))) {
        const f = path.join(reelDir(m[1]), m[2]); if (m[2].includes('..') || !f.startsWith(reelDir(m[1])) || !fs.existsSync(f) || /work\//.test(m[2]) && !/\.(png|mp4)$/.test(f)) return send(res, 404, '', 'text/plain');
        const st = fs.statSync(f); const type = MIME[path.extname(f)] || 'application/octet-stream'; const rg = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
        if (rg) { const a = rg[1] ? +rg[1] : 0, b = rg[2] ? +rg[2] : st.size - 1; res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${a}-${b}/${st.size}`, 'accept-ranges': 'bytes', 'content-length': b - a + 1 }); return fs.createReadStream(f, { start: a, end: b }).pipe(res); }
        res.writeHead(200, { 'content-type': type, 'content-length': st.size, 'accept-ranges': 'bytes' }); return fs.createReadStream(f).pipe(res);
      }
      // static app
      const name = p === '/' ? 'index.html' : p.slice(1);
      const f = path.join(web, name);
      if (!name.includes('..') && fs.existsSync(f) && fs.statSync(f).isFile()) return send(res, 200, fs.readFileSync(f), MIME[path.extname(f)] || 'text/plain');
      send(res, 404, 'not found', 'text/plain');
    } catch (e) { send(res, 500, { error: e.message }); }
  });
  srv.listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
    console.log(`Reelkit dashboard: http://localhost:${port}`);
    if (lan) { const ip = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address || '<your-pc-ip>'; console.log(`Phone (same Wi-Fi): http://${ip}:${port}/?token=${token}   <- keep this link private`); }
    console.log(worker ? 'Worker + scheduler running in this process (keep it open so scheduled posts go out).' : 'Worker disabled.');
  });
  srv.on('close', stop);
  return srv;
}
