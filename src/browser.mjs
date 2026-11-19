import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWin, isMac, has } from './util.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadPlaywright() {
  const extra = [process.env.REELKIT_NODE_PATH, root, process.cwd(), '/opt/node-tools/node_modules', path.join(process.env.APPDATA || '', 'npm', 'node_modules')].filter(Boolean);
  for (const name of ['playwright-core', 'playwright']) {
    try { const req = createRequire(path.join(root, 'x.js')); return req(req.resolve(name, { paths: extra })); } catch {}
  }
  return null;
}

export function findBrowser() {
  if (process.env.REELKIT_BROWSER && fs.existsSync(process.env.REELKIT_BROWSER)) return process.env.REELKIT_BROWSER;
  const c = isWin ? [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  ] : isMac ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium']
  : ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  return c.find(p => p && fs.existsSync(p)) || null;
}

export async function launch() {
  const pw = loadPlaywright();
  if (!pw) throw new Error('playwright-core not found. Run: npm install   (it uses your installed Edge/Chrome, no download needed on Windows)');
  const exe = findBrowser();
  try { return await pw.chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox', '--font-render-hinting=none'] } : { args: ['--no-sandbox'] }); }
  catch (e) { throw new Error('Could not start a browser (' + e.message.split('\n')[0] + '). Install Chrome or Edge, or set REELKIT_BROWSER.'); }
}
export const browserAvailable = () => !!loadPlaywright() && (!!findBrowser() || true);
export const rootDir = root;
