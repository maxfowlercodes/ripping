// Instagram Graph API (official). Publishing, insights, Business Discovery. Multi-account.
// Written from Meta's documentation; NOT verified against a live account in this repo's test environment.
import fs from 'node:fs';
import { getAccount } from './accounts.mjs';

const V = () => process.env.IG_API_VERSION || 'v21.0';
const G = () => `https://graph.facebook.com/${V()}`;
async function j(res) { const x = await res.json().catch(() => ({})); if (x.error) throw new Error(`${x.error.message} (code ${x.error.code})`); return x; }
const qs = o => new URLSearchParams(o).toString();

export async function publishReel({ account, file, caption, trial = false, trialStrategy = 'MANUAL', log = console.log }) {
  const { token, igUserId: id } = getAccount(account);
  const size = fs.statSync(file).size;
  const body = new URLSearchParams({ media_type: 'REELS', upload_type: 'resumable', caption, access_token: token });
  if (trial) body.set('trial_params', JSON.stringify({ graduation_strategy: trialStrategy }));
  const c = await j(await fetch(`${G()}/${id}/media`, { method: 'POST', body }));
  log('container ' + c.id);
  await j(await fetch(`https://rupload.facebook.com/ig-api-upload/${V()}/${c.id}`, { method: 'POST', headers: { Authorization: `OAuth ${token}`, offset: '0', file_size: String(size) }, body: fs.readFileSync(file) }));
  for (let i = 0; i < 90; i++) {
    const s = await j(await fetch(`${G()}/${c.id}?${qs({ fields: 'status_code,status', access_token: token })}`));
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR') throw new Error('Instagram processing error: ' + s.status);
    await new Promise(r => setTimeout(r, 5000));
  }
  const p = await j(await fetch(`${G()}/${id}/media_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: c.id, access_token: token }) }));
  return p.id;
}

/** Per-reel insights. Metric names follow the current "views" model; unsupported ones are skipped individually. */
export async function mediaInsights(account, mediaId) {
  const { token } = getAccount(account); const out = {};
  for (const m of ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'ig_reels_avg_watch_time']) {
    try { const x = await j(await fetch(`${G()}/${mediaId}/insights?${qs({ metric: m, access_token: token })}`)); out[m] = x.data?.[0]?.values?.[0]?.value ?? 0; } catch { /* metric unavailable for this media/version */ }
  }
  return out;
}

/** Account-level: followers, reach split follower vs non-follower ("Who's watching"). */
export async function accountInsights(account, days = 28) {
  const { token, igUserId: id } = getAccount(account);
  const prof = await j(await fetch(`${G()}/${id}?${qs({ fields: 'username,followers_count,media_count', access_token: token })}`));
  const until = Math.floor(Date.now() / 1000), since = until - days * 86400; const res = { ...prof, days };
  try {
    const x = await j(await fetch(`${G()}/${id}/insights?${qs({ metric: 'reach', period: 'day', metric_type: 'total_value', breakdown: 'follow_type', since, until, access_token: token })}`));
    const tv = x.data?.[0]?.total_value; res.reach = tv?.value ?? 0; res.reachByFollowType = {};
    for (const r of tv?.breakdowns?.[0]?.results || []) res.reachByFollowType[String(r.dimension_values?.[0] || '').toLowerCase()] = r.value;
  } catch (e) { res.reachError = e.message; }
  try {
    const x = await j(await fetch(`${G()}/${id}/insights?${qs({ metric: 'views', period: 'day', metric_type: 'total_value', since, until, access_token: token })}`)); res.views = x.data?.[0]?.total_value?.value ?? 0;
  } catch (e) { res.viewsError = e.message; }
  return res;
}

/** Business Discovery: public Business/Creator accounts' recent media (official, read-only). */
export async function discoverCreator(account, username, limit = 25) {
  const { token, igUserId: id } = getAccount(account);
  const fields = `business_discovery.username(${username}){username,followers_count,media_count,media.limit(${limit}){id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,view_count,thumbnail_url,media_url}}`;
  const x = await j(await fetch(`${G()}/${id}?${qs({ fields, access_token: token })}`));
  return x.business_discovery;
}
