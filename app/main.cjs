// Reelkit desktop app (Electron). Runs the dashboard + worker, lives in the system tray so the scheduler,
// daily check-ins and posting keep running when the window is closed.
const { app, BrowserWindow, Tray, Menu, Notification, shell, nativeImage, dialog } = require('electron');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const PORT = Number(process.env.REELKIT_PORT || 4177);
const ROOT = path.join(__dirname, '..');
let win = null, tray = null, server = null, quitting = false; const seen = new Set();

const get = p => new Promise(res => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => { let b = ''; r.on('data', d => (b += d)); r.on('end', () => { try { res(JSON.parse(b)); } catch { res(null); } }); }).on('error', () => res(null)));
const post = (p, body) => new Promise(res => { const d = JSON.stringify(body || {}); const q = http.request({ host: '127.0.0.1', port: PORT, path: p, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(d) } }, r => { r.resume(); r.on('end', () => res(true)); }); q.on('error', () => res(false)); q.end(d); });

function startServer() {
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', REELKIT_NO_OSNOTIFY: '1', REELKIT_HOME: process.env.REELKIT_HOME || path.join(app.getPath('documents'), 'Reelkit') };
  server = spawn(process.execPath, [path.join(ROOT, 'bin', 'reelkit.mjs'), 'dashboard', '--port', String(PORT)], { env, cwd: ROOT, stdio: 'inherit' });
  server.on('exit', c => { if (!quitting) { dialog.showErrorBox('Reelkit', 'The Reelkit engine stopped (code ' + c + ').'); app.quit(); } });
}
async function waitReady() { for (let i = 0; i < 60; i++) { if (await get('/api/today')) return true; await new Promise(r => setTimeout(r, 500)); } return false; }

function createWindow() {
  win = new BrowserWindow({ width: 1240, height: 900, minWidth: 420, backgroundColor: '#0b0f1a', title: 'Reelkit', icon: path.join(__dirname, 'icon.png'), webPreferences: { contextIsolation: true, sandbox: true } });
  win.setMenuBarVisibility(false); win.loadURL(`http://127.0.0.1:${PORT}/`);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); } }); // keep running in the tray
}
function showWin() { if (!win) createWindow(); win.show(); win.focus(); }

function buildTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 18, height: 18 })); tray.setToolTip('Reelkit');
  const menu = () => Menu.buildFromTemplate([
    { label: 'Open Reelkit', click: showWin },
    { label: 'Make & Post now', click: async () => { await post('/api/run', {}); showWin(); } },
    { type: 'separator' },
    { label: 'Start at login', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: i => app.setLoginItemSettings({ openAtLogin: i.checked }) },
    { label: 'Quit (stops scheduled posts)', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu()); tray.on('click', showWin);
}

// native notifications for new inbox items (daily check-in, review before sharing, errors)
async function pollInbox() {
  const t = await get('/api/today'); if (!t) return;
  for (const it of t.inbox) if (!seen.has(it.id)) { seen.add(it.id); if (seen.size > 1 || it.created > new Date(Date.now() - 120000).toISOString()) { const n = new Notification({ title: it.title, body: it.body.slice(0, 140) }); n.on('click', showWin); n.show(); } }
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showWin);
  app.whenReady().then(async () => {
    startServer(); if (!(await waitReady())) { dialog.showErrorBox('Reelkit', 'The engine did not start.'); return app.quit(); }
    (await get('/api/today'))?.inbox?.forEach(i => seen.add(i.id)); buildTray(); createWindow(); setInterval(pollInbox, 20000);
  });
  app.on('before-quit', () => { quitting = true; try { server?.kill(); } catch {} });
  app.on('window-all-closed', e => e.preventDefault());
}
