// "Claude uses your computer": Claude Code drives a dedicated Chrome profile through Playwright MCP.
// Chrome is started by Reelkit with a remote-debugging port and a persistent profile (you log in to Instagram once),
// so the browser (and the half-finished post) survives between Claude calls.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { openPage, prepareDeterministic, shareDeterministic } from './igflow.mjs';
import { spawn } from 'node:child_process';
import { findBrowser, rootDir } from './browser.mjs';
import { home, ensureDir } from './util.mjs';
import { askClaude, getSettings } from './claude.mjs';

export const CDP_PORT = Number(process.env.REELKIT_CDP_PORT || 9333);
export const profileDir = () => ensureDir(process.env.REELKIT_PROFILE || path.join(home(), 'browser-profile'));
const listening = port => new Promise(res => { const s = net.connect(port, '127.0.0.1'); s.on('connect', () => { s.destroy(); res(true); }); s.on('error', () => res(false)); setTimeout(() => { s.destroy(); res(false); }, 800); });

/** Start the dedicated Chrome (visible window) if it is not already running. */
export const IG_URL = () => (process.env.REELKIT_IG_URL || 'https://www.instagram.com').replace(/\/$/, '');
export async function ensureBrowser(url = IG_URL() + '/') {
  if (await listening(CDP_PORT)) return { launched: false };
  const exe = findBrowser(); if (!exe) throw new Error('No Chrome/Edge found. Install one or set REELKIT_BROWSER.');
  const headless = process.platform === 'linux' && !process.env.DISPLAY ? ['--headless=new'] : [];
  const p = spawn(exe, [...headless, '--no-sandbox', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir()}`, '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', url], { detached: true, stdio: 'ignore' }); p.unref();
  for (let i = 0; i < 30; i++) { if (await listening(CDP_PORT)) return { launched: true }; await new Promise(r => setTimeout(r, 500)); }
  throw new Error('Browser did not open its debugging port.');
}

// Browser control: the Playwright MCP server ships inside Reelkit (node_modules), so there is no download at the moment of use.
// Fallback to npx (on native Windows npx is a .cmd shim, so it must go through cmd /c).
const localMcp = () => { const p = path.join(rootDir, 'node_modules', '@playwright', 'mcp', 'cli.js'); return fs.existsSync(p) ? p : null; };
export const mcpConfig = (platform = process.platform, local = localMcp()) => {
  const cdp = ['--cdp-endpoint', `http://127.0.0.1:${CDP_PORT}`];
  if (local) return { mcpServers: { playwright: { command: 'node', args: [local, ...cdp] } } };
  const a = ['-y', '@playwright/mcp@latest', ...cdp]; return { mcpServers: { playwright: platform === 'win32' ? { command: 'cmd', args: ['/c', 'npx', ...a] } : { command: 'npx', args: a } } };
};
// Explicit allowlist: what browsing and posting need. Code execution and network inspection are NOT allowed, because page content
// (captions, bios) is untrusted and could try to steer Claude.
export const ALLOWED = ['navigate', 'navigate_back', 'snapshot', 'click', 'type', 'fill_form', 'press_key', 'wait_for', 'take_screenshot', 'file_upload', 'hover', 'select_option', 'handle_dialog', 'tabs', 'mouse_wheel', 'resize'].map(t => 'mcp__playwright__browser_' + t);

export const SAFETY = () => `You are operating the user's OWN Instagram account in a dedicated browser window that is already open and logged in. You may only: navigate within ${new URL(IG_URL()).host}, use the web post composer to create the one reel described, and read analytics pages. You must NOT: follow/unfollow, like, comment, send messages, edit the profile or settings, change passwords/2FA, open any other website, or type credentials. If you see a login page, checkpoint, captcha, "suspicious activity" notice or any unexpected dialog, STOP and report it instead of continuing. Work efficiently: prefer accessibility snapshots over screenshots, never repeat a failed action more than twice.`;

const postSchema = { type: 'object', properties: { status: { enum: ['ready', 'posted', 'login_required', 'error'] }, note: { type: 'string' }, url: { type: 'string' } }, required: ['status'] };

/** Attach a file to the page's <input type=file> through the DevTools socket. Instagram's own file chooser is a native OS dialog that
 *  browser-automation tools often cannot answer (it timed out for the first real user), so Reelkit hands the file over directly. */
export async function attachFile(file, port = CDP_PORT) {
  if (typeof WebSocket === 'undefined') throw new Error('Needs Node 22+');
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2500) })).json();
  const pages = list.filter(t => t.type === 'page' && t.webSocketDebuggerUrl); const t = pages.find(x => /instagram\.com/.test(x.url)) || pages[0]; if (!t) throw new Error('No browser tab is open');
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pending = new Map(); const to = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('attach timeout')); }, 12000);
    const call = (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
    ws.onmessage = e => { const m = JSON.parse(e.data); const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
    ws.onerror = () => { clearTimeout(to); reject(new Error('devtools connection failed')); };
    ws.onopen = async () => {
      try {
        const inputs = await call('Runtime.evaluate', { expression: `(() => { const l = [...document.querySelectorAll('input[type=file]')]; return l.length })()`, returnByValue: true });
        if (!inputs.result?.value) throw new Error('No file input found on the page');
        const r = await call('Runtime.evaluate', { expression: `(() => { const l = [...document.querySelectorAll('input[type=file]')]; return l.find(i => /video|mp4|quicktime/i.test(i.accept || '')) || l[l.length - 1]; })()` });
        await call('DOM.setFileInputFiles', { objectId: r.result.objectId, files: [file] }); clearTimeout(to); ws.close(); resolve(true);
      } catch (e) { clearTimeout(to); try { ws.close(); } catch {} reject(e); }
    };
  });
}

/** Phase A: open the composer, hand over the video, add the caption, advance to the final Share screen, then STOP. */
export async function prepareReelPost({ file, caption, trial = false, log }) {
  await ensureBrowser();
  // First choice: Reelkit drives the composer itself (fast, free, no waiting for "stable" elements). Claude is the fallback.
  try { const pg = await openPage(CDP_PORT, { gotoUrl: IG_URL() + '/' }); try { const r = await prepareDeterministic(pg, { file: path.resolve(file), caption, trial, log }); if (r.status === 'ready' || r.status === 'login_required') return r; } finally { pg.close(); } }
  catch (e) { log?.('Reelkit could not do the composer itself (' + e.message + '). Asking Claude to do it.'); }
  const tail = `4. Click Next through the crop/trim step and the edit step (accept defaults; if asked "Video posts are now shared as reels" click OK).
5. In the caption box type exactly this caption (keep line breaks):
${caption}
${trial ? '6. If there is a "Trial" / "Share with non-followers first" option, turn it on.\n' : ''}Then STOP on the final screen with the Share button visible. DO NOT click Share.
Reply with JSON {status:"ready", note:"..."} when ready, {status:"login_required"} if you are logged out, or {status:"error", note} otherwise.`;
  const open = `Open Instagram web and get the "Create new post" dialog to the first screen, where "Select from computer" is visible.
1. If any dialog, file picker or half-finished post from an earlier attempt is open, close it (Escape, or Discard if asked) and start clean.
2. Go to ${IG_URL()}/ and click "Create" (+) in the left menu, then "Post" if a submenu appears.
3. STOP as soon as you can see the "Select from computer" button. Do NOT click it, and do not try to upload anything yourself.
Reply JSON {status:"ready"} when that screen is showing, {status:"login_required"} if you are logged out, or {status:"error", note}.`;
  const opts = { system: SAFETY(), schema: postSchema, mcpConfig: mcpConfig(), allowedTools: ALLOWED, timeoutMs: 600000, force: true, cwd: path.dirname(file), log };
  const a = await askClaude({ task: 'computer_post', prompt: open, validate: o => o.status === 'ready' || o.status === 'login_required' || `status ${o.status}: ${o.note || ''}`, ...opts, maxTurns: 16 });
  if (a.output.status === 'login_required') return a.output;
  let attached = false; try { log?.('Handing the video to Instagram...'); attached = await attachFile(path.resolve(file)); } catch (e) { log?.('Direct attach failed (' + e.message + '), asking Claude to use the file chooser'); }
  const prompt = attached
    ? `The video file has just been attached to the Instagram "Create new post" dialog. Wait a few seconds for the preview to load.\n${tail.replace(/^4\./, '1.').replace('\n5.', '\n2.').replace('\n6.', '\n3.')}`
    : `Post a reel on Instagram web. The "Create new post" dialog is open.\n1. Click "Select from computer" and upload this exact file: ${file}\n2. If the file chooser does not respond within a minute, STOP and report {status:"error", note}.\n${tail.replace(/^4\./, '3.')}`;
  const r = await askClaude({ task: 'computer_post', prompt, validate: o => o.status === 'ready' || o.status === 'login_required' || `status ${o.status}: ${o.note || ''}`, ...opts });
  return r.output;
}
/** Phase B: click Share and confirm. */
export async function sharePost({ log }) {
  await ensureBrowser();
  try { const pg = await openPage(CDP_PORT); try { const r = await shareDeterministic(pg, { log }); if (r.status === 'posted' || r.note) return r; } finally { pg.close(); } } catch (e) { log?.('Reelkit could not click Share itself (' + e.message + '). Asking Claude.'); }
  const prompt = `The Instagram "New reel" dialog is open on its final screen. Click "Share", wait until you see "Your reel has been shared" (or the dialog closes with a success message), then reply JSON {status:"posted", url:"<permalink if visible>"} or {status:"error", note}. Do nothing else.`;
  const r = await askClaude({ task: 'computer_post', prompt, system: SAFETY(), schema: postSchema, mcpConfig: mcpConfig(), allowedTools: ALLOWED, timeoutMs: 300000, force: true, maxTurns: 14, log });
  return r.output;
}

const insightsSchema = { type: 'object', properties: { reels: { type: 'array', items: { type: 'object', properties: { match: { type: 'string' }, views: { type: 'number' }, likes: { type: 'number' }, comments: { type: 'number' }, shares: { type: 'number' }, saves: { type: 'number' } }, required: ['match', 'views'] } } }, required: ['reels'] };
export async function readInsights({ username, posts, log }) {
  await ensureBrowser();
  const prompt = `Open ${IG_URL()}/${username}/reels/ . For each of these reels (identify each by the start of its caption), open it and read its view count, likes, comments, shares and saves (use "View insights" if needed; saves/shares may only appear in insights). Reels:\n${posts.map((p, i) => `${i + 1}. "${p.caption.slice(0, 60)}" posted ${p.postedAt?.slice(0, 10)}`).join('\n')}\nReturn JSON {reels:[{match:"<caption start>", views, likes, comments, shares, saves}]}. Use 0 for numbers you cannot see. Read only, change nothing.`;
  const r = await askClaude({ task: 'computer_insights', prompt, system: SAFETY(), schema: insightsSchema, mcpConfig: mcpConfig(), allowedTools: ALLOWED, timeoutMs: 600000, force: true, log }); return r.output.reels;
}

const researchSchema = { type: 'object', properties: { reels: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, creator: { type: 'string' }, views: { type: 'number' }, likes: { type: 'number' }, comments: { type: 'number' }, caption: { type: 'string' }, followers: { type: 'number' } }, required: ['url', 'creator', 'views', 'caption'] } } }, required: ['reels'] };
export async function researchReels({ handles = [], hashtags = [], max = 12, log }) {
  await ensureBrowser();
  const targets = [...handles.map(h => `${IG_URL()}/${h.replace('@', '')}/reels/`), ...hashtags.map(h => `${IG_URL()}/explore/tags/${h.replace('#', '')}/`)];
  const prompt = `Read-only research. Visit each page below, and from the reel grid note view counts. Pick the reels with the highest views relative to the account's usual reels (max ${max} in total). For each, open it to read the full caption and likes/comments, and note the account's follower count. Pages:\n${targets.join('\n')}\nReturn JSON {reels:[{url, creator, views, likes, comments, caption, followers}]}. Do not like, follow or comment.`;
  const r = await askClaude({ task: 'computer_research', prompt, system: SAFETY(), schema: researchSchema, mcpConfig: mcpConfig(), allowedTools: ALLOWED, timeoutMs: 900000, force: true, log }); return r.output.reels;
}

const checkSchema = { type: 'object', properties: { loggedIn: { type: 'boolean' }, username: { type: 'string' }, note: { type: 'string' } }, required: ['loggedIn'] };
/** Read-only end-to-end test: Claude CLI -> Playwright MCP -> the Reelkit browser -> Instagram. Also finds your @username. */
export async function checkInstagram({ log } = {}) {
  await ensureBrowser();
  const prompt = `Read-only check. Open ${IG_URL()}/ . Decide whether you are logged in (you can see the home feed or a left menu with a Profile entry) or logged out (a login form is shown). If logged in, open the Profile link in the left menu and report the @username exactly as shown. Do not click anything else. Reply JSON {loggedIn, username, note}.`;
  const r = await askClaude({ task: 'computer_check', prompt, system: SAFETY(), schema: checkSchema, mcpConfig: mcpConfig(), allowedTools: ALLOWED, maxTurns: 14, timeoutMs: 240000, force: true, log });
  return r.output;
}

const findSchema = { type: 'object', properties: { reels: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, creator: { type: 'string' }, views: { type: 'number' }, likes: { type: 'number' }, comments: { type: 'number' }, caption: { type: 'string' }, followers: { type: 'number' }, postedAgo: { type: 'string' } }, required: ['url', 'creator', 'views', 'caption'] } }, note: { type: 'string' } }, required: ['reels'] };
export const searchUrl = kw => `${IG_URL()}/explore/search/keyword/?q=${encodeURIComponent(kw)}`;
export function findPrompt({ keywords, max }) {
  return `Read-only research on Instagram: find Reels in this niche that are performing unusually well RIGHT NOW.
Keywords: ${keywords.map(k => `"${k}"`).join(', ')}.
For each keyword open ${searchUrl('<keyword>')} (replace <keyword>, URL-encoded). If that page shows no results, use the Search item in the left menu, type the keyword, and look at the Reels results. Look only at Reels from roughly the last 30 days. Scroll at most 2 screens per keyword, at a human pace.
From the grids, pick the reels with the highest view counts. Open up to ${max} reels in total (spread across keywords) and read: the exact reel URL, the creator @handle, views, likes, comments, the first 200 characters of the caption, and how long ago it was posted. For each distinct creator, open their profile ONCE and read the follower count (needed to judge whether the reel beat their usual reach).
Stay under 90 page actions in total. Aim for at least 8 reels; keep going through the keywords until you have them, and only open a creator profile for your top 5 reels (skip follower counts for the rest, return followers 0). Do not like, follow, save, comment or message anything. Return JSON {reels:[{url,creator,views,likes,comments,caption,followers,postedAgo}], note}. Convert counts like "1.2M" or "58K" to plain numbers. If a reel's view count is not shown anywhere, return views as 0 but make sure likes and comments are filled in. If you cannot find any reels, return an empty list and explain exactly what you saw (login page, no results, a blocked page) in note.`;
}
/** Claude searches Instagram for you: keyword -> top recent reels -> outlier candidates for the Swipe feed. */
export async function findReels({ keywords, max = 10, log } = {}) {
  await ensureBrowser(); const kw = keywords.map(k => String(k).trim()).filter(Boolean).slice(0, 5); if (!kw.length) throw new Error('Give at least one keyword');
  const r = await askClaude({ task: 'computer_research', prompt: findPrompt({ keywords: kw, max: Math.min(15, Math.max(3, max)) }), system: SAFETY(), schema: findSchema, mcpConfig: mcpConfig(), allowedTools: ALLOWED, maxTurns: 90, timeoutMs: 1200000, force: true, log });
  return r.output;
}
