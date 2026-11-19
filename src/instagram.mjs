// Instagram Graph API publishing + insights (Reels). Needs an Instagram professional account linked to a Facebook Page,
// plus a long-lived token with instagram_content_publish + instagram_manage_insights. See docs/INSTAGRAM.md.
import fs from 'node:fs';
const V = process.env.IG_API_VERSION || 'v21.0';
const G = `https://graph.facebook.com/${V}`;
const creds = () => {
  const token = process.env.IG_ACCESS_TOKEN, id = process.env.IG_USER_ID;
  if (!token || !id) throw new Error('Set IG_ACCESS_TOKEN and IG_USER_ID (see docs/INSTAGRAM.md).');
  return { token, id };
};
async function j(res) { const x = await res.json(); if (x.error) throw new Error(`${x.error.message} (code ${x.error.code})`); return x; }

export async function publishReel({ file, caption, trial = false, log = console.log }) {
  const { token, id } = creds();
  const size = fs.statSync(file).size;
  const body = new URLSearchParams({ media_type: 'REELS', upload_type: 'resumable', caption, access_token: token });
  if (trial) body.set('trial_params', JSON.stringify({ graduation_strategy: 'MANUAL' }));
  const c = await j(await fetch(`${G}/${id}/media`, { method: 'POST', body }));
  log('container ' + c.id);
  await j(await fetch(`https://rupload.facebook.com/ig-api-upload/${V}/${c.id}`, {
    method: 'POST', headers: { Authorization: `OAuth ${token}`, offset: '0', file_size: String(size) }, body: fs.readFileSync(file) }));
  for (let i = 0; i < 60; i++) {
    const s = await j(await fetch(`${G}/${c.id}?fields=status_code,status&access_token=${token}`));
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR') throw new Error('Instagram processing error: ' + s.status);
    await new Promise(r => setTimeout(r, 5000));
  }
  const p = await j(await fetch(`${G}/${id}/media_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: c.id, access_token: token }) }));
  return p.id;
}

export async function insights(mediaId) {
  const { token } = creds();
  const x = await j(await fetch(`${G}/${mediaId}/insights?metric=views,reach,likes,comments,shares,saved&access_token=${token}`));
  const out = {}; for (const m of x.data) out[m.name] = m.values?.[0]?.value ?? 0; return out;
}
