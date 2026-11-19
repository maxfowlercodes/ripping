// Secrets live OUTSIDE the repo: ~/.reelkit/secrets.json (chmod 600). Multiple Instagram accounts supported.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readJson, ensureDir } from './util.mjs';

export const secretsPath = () => process.env.REELKIT_SECRETS || path.join(os.homedir(), '.reelkit', 'secrets.json');
export const loadSecrets = () => readJson(secretsPath(), { accounts: [] });
export function saveSecrets(s) { const p = secretsPath(); ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(s, null, 2), { mode: 0o600 }); try { fs.chmodSync(p, 0o600); } catch {} }

/** Put saved API keys into process.env (without overriding real env vars). */
export function applySecrets() {
  const s = loadSecrets();
  for (const [k, v] of [['ELEVENLABS_API_KEY', s.elevenlabs], ['ELEVENLABS_VOICE_ID', s.elevenlabsVoice], ['HEYGEN_API_KEY', s.heygen]]) if (v && !process.env[k]) process.env[k] = v;
}
export function listAccounts() {
  const s = loadSecrets(); const out = s.accounts.map(a => ({ name: a.name, igUserId: a.igUserId, hasToken: !!a.token }));
  if (process.env.IG_ACCESS_TOKEN && process.env.IG_USER_ID && !out.find(a => a.name === 'default')) out.push({ name: 'default', igUserId: process.env.IG_USER_ID, hasToken: true });
  return out;
}
export function getAccount(name) {
  const s = loadSecrets();
  const a = (name && s.accounts.find(x => x.name === name)) || (!name && s.accounts[0]);
  if (a) return a;
  if (process.env.IG_ACCESS_TOKEN && process.env.IG_USER_ID) return { name: 'default', igUserId: process.env.IG_USER_ID, token: process.env.IG_ACCESS_TOKEN };
  throw new Error('No Instagram account connected. Run: reelkit account add <name> --user-id ID --token TOKEN  (see docs/INSTAGRAM.md)');
}
export function addAccount(name, igUserId, token) {
  const s = loadSecrets(); s.accounts = s.accounts.filter(a => a.name !== name); s.accounts.push({ name, igUserId, token }); saveSecrets(s);
}
export function setKey(k, v) { const s = loadSecrets(); s[k] = v; saveSecrets(s); }
