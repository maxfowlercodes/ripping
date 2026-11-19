'use strict';
// Reelkit UI kit: custom line icons (no emoji), navigation, dialogs, switches, segmented controls.
const ICON = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  swipe: '<rect x="6.5" y="4" width="11" height="16" rx="2.6"/><path d="M3 8.5v7M21 8.5v7"/>',
  script: '<path d="M5 6.5h14M5 12h14M5 17.5h8"/>',
  produce: '<rect x="3" y="5" width="18" height="14" rx="3.2"/><path d="m10.3 9.4 4.6 2.6-4.6 2.6z" fill="currentColor"/>',
  footage: '<path d="M4 12v0M8 8.5v7M12 4.5v15M16 8.5v7M20 12v0"/>',
  library: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  profile: '<circle cx="12" cy="9" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4"/>',
  post: '<path d="M21 3 10.5 13.5"/><path d="M21 3l-6.5 18-4-7.5L3 9.5z"/>',
  analyze: '<path d="M5.5 20v-9M12 20V4.5M18.5 20v-6.5"/>',
  repurpose: '<path d="M4 11.5a8 8 0 0 1 14-4.7L20 9"/><path d="M20 4v5h-5"/><path d="M20 12.5a8 8 0 0 1-14 4.7L4 15"/><path d="M4 20v-5h5"/>',
  leads: '<path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6l-4.5 3.5V17H7a3 3 0 0 1-3-3z"/>',
  research: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m20 20-4.7-4.7"/>',
  claude: '<path d="M4 7.5h9M17 7.5h3M4 16.5h3M11 16.5h9"/><circle cx="15" cy="7.5" r="2"/><circle cx="9" cy="16.5" r="2"/>',
  setup: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7"/>',
  guide: '<path d="M5 4.5h9a4 4 0 0 1 4 4V20H9a4 4 0 0 1-4-4z"/><path d="M5 16a4 4 0 0 1 4-4h9"/>',
  more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>', play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
  pause: '<path d="M8 5.5v13M16 5.5v13"/>', refresh: '<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>', trash: '<path d="M4.5 7h15M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5v-2a2.5 2.5 0 0 0-2.5-2.5H6.5A2.5 2.5 0 0 0 4 6.5V13a2.5 2.5 0 0 0 2.5 2.5h2"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="m4 8 8 5.5L20 8"/>', external: '<path d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  spark: '<path d="M12 3.5l1.9 5.2 5.2 1.9-5.2 1.9L12 17.7l-1.9-5.2-5.2-1.9 5.2-1.9zM18.5 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  shield: '<path d="M12 3.5 5 6.2v5.3c0 4.2 2.8 7.4 7 9 4.2-1.6 7-4.8 7-9V6.2z"/><path d="m9 12 2.2 2.2L15.5 10"/>', lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.5 3.8 5.3 3.8 8.5s-1.2 6-3.8 8.5c-2.6-2.5-3.8-5.3-3.8-8.5S9.4 6 12 3.5z"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>', user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>', bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/>',
  chevron: '<path d="m9 5.5 6.5 6.5L9 18.5"/>', back: '<path d="m15 5.5-6.5 6.5 6.5 6.5"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', terminal: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="m7.5 10 3 2.5-3 2.5M13 15h3.5"/>',
  download: '<path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 19.5h14"/>', cpu: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>',
  camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.2-2h5l1.2 2h1.8A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.4"/>', key: '<circle cx="8" cy="15" r="3.5"/><path d="m10.5 12.5 8-8M15 8l2.5 2.5"/>', wave: '<path d="M3 12h2M7 8v8M11 4v16M15 8v8M19 12h2"/>',
};
const ic = (n, s = 18) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ''}</svg>`;
const tile = (color, icon, size = 18) => `<span class="tile t-${color}">${ic(icon, size)}</span>`;

const NAV = [
  ['Create', [['today', 'Today'], ['swipe', 'Swipe'], ['script', 'Script'], ['produce', 'Produce'], ['footage', 'Footage']]],
  ['Grow', [['library', 'Posts'], ['post', 'Schedule'], ['profile', 'Profile'], ['analyze', 'Analyze'], ['repurpose', 'Repurpose'], ['leads', 'Leads']]],
  ['Studio', [['research', 'Research'], ['claude', 'Claude'], ['setup', 'Settings'], ['guide', 'Guide']]],
];
const TABBAR = ['today', 'produce', 'library', 'analyze'];
function buildNav(active, st) {
  $('#nav').innerHTML = NAV.map(([g, items]) => `<div class="navgrp">${g}</div>` + items.map(([k, l]) => `<a href="#${k}" class="${k === active ? 'on' : ''}">${ic(k, 18)}<span>${l}</span></a>`).join('')).join('');
  const all = NAV.flatMap(([, i]) => i); const label = k => all.find(x => x[0] === k)?.[1];
  $('#tabbar').innerHTML = TABBAR.map(k => `<a href="#${k}" class="${k === active ? 'on' : ''}">${ic(k, 24)}<span>${label(k)}</span></a>`).join('') + `<a href="#" id="moretab" class="${TABBAR.includes(active) ? '' : 'on'}">${ic('more', 24)}<span>More</span></a>`;
  $('#moretab').onclick = e => { e.preventDefault(); ask({ title: 'More', list: all.filter(([k]) => !TABBAR.includes(k)).map(([k, l]) => ({ k, l })) }); };
  if (st) { const free = st.freeBytes == null ? null : st.freeBytes / 1e9; $('#sidefoot').innerHTML = `<span>Claude mode: <b style="color:var(--text)">${esc(st.mode || 'eco')}</b></span><span>${st.calls || 0} model calls today</span>${free != null && free < 8 ? `<a href="#setup" style="color:${free < 3 ? 'var(--red)' : 'var(--orange)'}">Low disk space: ${free.toFixed(1)} GB free</a>` : ''}`; }
}

/** Apple-style dialog. ask({title, message, input, placeholder, value, confirm, cancel, danger, list}) -> string | true | null */
function ask(o) {
  return new Promise(res => {
    const layer = $('#layer'); const close = v => { layer.innerHTML = ''; res(v); };
    layer.innerHTML = `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true"><h4>${esc(o.title || '')}</h4>${o.message ? `<p>${esc(o.message)}</p>` : '<div style="height:6px"></div>'}
      ${o.input ? `<input id="askin" placeholder="${esc(o.placeholder || '')}" value="${esc(o.value || '')}" autocomplete="off">` : ''}
      ${o.list ? `<div class="list" style="margin:8px 0 0">${o.list.map(x => `<a class="li" href="#${x.k}" style="color:var(--text);text-decoration:none">${ic(x.k, 18)}<span class="grow">${esc(x.l)}</span>${ic('chevron', 16)}</a>`).join('')}</div>` : ''}
      <div class="acts2">${o.list ? '<button class="alt" data-x="cancel">Close</button>' : `<button class="alt" data-x="cancel">${esc(o.cancel || 'Cancel')}</button><button class="${o.danger ? 'danger' : ''}" data-x="ok">${esc(o.confirm || 'OK')}</button>`}</div></div></div>`;
    const inp = $('#askin'); if (inp) { inp.focus(); inp.select(); inp.onkeydown = e => { if (e.key === 'Enter') close(inp.value.trim() || null); }; }
    layer.querySelector('[data-x=cancel]').onclick = () => close(null); const okb = layer.querySelector('[data-x=ok]'); if (okb) okb.onclick = () => close(inp ? inp.value.trim() || null : true);
    layer.querySelector('.scrim').onclick = e => { if (e.target.classList.contains('scrim')) close(null); }; layer.querySelectorAll('.li').forEach(a => (a.onclick = () => close(null)));
    document.onkeydown = e => { if (e.key === 'Escape' && layer.innerHTML) close(null); };
  });
}
const swHtml = (id, on) => `<input type="checkbox" class="sw" id="${id}" ${on ? 'checked' : ''}>`;
const swRow = (id, label, on, hint) => `<label class="swrow"><span>${label}${hint ? `<span class="mut" style="display:block;font-size:13px">${hint}</span>` : ''}</span>${swHtml(id, on)}</label>`;
const segHtml = (id, options, value) => `<div class="seg" id="${id}">${options.map(([v, l]) => `<button type="button" data-v="${esc(v)}" class="${v === value ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
function bindSeg(id, onChange) { const h = document.getElementById(id); h.querySelectorAll('button').forEach(b => (b.onclick = () => { h.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); onChange(b.dataset.v); })); }

/** Claude searches Instagram (in the Reelkit browser) for reels beating their account's usual reach. Resolves with {ok, text}. */
const JOBNAME = { research: 'the research', autofill: 'reading your website', install: 'an install', 'browser-test': 'the browser test', 'find-refs': 'another search', post: 'a post', profile: 'the profile plan', analyze: 'analytics', render: 'a render' };
const jobLine = j => (j.status === 'queued' ? (j.queue?.waitingOn ? `Waiting for ${JOBNAME[j.queue.waitingOn.type] || 'another task'} to finish…` : 'Starting…') : (j.log || []).slice(-1)[0] || 'Starting…');
async function findRefsFlow(keywords, { autoSave = 0, onTick } = {}) {
  const ig = await api('/setup/ig'); if (!ig.loggedIn) return { ok: false, text: ig.browser ? 'Log in to Instagram in the Reelkit browser first.' : 'Open the Reelkit browser and log in to Instagram first (Settings, or the Posting step).' };
  const job = await api('/refs/find', { keywords, max: 10, autoSave });
  return new Promise(done => { let busy = false; const t = setInterval(async () => { if (busy) return; busy = true; let j = null; try { j = await api('/job/' + job.id); } catch {} busy = false; if (!j) return; onTick && onTick(j);
    if (j.status === 'done') { clearInterval(t); const r = j.result; done({ ok: !!r?.added, text: r ? (r.added ? `Added ${r.added} reel${r.added > 1 ? 's' : ''}${r.saved ? `, saved the top ${r.saved}` : ''}${r.estimated ? `. ${r.estimated} had no visible view count, so their views are estimated from likes` : ''}` : 'Claude found no reels it could use' + (r.note ? '. ' + r.note : '')) : (j.log || []).slice(-1)[0] || 'Done' }); } else if (j.status === 'failed') { clearInterval(t); done({ ok: false, text: j.error || 'Failed' }); } }, 2000); S.timers.push(t); });
}
async function suggestKeywords() { const { brand: b } = await api('/brand'); let tags = []; try { const r = await api('/research'); tags = (r.research?.data?.competitors?.hashtags || []).map(h => h.replace(/^#/, '')); } catch {} return [...new Set([b.niche, ...tags].map(x => (x || '').trim()).filter(Boolean))].slice(0, 3).join(', '); }

/** Global "Running tasks" box (top left): every background task, live, with the model in use and a Cancel button. */
const TaskTray = (() => {
  let timer = null, lastKey = '', tasks = []; const open = new Set(), dismissed = new Set();
  const host = () => document.getElementById('tasks');
  const el = (t, n) => (t.status === 'queued' ? ic('clock', 18) : t.status === 'running' ? '<span class="spinner"></span>' : t.status === 'waiting' ? ic('bell', 18) : t.status === 'done' ? ic('check', 18) : t.status === 'failed' ? ic('x', 18) : ic('x', 16));
  const mmss2 = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const waitText = t => { const w = t.queue?.waitingOn; const N = { research: 'the research', autofill: 'reading your website', install: 'an install', 'browser-test': 'the browser test', 'find-refs': 'another search', post: 'a post', analyze: 'analytics' }; return w ? `Waiting for ${N[w.type] || 'another task'} to finish` : 'Starting…'; };
  const line = t => (t.status === 'queued' ? waitText(t) : t.status === 'waiting' ? (t.waiting || 'Needs you') : t.status === 'done' ? 'Finished' : t.status === 'cancelled' ? 'Cancelled' : t.status === 'failed' ? 'Stopped' : (t.cancelling ? 'Cancelling…' : t.line || 'Working…'));
  function render() {
    const h = host(); if (!h) return; const list = tasks.filter(t => !dismissed.has(t.id)); const key = JSON.stringify(list.map(t => [t.id, t.status, t.line, t.model, t.attempts, t.cancelling, Math.round((t.progress || 0) * 20), open.has(t.id), t.error]));
    if (key === lastKey) return; lastKey = key;
    h.innerHTML = list.map(t => `<div class="tk ${t.status}" data-id="${esc(t.id)}" data-kind="${t.kind}"><div class="tr"><span class="ico">${el(t)}</span><div class="grow" style="min-width:0"><b>${esc(t.title)}</b><div class="tl1">${esc(line(t))}</div></div>
      ${t.cancellable ? `<button class="btn-i alt" data-act="cancel" aria-label="Cancel">${ic('x', 15)}</button>` : ['done', 'failed', 'cancelled'].includes(t.status) ? `<button class="btn-i alt" data-act="dismiss" aria-label="Dismiss">${ic('x', 15)}</button>` : ''}
      ${t.lines?.length ? `<button class="btn-i alt" data-act="more" aria-label="Details" style="transform:rotate(${open.has(t.id) ? 90 : 0}deg)">${ic('chevron', 15)}</button>` : ''}</div>
      ${['running', 'queued'].includes(t.status) ? `<div class="meta">${t.model ? `<span class="chip">${esc(t.model)}${t.attempts > 1 ? ' · try ' + t.attempts : ''}</span>` : ''}<span class="tk-time" data-s="${esc(t.started || '')}"></span></div>` : ''}
      ${t.progress > 0 && t.status === 'running' ? `<div class="bar"><i style="width:${Math.round(t.progress * 100)}%"></i></div>` : ''}
      ${t.error ? `<div class="err">${esc(String(t.error).slice(0, 220))}</div>` : ''}
      ${open.has(t.id) ? `<div class="logbox">${esc(t.lines.join('\n'))}</div>` : ''}</div>`).join('');
    h.querySelectorAll('.tk').forEach(card => { const id = card.dataset.id, kind = card.dataset.kind;
      card.querySelectorAll('[data-act]').forEach(b => (b.onclick = async () => { const a = b.dataset.act;
        if (a === 'more') { open.has(id) ? open.delete(id) : open.add(id); lastKey = ''; render(); }
        else if (a === 'dismiss') { dismissed.add(id); lastKey = ''; render(); }
        else if (a === 'cancel') { b.disabled = true; try { await api(kind === 'run' ? '/run/cancel' : '/jobs/cancel', { id }); } catch (e) { toast(e.message); } tick(true); } })); });
    tickTimes();
  }
  const tickTimes = () => document.querySelectorAll('.tk-time').forEach(e => { const s = Date.parse(e.dataset.s); e.textContent = s ? mmss2(Date.now() - s) : ''; });
  async function tick(now) {
    clearTimeout(timer); let busy = false;
    if (!document.hidden || now) { try { const r = await fetch('/api/tasks').then(x => x.json()); tasks = r.tasks || []; render(); busy = tasks.some(t => ['queued', 'running', 'waiting'].includes(t.status)); } catch {} }
    timer = setTimeout(tick, busy ? 1500 : 5000);
  }
  return { start() { tick(true); setInterval(tickTimes, 1000); document.addEventListener('visibilitychange', () => !document.hidden && tick(true)); }, refresh: () => tick(true) };
})();
