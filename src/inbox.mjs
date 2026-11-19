// The app's inbox: questions Reelkit needs you to answer (daily check-in, references, approvals, review-before-post).
import path from 'node:path';
import crypto from 'node:crypto';
import { home, readJson, writeJson, run, has, isWin, isMac } from './util.mjs';
import { getBrand } from './brand.mjs';

const file = () => path.join(home(), 'inbox.json');
const all = () => readJson(file(), { items: [] }).items;
const save = items => writeJson(file(), { items });
export const listInbox = (status = 'open') => all().filter(i => !status || i.status === status).sort((a, b) => b.created.localeCompare(a.created));
export const getItem = id => all().find(i => i.id === id);
export function addInbox({ type, title, body = '', payload = {}, dedupeKey, notify = true }) {
  const items = all(); if (dedupeKey && items.some(i => i.dedupeKey === dedupeKey && i.status === 'open')) return items.find(i => i.dedupeKey === dedupeKey && i.status === 'open');
  const it = { id: crypto.randomBytes(4).toString('hex'), type, title, body, payload, dedupeKey, status: 'open', created: new Date().toISOString() };
  save([it, ...items].slice(0, 300)); if (notify) notifyOS(title, body); return it;
}
export function resolveItem(id, answer = {}, status = 'done') { const items = all(); const it = items.find(i => i.id === id); if (!it) throw new Error('no such inbox item'); Object.assign(it, { status, answer, resolved: new Date().toISOString() }); save(items); return it; }

/** Desktop notification (best effort, no dependencies). */
export function notifyOS(title, body = '') {
  try {
    if (!getBrand().notify || process.env.REELKIT_NO_OSNOTIFY) return;
    const t = String(title).replace(/["'`$\\]/g, ' ').slice(0, 80), b = String(body).replace(/["'`$\\]/g, ' ').slice(0, 160);
    if (isMac) run('osascript', ['-e', `display notification "${b}" with title "${t}"`]);
    else if (isWin) run('powershell', ['-NoProfile', '-Command', `Add-Type -AssemblyName System.Windows.Forms; $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(8000, '${t}', '${b}', 'Info'); Start-Sleep -Seconds 9; $n.Dispose()`], { timeout: 12000 });
    else if (has('notify-send')) run('notify-send', [t, b]);
  } catch {}
}
