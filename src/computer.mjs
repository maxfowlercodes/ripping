// "Claude uses your computer": Claude Code drives a dedicated Chrome profile through Playwright MCP.
// Chrome is started by Reelkit with a remote-debugging port and a persistent profile (you log in to Instagram once),
// so the browser (and the half-finished post) survives between Claude calls.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { findBrowser } from './browser.mjs';
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

export const mcpConfig = () => ({ mcpServers: { playwright: { command: 'npx', args: ['-y', '@playwright/mcp@latest', '--cdp-endpoint', `http://127.0.0.1:${CDP_PORT}`] } } });
export const ALLOWED = ['mcp__playwright'];

export const SAFETY = () => `You are operating the user's OWN Instagram account in a dedicated browser window that is already open and logged in. You may only: navigate within ${new URL(IG_URL()).host}, use the web post composer to create the one reel described, and read analytics pages. You must NOT: follow/unfollow, like, comment, send messages, edit the profile or settings, change passwords/2FA, open any other website, or type credentials. If you see a login page, checkpoint, captcha, "suspicious activity" notice or any unexpected dialog, STOP and report it instead of continuing. Work efficiently: prefer accessibility snapshots over screenshots, never repeat a failed action more than twice.`;

const postSchema = { type: 'object', properties: { status: { enum: ['ready', 'posted', 'login_required', 'error'] }, note: { type: 'string' }, url: { type: 'string' } }, required: ['status'] };

/** Phase A: upload + caption + advance to the final Share screen, then STOP. */
export async function prepareReelPost({ file, caption, trial = false, log }) {
  await ensureBrowser();
  const prompt = `Post a reel on Instagram web.
1. Go to ${IG_URL()}/ and click "Create" (+) in the left menu, then "Post".
2. In the dialog choose "Select from computer" and upload this exact file: ${file}
3. Click Next through the crop/trim step and the edit step (accept defaults; if asked "Video posts are now shared as reels" click OK).
4. In the caption box type exactly this caption (keep line breaks):
${caption}
${trial ? '5. If there is a "Trial" / "Share with non-followers first" option, turn it on.\n' : ''}Then STOP on the final screen with the Share button visible. DO NOT click Share.
Reply with JSON {status:"ready", note:"..."} when ready, {status:"login_required"} if you are logged out, or {status:"error", note} otherwise.`;
  const r = await askClaude({ task: 'computer_post', prompt, system: SAFETY(), schema: postSchema, mcpConfig: mcpConfig(), allowedTools: ALLOWED, validate: o => o.status === 'ready' || o.status === 'login_required' || `status ${o.status}: ${o.note || ''}`, timeoutMs: 600000, force: true, cwd: path.dirname(file), log });
  return r.output;
}
/** Phase B: click Share and confirm. */
export async function sharePost({ log }) {
  await ensureBrowser();
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
