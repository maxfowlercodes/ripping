// HeyGen avatar videos (optional, your own HeyGen key). Written from HeyGen's public API docs; untested here.
import fs from 'node:fs';
const H = 'https://api.heygen.com';
const hdr = () => { if (!process.env.HEYGEN_API_KEY) throw new Error('HEYGEN_API_KEY not set (reelkit key heygen <key>)'); return { 'X-Api-Key': process.env.HEYGEN_API_KEY, 'content-type': 'application/json' }; };

export async function listAvatars() { const r = await (await fetch(`${H}/v2/avatars`, { headers: hdr() })).json(); return (r.data?.avatars || []).map(a => ({ id: a.avatar_id, name: a.avatar_name })); }
export async function listVoices() { const r = await (await fetch(`${H}/v2/voices`, { headers: hdr() })).json(); return (r.data?.voices || []).map(v => ({ id: v.voice_id, name: v.name, language: v.language })); }

/** Generate a talking-head clip on a chroma-green background (composited later). Returns mp4 path. */
export async function makeAvatar({ text, avatarId, voiceId, out, log = console.log }) {
  const body = { video_inputs: [{ character: { type: 'avatar', avatar_id: avatarId, avatar_style: 'normal' }, voice: { type: 'text', input_text: text, voice_id: voiceId }, background: { type: 'color', value: '#00FF00' } }], dimension: { width: 1080, height: 1920 } };
  const c = await (await fetch(`${H}/v2/video/generate`, { method: 'POST', headers: hdr(), body: JSON.stringify(body) })).json();
  const id = c.data?.video_id; if (!id) throw new Error('HeyGen: ' + JSON.stringify(c.error || c).slice(0, 200));
  for (let i = 0; i < 240; i++) {
    const s = await (await fetch(`${H}/v1/video_status.get?video_id=${id}`, { headers: hdr() })).json();
    const st = s.data?.status; log('heygen ' + st);
    if (st === 'completed') { const buf = Buffer.from(await (await fetch(s.data.video_url)).arrayBuffer()); fs.writeFileSync(out, buf); return out; }
    if (st === 'failed') throw new Error('HeyGen failed: ' + JSON.stringify(s.data.error));
    await new Promise(r => setTimeout(r, 10000));
  }
  throw new Error('HeyGen timed out');
}
