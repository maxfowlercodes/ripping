import { postLibrary, startPostRun } from './library.mjs';
import { getProfilePlan } from './profile.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { listReels, getMeta, saveMeta, createReel, reelDir, scriptPath } from './store.mjs';
import { parseScript, lint, virality } from './script.mjs';
import { listJobs, getJob, enqueue, startWorker, queueInfo, activeTasks, cancelJob } from './jobs.mjs';
import { enableProbeMode, refreshProbes } from './probes.mjs';
import { summary, calibrate } from './analytics.mjs';
import { listSwipe, addItem, decide, discover, fmtViews } from './swipe.mjs';
import { listAccounts, applySecrets, setKey, loadSecrets } from './accounts.mjs';
import { detectProvider } from './voice.mjs';
import { accountInsights } from './instagram.mjs';
import { repurpose } from './repurpose.mjs';
import { styleList } from './render2.mjs';
import { has, findFont, home, ensureDir, writeJson, readJson } from './util.mjs';
import { spawn } from 'node:child_process';
import { getBrand, saveBrand, missingBrand } from './brand.mjs';
import { getSettings, saveSettings, usageToday, reelkitWindows, getClaudeToken, setClaudeToken, TASKS, modelFor, askClaude, claudeAvailable, CODE_ONLY, MODELS } from './claude.mjs';
import { listInbox, resolveItem, getItem, addInbox } from './inbox.mjs';
import { startRun, answerGate, listRuns, getRun, cancelRun, retryRun, skipStep } from './autopilot.mjs';
import { listIdeas, setIdea, generateIdeas, referenceCount } from './ideas.mjs';
import { addFromText } from './swipe.mjs';
import { ensureBrowser, openSite } from './computer.mjs';
import { getLeads, leadsCsv, statusFile } from './chat.mjs';
import { loadCatalog } from './stylecatalog.mjs';
import { systemCheck, INSTALLERS, openClaudeLogin, openClaudeSetupToken, igStatus, ytStatus, browserShot, getOnboarding, setOnboarding, getAutofill, getBrowserTest } from './setup.mjs';
import { getResearch } from './research.mjs';
import { storageReport, cleanStorage, freeBytes } from './storage.mjs';
import { voiceCatalog, synth } from './voice.mjs';
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

export function startDashboard({ port = 4177, lan = false, worker = true, open = false } = {}) {
  applySecrets(); enableProbeMode(); refreshProbes(); const probeTimer = setInterval(() => refreshProbes(), 20000); probeTimer.unref();
  const token = lan ? crypto.randomBytes(8).toString('hex') : null;
  // heavy work (renders, Whisper, Claude calls, posting) runs in a child process so the UI never freezes
  let child = null; const bin = fileURLToPath(new URL('../bin/reelkit.mjs', import.meta.url));
  const spawnWorker = () => { child = spawn(process.execPath, [bin, 'worker', '--child'], { stdio: 'inherit', env: process.env }); child.on('exit', c => { if (child && !stopping) setTimeout(spawnWorker, 2000); }); };
  let stopping = false; if (worker) spawnWorker();
  const stop = () => { stopping = true; child?.kill(); };
  process.on('exit', stop); process.on('SIGINT', () => { stop(); process.exit(0); }); process.on('SIGTERM', () => { stop(); process.exit(0); });
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
      const p = u.pathname; const body = req.method === 'POST' && p !== '/api/footage/upload' ? await readBody(req) : {};

      if (p === '/healthz') return send(res, 200, { ok: true, app: 'reelkit' });
      if (p === '/api/shutdown' && req.method === 'POST') { send(res, 200, { ok: true }); setTimeout(() => { stop(); process.exit(0); }, 150); return; }
      if (p === '/api/state') {
        if (!stylesCache) { try { const cat = loadCatalog(); stylesCache = Object.keys(cat).length ? Object.values(cat).map(c => ({ name: c.name, desc: c.desc, tags: c.tags, presenter: c.presenter })) : await styleList(); } catch { stylesCache = []; } }
        return send(res, 200, { onboarding: getOnboarding(), mode: getSettings().mode, calls: usageToday().calls, freeBytes: freeBytes(), reels: listReels(), styles: stylesCache, accounts: listAccounts(), jobs: listJobs(12), provider: detectProvider('auto'),
          health: { ffmpeg: has('ffmpeg'), browser: browserAvailable() && !!findBrowser(), font: !!findFont(), instagram: listAccounts().length > 0, elevenlabs: !!process.env.ELEVENLABS_API_KEY, heygen: !!process.env.HEYGEN_API_KEY } });
      }
      if (p === '/api/reel' && req.method === 'POST') { const s = createReel(body.title || 'Untitled', body.text || `# ${body.title || 'Untitled'}\nYour hook here.\n`); return send(res, 200, { slug: s }); }
      let m;


      if (p === '/api/leads') return send(res, 200, { leads: getLeads(), status: readJson(statusFile(), null), chat: getBrand().chat });
      if (p === '/api/leads.csv') { res.writeHead(200, { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="leads.csv"' }); return res.end(leadsCsv(getLeads())); }
      if (p === '/api/leads/status' && req.method === 'POST') { const f = path.join(home(), 'leads.json'); const d = readJson(f, { items: [] }); const l = d.items.find(x => x.id === body.id); if (l && ['new', 'contacted', 'won', 'lost'].includes(body.status)) l.status = body.status; writeJson(f, d); return send(res, 200, { ok: true }); }
      if (p === '/api/leads/delete' && req.method === 'POST') { const f = path.join(home(), 'leads.json'); const d = readJson(f, { items: [] }); d.items = d.items.filter(x => x.id !== body.id); writeJson(f, d); return send(res, 200, { ok: true }); }
      if (p === '/api/research') return send(res, 200, { research: getResearch(), report: fs.existsSync(path.join(home(), 'research.md')) ? fs.readFileSync(path.join(home(), 'research.md'), 'utf8') : '' });
      if (p === '/api/research/run' && req.method === 'POST') return send(res, 200, enqueue('research', { force: !!body.force }));
      if (p === '/api/voices') return send(res, 200, { providers: voiceCatalog(), auto: detectProvider('auto') });
      if (p === '/api/voices/preview' && req.method === 'POST') {
        const prov = String(body.provider || 'auto').replace(/[^\w-]/g, ''); const lang = String(body.lang || 'en').replace(/[^\w-]/g, ''); const vid = String(body.voiceId || '').replace(/[^\w.-]/g, ''); const dir = ensureDir(path.join(home(), 'voice-previews')); const base = path.join(dir, `${prov}_${vid || 'default'}_${lang}`);
        const out = fs.existsSync(base + '.wav') ? { file: base + '.wav' } : fs.existsSync(base + '.mp3') ? { file: base + '.mp3' } : await synth(String(body.text || 'Stop posting reels nobody watches. Open with the result instead.').slice(0, 200), base, prov === 'auto' ? detectProvider('auto') : prov, { lang, voiceId: vid || undefined });
        if (!out.file) return send(res, 500, { error: 'That voice produced no audio. Check it is installed (see Setup → Voice).' }); return send(res, 200, { url: '/voice-preview/' + path.basename(out.file) });
      }
      if ((m = p.match(/^\/voice-preview\/([\w.-]+\.(wav|mp3))$/))) { const f = path.join(home(), 'voice-previews', m[1]); if (!fs.existsSync(f)) return send(res, 404, '', 'text/plain'); res.writeHead(200, { 'content-type': m[2] === 'wav' ? 'audio/wav' : 'audio/mpeg' }); return fs.createReadStream(f).pipe(res); }
      if ((m = p.match(/^\/styles\/previews\/([\w-]+\.jpg)$/))) { const f = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'styles', 'previews', m[1]); if (!fs.existsSync(f)) return send(res, 404, '', 'text/plain'); res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'max-age=3600' }); return fs.createReadStream(f).pipe(res); }

      if (p === '/api/guide') {
        const b = getBrand(); const st = readJson(path.join(home(), 'state.json'), {}); const rsr = getResearch(); const reelsDone = listReels().some(r => r.rendered);
        const steps = [
          { id: 'claude', title: 'Install Claude Code and sign in', done: claudeAvailable(), how: 'Install: npm i -g @anthropic-ai/claude-code. Then open a terminal, type claude, and sign in with your Claude account. Come back and press "Test Claude" in the Claude tab.', link: '#claude' },
          { id: 'brand', title: 'Describe your business', done: missingBrand().length === 0, how: 'Setup → Your brand. Fill in product, audience, their problem and a CTA keyword. Add real proof points (number = claim). Claude may only use numbers you list.', link: '#setup' },
          { id: 'research', title: 'Run the first-time deep research', done: !!rsr?.finished, how: 'Research tab → Run. Four stages (your site, your audience, competitors, strategy) take 5 to 10 minutes and are saved. Add your website URL in Setup first for better results.', link: '#research' },
          { id: 'voice', title: 'Pick a voice and listen to it', done: !!st.voiceChecked, how: 'Setup → Voice. Press Preview on a few voices. Kokoro is the best free one (pip install kokoro-onnx soundfile, then reelkit voices install kokoro). Add ElevenLabs later with reelkit key elevenlabs <key>.', link: '#setup' },
          { id: 'iglogin', title: 'Log in to Instagram in the Reelkit browser', done: !!st.igLoginConfirmed || b.posting.method !== 'computer', how: 'Setup → Posting → "Open Reelkit browser". Log in to Instagram in the window that opens (once), then press "I logged in" below. The login is stored in a separate browser profile on this computer.', link: '#setup', confirm: 'igLoginConfirmed' },
          { id: 'refs', title: 'Save 3 reference reels', done: referenceCount() >= b.daily.minReferences, how: 'Today → paste lines like: https://instagram.com/... | 2.4M | 170K | their hook. Or Swipe tab → add. Claude copies structure, never wording.', link: '#today' },
          { id: 'first', title: 'Make your first reel', done: reelsDone, how: 'Today → Make & Post with "render only" first. Watch it in Produce, then try "review before sharing".', link: '#today' },
          { id: 'chat', title: '(Optional) Turn on the business chat', done: b.chat.enabled, how: 'Leads tab → turn on, fill in the FAQ, and share the link in your Instagram bio. Visitors give name + email, then chat with an AI that only knows what you told it.', link: '#leads' },
        ];
        return send(res, 200, { steps, doneCount: steps.filter(x => x.done).length });
      }
      if (p === '/api/guide/confirm' && req.method === 'POST') { const f = path.join(home(), 'state.json'); const d = readJson(f, {}); if (['igLoginConfirmed', 'voiceChecked'].includes(body.id)) d[body.id] = true; writeJson(f, d); return send(res, 200, { ok: true }); }

      if ((m = p.match(/^\/api\/job\/([a-f0-9]{8})$/))) { const j = getJob(m[1]); return send(res, j ? 200 : 404, j ? { ...j, queue: queueInfo(j) } : { error: 'no such job' }); }
      if (p === '/api/tasks') return send(res, 200, { tasks: activeTasks(), mode: getSettings().mode });
      if (p === '/api/jobs/cancel' && req.method === 'POST') { if (!/^[a-f0-9]{8}$/.test(String(body.id))) return send(res, 400, { error: 'bad id' }); return send(res, 200, cancelJob(String(body.id)) || { error: 'no such job' }); }
      if (p === '/api/storage') return send(res, 200, await storageReport());
      if (p === '/api/storage/clean' && req.method === 'POST') return send(res, 200, await cleanStorage(Array.isArray(body.ids) ? body.ids.map(String) : []));
      if (p === '/api/setup/check') return send(res, 200, { rows: await systemCheck() });
      if (p === '/api/setup/install' && req.method === 'POST') { if (typeof body.id !== 'string' || !Object.hasOwn(INSTALLERS, body.id)) return send(res, 400, { error: 'unknown installer' }); return send(res, 200, enqueue('install', { id: body.id })); }
      if (p === '/api/setup/claude-login' && req.method === 'POST') { openClaudeLogin(); return send(res, 200, { ok: true }); }
      if (p === '/api/reel/reveal' && req.method === 'POST') { const mt = getMeta(String(body.slug || '')); if (!mt) return send(res, 404, {}); const f = path.resolve(reelDir(body.slug), 'reel.mp4'); try { if (process.platform === 'win32') spawn('explorer.exe', ['/select,' + f], { detached: true, stdio: 'ignore' }).unref(); else if (process.platform === 'darwin') spawn('open', ['-R', f], { detached: true, stdio: 'ignore' }).unref(); else spawn('xdg-open', [path.dirname(f)], { detached: true, stdio: 'ignore' }).unref(); } catch {} return send(res, 200, { path: f }); }
      if (p === '/api/browser/open' && req.method === 'POST') { try { return send(res, 200, await openSite(String(body.site || ''))); } catch (e) { return send(res, 400, { error: e.message }); } }
      if (p === '/api/setup/yt') return send(res, 200, await ytStatus());
      if (p === '/api/library') return send(res, 200, { items: postLibrary(), igStatus: await igStatus(), ytStatus: getBrand().posting.youtube ? await ytStatus() : null, youtube: !!getBrand().posting.youtube });
      if (p === '/api/library/post' && req.method === 'POST') { try { return send(res, 200, startPostRun(String(body.slug || ''), body.mode === 'auto' ? 'auto' : 'review', body.platform === 'youtube' ? 'youtube' : 'instagram')); } catch (e) { return send(res, 400, { error: e.message }); } }
      if (p === '/api/library/mark-posted' && req.method === 'POST') { const mt = getMeta(body.slug); if (!mt) return send(res, 404, {}); Object.assign(mt, { status: 'posted', postedAt: new Date().toISOString(), postedVia: 'manual', permalink: String(body.permalink || '').slice(0, 300) }); saveMeta(body.slug, mt); return send(res, 200, { ok: true }); }
      if (p === '/api/library/reset' && req.method === 'POST') { const mt = getMeta(body.slug); if (!mt) return send(res, 404, {}); if (mt.status !== 'posted') { delete mt.scheduledAt; mt.status = 'draft'; saveMeta(body.slug, mt); } return send(res, 200, { ok: true }); }
      if (p === '/api/browser/shot') { try { const sh = await browserShot(); res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store' }); return res.end(sh.jpeg); } catch (e) { return send(res, 503, { error: e.message }); } }
      if (p === '/api/profile' && req.method === 'POST') return send(res, 200, enqueue('profile', { currentBio: String(body.currentBio || '').slice(0, 400), currentName: String(body.currentName || '').slice(0, 80), oldContent: String(body.oldContent || '').slice(0, 600) }));
      if (p === '/api/profile') return send(res, 200, { plan: getProfilePlan(), username: getBrand().posting.username || '' });
      if (p === '/api/browser/test' && req.method === 'POST') return send(res, 200, enqueue('browser-test', {}));
      if (p === '/api/browser/test') return send(res, 200, { result: getBrowserTest() });
      if (p === '/api/refs/find' && req.method === 'POST') {
        const kw = (Array.isArray(body.keywords) ? body.keywords : String(body.keywords || '').split(',')).map(k => String(k).replace(/[^\p{L}\p{N} #'&-]/gu, '').trim()).filter(Boolean).slice(0, 5);
        if (!kw.length) return send(res, 400, { error: 'Add at least one keyword.' });
        return send(res, 200, enqueue('find-refs', { keywords: kw, max: Math.min(15, Math.max(3, Number(body.max) || 10)), autoSave: Math.min(8, Math.max(0, Number(body.autoSave) || 0)), niche: getBrand().niche || 'general' }));
      }
      if (p === '/api/setup/ig') return send(res, 200, await igStatus());
      if (p === '/api/setup/autofill' && req.method === 'POST') { const u = String(body.url || '').trim(); if (!/^https?:\/\/[^\s]+$/i.test(u)) return send(res, 400, { error: 'Enter a full address like https://yoursite.com' }); return send(res, 200, enqueue('autofill', { url: u })); }
      if (p === '/api/setup/autofill') return send(res, 200, { result: getAutofill() });
      if (p === '/api/onboarding') { if (req.method === 'POST') setOnboarding({ step: body.step, done: body.done, skipped: body.skipped }); return send(res, 200, getOnboarding()); }

      if (p === '/api/keys') {
        if (req.method === 'POST') { for (const [k, name, env] of [['elevenlabs', 'elevenlabs', 'ELEVENLABS_API_KEY'], ['heygen', 'heygen', 'HEYGEN_API_KEY'], ['pexels', 'pexels', 'PEXELS_API_KEY']]) { const v = typeof body[k] === 'string' ? body[k].trim() : ''; if (v && /^[\w.-]{8,200}$/.test(v)) { setKey(name, v); process.env[env] = v; } else if (body[k] === '') { setKey(name, ''); delete process.env[env]; } } }
        const sec = loadSecrets(); return send(res, 200, { elevenlabs: !!sec.elevenlabs, heygen: !!sec.heygen, pexels: !!sec.pexels }); // values are never sent back
      }
      if (p === '/api/today') {
        const open_ = listInbox('open'); const runs = listRuns().slice(0, 3); const st = getSettings(); const u = usageToday();
        return send(res, 200, { brandMissing: missingBrand(), inbox: open_, runs, ideas: listIdeas('new').concat(listIdeas('approved')).slice(0, 8), refs: referenceCount(), mode: st.mode, usage: u, budget: st.budget, posting: getBrand().posting, claude: claudeAvailable() });
      }
      if (p === '/api/run' && req.method === 'POST') return send(res, 200, startRun({ post: body.post, at: body.at || undefined, skipRefs: !!body.skipRefs, idea: body.idea }));
      if (p === '/api/jobs/retry' && req.method === 'POST') { const j = getJob(String(body.id || '')); if (!j || !['failed', 'cancelled'].includes(j.status)) return send(res, 400, { error: 'Only a failed or cancelled task can be retried' }); return send(res, 200, enqueue(j.type, j.payload)); }
      if (p === '/api/run/retry' && req.method === 'POST') { const r = retryRun(String(body.id || '')); return r ? send(res, 200, r) : send(res, 400, { error: 'Only a failed or cancelled run can be retried' }); }
      if (p === '/api/run/skip' && req.method === 'POST') { const r = skipStep(String(body.id || '')); return r ? send(res, 200, r) : send(res, 400, { error: 'Nothing to skip right now. A step that is actively running has to finish or be cancelled first.' }); }
      if (p === '/api/run/cancel' && req.method === 'POST') return send(res, 200, cancelRun(body.id));
      if (p === '/api/inbox/answer' && req.method === 'POST') {
        const it = getItem(body.id); if (!it) return send(res, 404, { error: 'no such item' }); const a = body.answer || {}; const rid = it.payload?.runId;
        if (it.type === 'checkin' || it.type === 'ask-references') { if (a.text) addFromText(a.text, getBrand().niche || 'general'); if (a.focus) saveBrand({ todayFocus: a.focus }); }
        if (it.type === 'approve-ideas') { for (const id of it.payload.ids || []) setIdea(id, { status: (a.approved || []).includes(id) ? 'approved' : 'rejected' }); }
        if (rid && getRun(rid)?.status === 'waiting') answerGate(rid, a); else resolveItem(it.id, a);
        if (rid && getRun(rid)?.status === 'queued' && it.type === 'need-login') {}
        return send(res, 200, { ok: true });
      }
      if (p === '/api/inbox/dismiss' && req.method === 'POST') { resolveItem(body.id, {}, 'dismissed'); return send(res, 200, { ok: true }); }
      if (p === '/api/brand') { if (req.method === 'POST') saveBrand(body); return send(res, 200, { brand: getBrand(), missing: missingBrand() }); }
      if (p === '/api/claude') {
        if (req.method === 'POST') { const patch = {}; if (body.mode) patch.mode = body.mode; if (body.routing) patch.routing = body.routing; if (body.budget) patch.budget = { ...getSettings().budget, ...body.budget }; saveSettings(patch); }
        const st = getSettings(); return send(res, 200, { settings: st, tasks: Object.entries(TASKS).map(([k, t]) => ({ id: k, desc: t.desc, computer: !!t.computer, model: modelFor(k, st), overridden: !!st.routing?.[k] })), usage: usageToday(), codeOnly: CODE_ONLY, models: MODELS, available: claudeAvailable(), tokenSet: !!getClaudeToken() });
      }
      if (p === '/api/claude/token' && req.method === 'POST') {
        const had = getClaudeToken(); try { setClaudeToken(String(body.token || '').trim()); await askClaude({ task: 'usage_probe', prompt: 'Reply with the single word ok', force: true }); return send(res, 200, { ok: true }); }
        catch (e) { try { setClaudeToken(had); } catch {} return send(res, 400, { error: /sk-ant/.test(e.message) ? e.message : 'Claude did not accept that token: ' + e.message.slice(0, 160) }); } }
      if (p === '/api/claude/token/clear' && req.method === 'POST') { setClaudeToken(null); return send(res, 200, { ok: true }); }
      if (p === '/api/claude/token/open' && req.method === 'POST') { openClaudeSetupToken(); return send(res, 200, { ok: true }); }
      if (p === '/api/usage') return send(res, 200, reelkitWindows());
      if (p === '/api/usage/refresh' && req.method === 'POST') { try { await askClaude({ task: 'usage_probe', prompt: 'Reply with the single word ok', force: true }); } catch (e) { return send(res, 200, { ...reelkitWindows(), error: e.message }); } return send(res, 200, reelkitWindows()); }
      if (p === '/api/claude/test' && req.method === 'POST') { const r = await askClaude({ task: 'caption_hashtags', prompt: 'Reply JSON {"caption":"ok","hashtags":["#a"]}', schema: { type: 'object', properties: { caption: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } } }, required: ['caption', 'hashtags'] }, force: true }); return send(res, 200, { ok: true, model: r.model, usage: r.usage }); }
      if (p === '/api/ideas' && req.method === 'POST') { if (body.generate) { const f = await generateIdeas({ n: 5 }); return send(res, 200, { added: f.length }); } if (body.id) setIdea(body.id, { status: body.status }); return send(res, 200, { ok: true }); }
      if (p === '/api/browser' && req.method === 'POST') return send(res, 200, await ensureBrowser());
      if (p === '/api/footage/upload' && req.method === 'POST') {
        const name = (u.searchParams.get('name') || 'footage.mp4').replace(/[^\w.-]/g, '_'); if (!/\.(mp4|mov|m4v|webm|mkv)$/i.test(name)) return send(res, 400, { error: 'video files only' });
        const f = path.join(ensureDir(path.join(home(), 'footage')), Date.now() + '_' + name); const ws = fs.createWriteStream(f); let size = 0;
        req.on('data', d => { size += d.length; if (size > 4e9) { req.destroy(); ws.destroy(); } }); req.pipe(ws); await new Promise(r => ws.on('close', r)); return send(res, 200, { file: path.basename(f), size });
      }
      if (p === '/api/footage/analyze' && req.method === 'POST') { const f = path.join(home(), 'footage', path.basename(body.file || '')); if (!fs.existsSync(f)) return send(res, 404, { error: 'file not found' }); const planFile = f + '.plan.json'; try { fs.rmSync(planFile); } catch {} return send(res, 200, enqueue('footage-analyze', { file: f, level: body.level || 'standard', lang: body.lang || 'en', model: body.model, planFile })); }
      if (p === '/api/footage/plan') { const f = path.join(home(), 'footage', path.basename(u.searchParams.get('file') || '') + '.plan.json'); return send(res, 200, fs.existsSync(f) ? readJson(f, {}) : { pending: true }); }
      if (p === '/api/footage/render' && req.method === 'POST') { const f = path.join(home(), 'footage', path.basename(body.file || '')); const out = f.replace(/\.[^.]+$/, '') + '.final.mp4'; try { fs.rmSync(out); } catch {} return send(res, 200, { out: path.basename(out), ...enqueue('footage-render', { file: f, level: body.level || 'standard', lang: body.lang || 'en', model: body.model, style: body.style, captions: body.captions !== false, overrides: body.overrides || {}, out, planFile: f + '.plan.json' }) }); }
      if ((m = p.match(/^\/footage\/([\w.-]+\.mp4)$/))) {
        const f = path.join(home(), 'footage', m[1]); if (!fs.existsSync(f)) return send(res, 404, '', 'text/plain'); const st = fs.statSync(f); const rg = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
        if (rg) { const a = rg[1] ? +rg[1] : 0, b = rg[2] ? +rg[2] : st.size - 1; res.writeHead(206, { 'content-type': 'video/mp4', 'content-range': `bytes ${a}-${b}/${st.size}`, 'accept-ranges': 'bytes', 'content-length': b - a + 1 }); return fs.createReadStream(f, { start: a, end: b }).pipe(res); }
        res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': st.size, 'accept-ranges': 'bytes' }); return fs.createReadStream(f).pipe(res);
      }
      if ((m = p.match(/^\/api\/script\/([\w-]+)$/))) {
        if (!safe(m[1]) || !getMeta(m[1])) return send(res, 404, { error: 'no such reel' });
        if (req.method === 'POST') { fs.writeFileSync(scriptPath(m[1]), String(body.text || '')); }
        return send(res, 200, scriptView(m[1]));
      }
      if ((m = p.match(/^\/api\/has\/([\w-]+)$/))) return send(res, 200, { reel: fs.existsSync(path.join(reelDir(m[1]), 'reel.mp4')), draft: fs.existsSync(path.join(reelDir(m[1]), 'draft.mp4')) });
      if (p === '/api/render' && req.method === 'POST') { if (!safe(body.slug)) return send(res, 400, {}); if (body.fresh) { try { const w = path.join(reelDir(body.slug), 'work'); for (const f of fs.readdirSync(w)) if (/^(seg_|audio|video|a_)/.test(f)) fs.rmSync(path.join(w, f), { force: true }); } catch {} } return send(res, 200, enqueue('render', { slug: body.slug, style: body.style, voice: body.voice, lang: body.lang, draft: !!body.draft })); }
      if (p === '/api/schedule' && req.method === 'POST') { const mt = getMeta(body.slug); if (!mt) return send(res, 404, {}); Object.assign(mt, { status: 'scheduled', scheduledAt: new Date(body.at).toISOString(), caption: body.caption ?? mt.caption ?? mt.title, account: body.account || mt.account, trial: !!body.trial }); saveMeta(body.slug, mt); return send(res, 200, mt); }
      if (p === '/api/unschedule' && req.method === 'POST') { const mt = getMeta(body.slug); if (mt) { mt.status = 'rendered'; delete mt.scheduledAt; saveMeta(body.slug, mt); } return send(res, 200, {}); }
      if (p === '/api/post-now' && req.method === 'POST') { const mt = getMeta(body.slug); Object.assign(mt, { caption: body.caption ?? mt.caption ?? mt.title, account: body.account || mt.account, trial: !!body.trial }); saveMeta(body.slug, mt); return send(res, 200, enqueue('post', { slug: body.slug })); }
      if (p === '/api/swipe') return send(res, 200, { items: listSwipe({ status: u.searchParams.get('status') || undefined, niche: u.searchParams.get('niche') || undefined }).map(i => ({ ...i, viewsLabel: (i.est ? '~' : '') + fmtViews(i.views) })) });
      if (p === '/api/swipe/paste' && req.method === 'POST') { const n = addFromText(String(body.text || '').slice(0, 20000), getBrand().niche || 'general'); return send(res, 200, { added: n, total: referenceCount() }); }
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
  srv.on('error', e => { if (e.code === 'EADDRINUSE') console.error(`Port ${port} is already in use by another program. Close it, or start Reelkit on another port: node bin/reelkit.mjs dashboard --port ${port + 1}`); else console.error('Reelkit could not start: ' + e.message); stop(); process.exit(1); });
  srv.listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
    console.log(`Reelkit dashboard: http://localhost:${port}`);
    if (lan) { const ip = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address || '<your-pc-ip>'; console.log(`Phone (same Wi-Fi): http://${ip}:${port}/?token=${token}   <- keep this link private`); }
    console.log(worker ? 'Worker + scheduler running (keep this open so scheduled posts and daily check-ins happen).' : 'Worker disabled.');
    if (open) openAppWindow(`http://localhost:${port}/`);
  });
  srv.on('close', stop);
  return srv;
}

/** Open the dashboard in its own app-style window (Edge/Chrome --app mode): no tabs, no address bar. */
export function openAppWindow(url) {
  if (process.env.REELKIT_NO_WINDOW) return;
  const exe = findBrowser(); if (!exe) { console.log('Open ' + url + ' in your browser.'); return; }
  const p = spawn(exe, [`--app=${url}`, `--user-data-dir=${ensureDir(path.join(home(), 'app-profile'))}`, '--window-size=1240,900', '--no-first-run', '--no-default-browser-check'], { detached: true, stdio: 'ignore' }); p.unref();
}

/** Is a Reelkit dashboard already answering on this port? (also recognises older versions that have no /healthz) */
export function reelkitRunning(port) {
  const get = path => new Promise(res => { const q = http.get({ host: '127.0.0.1', port, path, timeout: 1500 }, r => { let b = ''; r.on('data', d => (b += d)); r.on('end', () => res({ code: r.statusCode, body: b })); }); q.on('error', () => res(null)); q.on('timeout', () => { q.destroy(); res(null); }); });
  return (async () => { const h = await get('/healthz'); try { if (h && JSON.parse(h.body).app === 'reelkit') return true; } catch {} const r = await get('/'); return !!(r && r.code === 200 && /<title>Reelkit<\/title>/.test(r.body)); })();
}
