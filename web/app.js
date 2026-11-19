'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = async (p, body) => { const r = await fetch('/api' + p, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (j.error) throw new Error(j.error); return j; };
const toast = m => { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => (t.style.display = 'none'), 2600); };
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const fmt = n => (n == null ? '–' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n.toLocaleString());
const S = { state: null, slug: localStorage.getItem('rk.slug') || '', style: localStorage.getItem('rk.style') || 'aurora-dark', timers: [] };
const TABS = [['today', '★', 'Today'], ['swipe', '01', 'Swipe'], ['script', '02', 'Script'], ['produce', '03', 'Produce'], ['post', '04', 'Post'], ['analyze', '05', 'Analyze'], ['repurpose', '06', 'Repurpose'], ['footage', '🎬', 'Footage'], ['leads', '💬', 'Leads'], ['research', '🔎', 'Research'], ['claude', '🧠', 'Claude'], ['setup', '⚙', 'Setup'], ['guide', '?', 'Guide']];
const stop = () => { S.timers.forEach(clearInterval); S.timers = []; };
const reels = () => S.state?.reels || [];
const cur = () => reels().find(r => r.slug === S.slug) || reels()[0];
async function refresh() { S.state = await api('/state'); if (!S.slug && reels()[0]) S.slug = reels()[0].slug; }
function reelPicker(id = 'pick') { return `<select id="${id}">${reels().map(r => `<option value="${esc(r.slug)}" ${r.slug === (cur() || {}).slug ? 'selected' : ''}>${esc(r.title)}</option>`).join('') || '<option>(no reels yet)</option>'}</select>`; }
function bindPicker(fn, id = 'pick') { const e = $('#' + id); if (e) e.onchange = () => { S.slug = e.value; localStorage.setItem('rk.slug', S.slug); fn(); }; }
function newReelBtn(fn) { return `<button class="alt" id="newreel">+ New reel</button>`; }
function bindNew(fn) { const b = $('#newreel'); if (b) b.onclick = async () => { const t = prompt('Reel title'); if (!t) return; const r = await api('/reel', { title: t }); S.slug = r.slug; await refresh(); fn(); }; }

async function route() {
  stop(); const h = (location.hash || '#today').slice(1);
  $('#nav').innerHTML = TABS.map(([k, n, l]) => `<a href="#${k}" class="${k === h ? 'on' : ''}"><b>${n}</b>${l}</a>`).join('');
  try { await refresh(); await ({ today, swipe, script, produce, post, analyze, repurpose, footage, leads, research, claude, setup, guide }[h] || today)(); } catch (e) { $('#main').innerHTML = `<div class="card bad">${esc(e.message)}</div>`; }
}
addEventListener('hashchange', route);


// ---------------------------------------------------------------- shared: style gallery
const MOODS = ['all', 'calm', 'bold', 'playful', 'techy', 'serious', 'friendly', 'luxury', 'energetic'];
function styleGallery(host, selected, onPick, { auto = false } = {}) {
  let mood = 'all', tone = 'all'; const styles = S.state.styles;
  const draw = () => {
    const list = styles.filter(s => (mood === 'all' || s.tags?.mood?.includes(mood)) && (tone === 'all' || s.tags?.tone === tone));
    host.innerHTML = `<div class="row" style="margin-bottom:10px">${MOODS.map(m => `<button class="alt ${m === mood ? 'on' : ''}" data-m="${m}" style="padding:5px 12px;font-size:13px">${m}</button>`).join('')}<span class="grow"></span>${['all', 'light', 'dark'].map(t => `<button class="alt" data-t="${t}" style="padding:5px 12px;font-size:13px;${t === tone ? 'outline:2px solid var(--ac)' : ''}">${t}</button>`).join('')}</div>
    <div class="sgrid">${auto ? `<div class="sc2 ${selected === 'auto' ? 'sel' : ''}" data-s="auto"><div class="autoimg">✨</div><b>Auto</b><span class="mut">Claude picks per reel from the best-fitting styles, avoiding repeats</span></div>` : ''}
    ${list.map(s => `<div class="sc2 ${s.name === selected ? 'sel' : ''}" data-s="${esc(s.name)}"><img loading="lazy" src="/styles/previews/${esc(s.name)}.jpg" alt=""><b>${esc(s.name)}</b><span class="mut">${esc(s.desc)}</span><span class="mut" style="font-size:11px">${esc((s.tags?.mood || []).join(' · '))}${s.tags ? ' · energy ' + s.tags.energy : ''}</span></div>`).join('')}</div>`;
    host.querySelectorAll('[data-m]').forEach(b => (b.onclick = () => { mood = b.dataset.m; draw(); })); host.querySelectorAll('[data-t]').forEach(b => (b.onclick = () => { tone = b.dataset.t; draw(); }));
    host.querySelectorAll('[data-s]').forEach(c => (c.onclick = () => { selected = c.dataset.s; onPick(selected); draw(); }));
  }; draw();
}

// ---------------------------------------------------------------- 01 Swipe
async function swipe() {
  const items = (await api('/swipe')).items; const fresh = items.filter(i => i.status === 'new'); const saved = items.filter(i => i.status === 'saved');
  const niches = [...new Set(items.map(i => i.niche))];
  $('#main').innerHTML = `<h2>Swipe</h2><p class="sub">Reels beating their own baseline. Save the best, then script from them. ← skip · → save</p>
  <div class="swipe" id="stack">${fresh.length ? '' : '<div class="card">No new reels. Add some below, or run discovery on competitor accounts.</div>'}</div>
  <div class="acts"><button class="alt" id="no">✕</button><button class="alt" id="undo">↶</button><button id="yes">♥</button></div>
  <div class="card" style="margin-top:16px"><div class="row"><b class="grow">Saved (${saved.length})</b><select id="nf" style="width:auto"><option value="">all niches</option>${niches.map(n => `<option>${esc(n)}</option>`).join('')}</select></div>
  ${saved.map(i => `<div class="row" style="margin-top:10px"><span class="chip">${i.multiplier}×</span><div class="grow"><b>${esc(i.creator)}</b> · ${esc(i.viewsLabel)} views<br><span class="mut">${esc(i.caption.slice(0, 110))}</span></div>${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer" class="chip">open</a>` : ''}</div>`).join('') || '<p class="mut">Nothing saved yet.</p>'}</div>
  <div class="split"><div class="card"><b>Add a reel manually</b><label>Link</label><input id="a_url"><label>Creator</label><input id="a_c"><div class="split"><div><label>Views</label><input id="a_v" type="number"></div><div><label>Baseline (their followers or typical views)</label><input id="a_b" type="number"></div></div><label>Caption / hook</label><input id="a_cap"><label>Niche</label><input id="a_n" value="${esc(niches[0] || 'SaaS founders')}"><p><button id="a_go">Add</button></p></div>
  <div class="card"><b>Discover competitors (official API)</b><p class="mut">Business/Creator accounts only. Needs a connected Instagram account (Setup).</p><label>Usernames, comma separated</label><input id="d_u" placeholder="creator1, creator2"><label>Niche tag</label><input id="d_n" value="${esc(niches[0] || 'SaaS founders')}"><p><button id="d_go">Discover</button></p></div></div>`;
  let i = 0; const hist = [];
  const draw = () => { const it = fresh[i]; const st = $('#stack'); if (!it) { if (fresh.length) st.innerHTML = '<div class="card">All caught up.</div>'; return; }
    st.innerHTML = `<div class="sc" id="top">${it.thumb ? `<img src="${esc(it.thumb)}" alt="" referrerpolicy="no-referrer">` : ''}<span class="mult">${it.multiplier ? it.multiplier + '×' : 'new'}</span><div class="big">${esc(it.viewsLabel)}</div><div class="mut">views · @${esc(it.creator)}</div><p>${esc(it.caption.slice(0, 160))}</p></div>`;
    let x0 = null; const top = $('#top'); top.ontouchstart = e => (x0 = e.touches[0].clientX); top.ontouchend = e => { const dx = e.changedTouches[0].clientX - x0; if (dx > 70) go('saved'); else if (dx < -70) go('skipped'); }; };
  const go = async st => { const it = fresh[i]; if (!it) return; await api('/swipe/decide', { id: it.id, status: st }); hist.push([it, st]); i++; draw(); if (st === 'saved') toast('Saved'); };
  $('#yes').onclick = () => go('saved'); $('#no').onclick = () => go('skipped'); $('#undo').onclick = async () => { const h = hist.pop(); if (!h) return; await api('/swipe/decide', { id: h[0].id, status: 'new' }); i--; draw(); };
  document.onkeydown = e => { if (e.key === 'ArrowRight') go('saved'); if (e.key === 'ArrowLeft') go('skipped'); };
  draw();
  $('#a_go').onclick = async () => { await api('/swipe/add', { url: $('#a_url').value, creator: $('#a_c').value, views: $('#a_v').value, baseline: $('#a_b').value, caption: $('#a_cap').value, niche: $('#a_n').value }); toast('Added'); swipe(); };
  $('#d_go').onclick = async () => { try { const r = await api('/swipe/discover', { usernames: $('#d_u').value.split(',').map(s => s.trim()).filter(Boolean), niche: $('#d_n').value }); toast(`Found ${r.added} reels`); swipe(); } catch (e) { toast(e.message); } };
}

// ---------------------------------------------------------------- 02 Script
async function script() {
  const r0 = cur();
  $('#main').innerHTML = `<h2>Script</h2><p class="sub">One line per beat. First line is the hook, last is the call to action. <span id="saved" class="mut"></span></p>
  <div class="row card">${reelPicker()}${newReelBtn()}</div>${r0 ? `<div class="split"><div><textarea id="ed" spellcheck="false"></textarea>
  <p class="mut">Visuals: <code>{counter: 9851 | paying users | +64%}</code> <code>{bars: A=10&gt;40, B=5&gt;20 | title | %}</code> <code>{chart: up}</code> <code>{tier: S=A; B=C,D}</code> <code>{code: npm i x}</code> <code>{list: a; b; c}</code> <code>{big: 3x}</code> <code>{screen: https://…}</code> · key word: <code>*word*</code></p></div><div id="view"></div></div>` : '<div class="card">Create a reel to begin.</div>'}`;
  bindPicker(script); bindNew(script); if (!r0) return;
  const v = await api('/script/' + r0.slug); $('#ed').value = v.text; paint(v);
  let t; $('#ed').oninput = () => { $('#saved').textContent = 'Editing…'; clearTimeout(t); t = setTimeout(async () => { const v = await api('/script/' + r0.slug, { text: $('#ed').value }); paint(v); $('#saved').textContent = 'Saved'; }, 600); };
  function paint(v) { $('#view').innerHTML = `<div class="card"><div class="row"><b class="grow">Runtime</b><span class="chip">${mmss(v.runtime)}</span><span class="chip">lint ${v.lint.score}</span></div>
    ${v.lines.map(l => `<div class="row" style="margin:8px 0;align-items:flex-start"><span class="chip ${l.role}">${l.role === 'cta' ? 'Comment' : l.role === 'hook' ? 'Hook' : 'Line'}</span><span class="grow">${esc(l.text)}</span>${l.visual ? `<span class="chip vis">${esc(l.visual)}</span>` : ''}</div>`).join('')}</div>
    <div class="card"><b>Checks</b>${v.lint.checks.map(c => `<div class="lintli"><span class="${c.pass ? 'ok' : 'bad'}">${c.pass ? '✔' : '✘'}</span><span>${esc(c.msg)}</span></div>`).join('')}</div>`; }
}

// ---------------------------------------------------------------- 03 Produce
async function produce() {
  const r = cur(); const files = r ? await fileOk(r.slug) : {};
  $('#main').innerHTML = `<h2>Produce</h2><p class="sub">Voice, motion graphics, captions, render. Interrupted renders resume from saved scenes.</p>
  <div class="row card">${reelPicker()}${newReelBtn()}</div>${r ? `
  <div class="card"><b>Style</b> <span class="mut">(${S.state.styles.length} + auto)</span><div id="sg" style="margin-top:10px"></div></div>
  <div class="split"><div class="card"><div class="split"><div><label>Voice</label><select id="voice"><option value="auto">auto (${esc(S.state.provider)})</option><option>elevenlabs</option><option>edge</option><option>sapi</option><option>say</option><option>espeak</option><option>silent</option></select></div><div><label>Language</label><select id="lang">${['en', 'es', 'fr', 'it', 'pt', 'de', 'ja', 'ko', 'zh', 'hi', 'ru', 'uk', 'he', 'ar', 'el', 'tr'].map(l => `<option ${((r.lang || 'en') === l) ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
  <p class="row"><label style="margin:0"><input type="checkbox" id="draft" style="width:auto"> fast draft</label><span class="grow"></span><button id="go">Render</button></p><div id="jobs"></div></div>
  <div class="card" id="player">${files.reel ? `<video controls playsinline src="/file/${r.slug}/reel.mp4?${r.rendered || ''}"></video>` : files.draft ? `<video controls playsinline src="/file/${r.slug}/draft.mp4"></video>` : '<p class="mut">No render yet.</p>'}<div id="vir"></div></div></div>` : ''}`;
  bindPicker(produce); bindNew(produce); if (!r) return;
  styleGallery($('#sg'), S.style, v => { S.style = v; localStorage.setItem('rk.style', v); }, { auto: true });
  $('#go').onclick = async () => { await api('/render', { slug: r.slug, style: S.style === 'auto' ? undefined : S.style, voice: $('#voice').value, lang: $('#lang').value, draft: $('#draft').checked }); toast('Queued'); poll(); };
  const v = await api('/script/' + r.slug); vir(v.virality);
  function vir(x) { const W = 320, H = 110, tot = x.duration || 1; const pts = x.curve.map(p => `${(p.at / tot) * W},${H - (p.pct / 100) * H}`).join(' ');
    $('#vir').innerHTML = `<h3 style="margin:14px 0 6px">Virality Brain <span class="chip">${x.score}/100</span></h3><svg viewBox="0 0 ${W} ${H}" width="100%" style="background:var(--panel2);border-radius:10px"><polyline points="${pts}" fill="none" stroke="var(--ac)" stroke-width="3"/></svg>
    <p class="mut">Estimated retention · avg watch ${x.avgWatchSeconds}s · skip rate ${x.estSkipRate}%. <i>Heuristic estimate, not a trained model.</i></p>${x.fixes.map(f => `<div class="lintli"><span class="bad">${f.at != null ? mmss(f.at) : '•'}</span><span>${esc(f.fix)}</span></div>`).join('') || '<p class="ok">No fixes needed.</p>'}`; }
  async function poll() { const render = async () => { await refresh(); const js = S.state.jobs.filter(j => j.type === 'render' && j.payload.slug === r.slug).slice(0, 2);
      $('#jobs').innerHTML = js.map(j => `<div style="margin:8px 0"><span class="chip">${esc(j.status)}</span> ${esc(j.stage || '')}<div class="bar"><i style="width:${Math.round(j.progress * 100)}%"></i></div>${j.error ? `<div class="bad">${esc(j.error)}</div>` : ''}</div>`).join('');
      if (js[0]?.status === 'done' && js[0].finished > (S.lastDone || '')) { S.lastDone = js[0].finished; $('#player').querySelector('video')?.remove(); $('#player').insertAdjacentHTML('afterbegin', `<video controls playsinline src="/file/${r.slug}/${js[0].payload.draft ? 'draft' : 'reel'}.mp4?${Date.now()}"></video>`); } };
    await render(); S.timers.push(setInterval(render, 1500)); }
  poll();
}
async function fileOk(slug) { return api('/has/' + slug); }

// ---------------------------------------------------------------- 04 Post
async function post() {
  const rs = reels(); const sel = cur(); const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = [...Array(7)].map((_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return d; });
  $('#main').innerHTML = `<h2>Post</h2><p class="sub">Schedule to your feed or as trial reels. Posts go out while this dashboard (or <code>reelkit worker</code>) is running.</p>
  <div class="cal">${days.map((d, i) => { const items = rs.filter(r => r.scheduledAt && new Date(r.scheduledAt).toDateString() === d.toDateString() || r.postedAt && new Date(r.postedAt).toDateString() === d.toDateString());
    return `<div class="day ${i === 0 ? 'today' : ''}"><b>${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</b>${items.map(r => `<div class="post ${r.status}">${esc(r.title)}<br><span class="mut">${new Date(r.postedAt || r.scheduledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${esc(r.status)}${r.trial ? ' · trial' : ''}</span></div>`).join('')}</div>`; }).join('')}</div>
  <div class="card" style="margin-top:14px"><div class="row">${reelPicker()}</div>${sel ? `<label>Caption</label><textarea id="cap" style="min-height:90px">${esc(sel.caption || sel.title)}</textarea><div class="split"><div><label>When</label><input id="at" type="datetime-local" value="${sel.scheduledAt ? new Date(new Date(sel.scheduledAt) - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : ''}"></div><div><label>Account</label><select id="acct">${S.state.accounts.map(a => `<option>${esc(a.name)}</option>`).join('') || '<option value="">(connect in Setup)</option>'}</select></div></div>
  <p><label style="margin:0"><input type="checkbox" id="trial" style="width:auto" ${sel.trial ? 'checked' : ''}> post as a trial reel (shown to non-followers first)</label></p><div class="row"><button id="sch">Schedule</button><button class="alt" id="now">Post now</button>${sel.status === 'scheduled' ? '<button class="alt" id="uns">Unschedule</button>' : ''}</div>` : ''}</div>`;
  bindPicker(post); if (!sel) return;
  const body = () => ({ slug: sel.slug, caption: $('#cap').value, account: $('#acct').value || undefined, trial: $('#trial').checked });
  $('#sch').onclick = async () => { if (!$('#at').value) return toast('Pick a time'); await api('/schedule', { ...body(), at: $('#at').value }); toast('Scheduled'); post(); };
  $('#now').onclick = async () => { if (confirm('Publish this reel to Instagram now? This is public.')) { await api('/post-now', body()); toast('Posting…'); } };
  const u = $('#uns'); if (u) u.onclick = async () => { await api('/unschedule', { slug: sel.slug }); post(); };
}

// ---------------------------------------------------------------- 05 Analyze
async function analyze() {
  $('#main').innerHTML = '<h2>Analyze</h2><p class="sub">Loading…</p>'; const a = await api('/analytics');
  const rk = a.rank, pct = rk.next ? Math.min(100, ((rk.total) / rk.next.at) * 100) : 100; const ac = a.account;
  const spark = c => { if (!c.length) return ''; const mx = Math.max(...c.map(p => p.views), 1), mxa = Math.max(...c.map(p => p.age), 1); return `<svg viewBox="0 0 90 26" width="90"><polyline fill="none" stroke="var(--ac)" stroke-width="2" points="${c.map(p => `${(p.age / mxa) * 88 + 1},${25 - (p.views / mx) * 23}`).join(' ')}"/></svg>`; };
  const f = ac?.reachByFollowType?.follower, nf = ac?.reachByFollowType?.non_follower; const tot = (f || 0) + (nf || 0);
  $('#main').innerHTML = `<h2>Analyze</h2><p class="sub">What every reel did, with day 1 / 3 / 7 curves.</p>
  <div class="split"><div class="card"><div class="mut">Total views via Reelkit</div><div class="big">${fmt(a.totalViews)}</div><p><b>${esc(rk.name)}</b>${rk.next ? ` → ${esc(rk.next.name)} at ${fmt(rk.next.at)}` : ' (top rank)'}</p><div class="bar"><i style="width:${pct}%"></i></div></div>
  <div class="card"><b>Who's watching</b>${ac && !ac.error ? `<p class="mut">@${esc(ac.username)} · ${fmt(ac.followers_count)} followers · reach ${fmt(ac.reach)} (28d)</p>${tot ? `<div class="bar"><i style="width:${(f / tot) * 100}%"></i></div><p class="mut">${Math.round((f / tot) * 100)}% followers · ${Math.round((nf / tot) * 100)}% non-followers</p>` : '<p class="mut">No breakdown returned.</p>'}` : `<p class="mut">${esc(ac?.error || 'Connect Instagram in Setup.')}</p>`}</div></div>
  <div class="card tw"><table><tr><th>Reel</th><th>Views</th><th>Likes</th><th>Saves</th><th>Shares</th><th>D1</th><th>D3</th><th>D7</th><th></th></tr>${a.reels.map(r => `<tr><td>${r.winner ? '<span class="chip" style="background:#f9731622;color:#fb923c">Winner</span> ' : ''}${esc(r.title)}</td><td>${fmt(r.views)}</td><td>${fmt(r.likes)}</td><td>${fmt(r.saves)}</td><td>${fmt(r.shares)}</td><td>${fmt(r.d1)}</td><td>${fmt(r.d3)}</td><td>${fmt(r.d7)}</td><td>${spark(r.curve)}</td></tr>`).join('') || '<tr><td colspan="9" class="mut">No posted reels yet.</td></tr>'}</table><p><button class="alt" id="an">Refresh insights now</button></p></div>
  <div class="card"><b>Calibration</b><p class="mut">${a.calibration.ready ? esc(a.calibration.note) : esc(a.calibration.note)}</p>${a.calibration.ready ? `<p>Overall rank-correlation of the Virality score with your views: <b>${a.calibration.overallRho}</b> (n=${a.calibration.n})</p><table>${a.calibration.perCheck.map(c => `<tr><td>${esc(c.id)}</td><td>${c.rho ?? '–'}</td></tr>`).join('')}</table>` : ''}</div>`;
  $('#an').onclick = async () => { await api('/analyze', {}); toast('Queued'); };
}

// ---------------------------------------------------------------- 06 Repurpose
async function repurpose() {
  const a = await api('/analytics'); const winners = a.reels.filter(r => r.winner); const sel = cur();
  $('#main').innerHTML = `<h2>Repurpose</h2><p class="sub">Spin winners into new hooks and carousels.</p>
  <div class="card"><b>Winners</b>${winners.map(w => `<div class="row" style="margin:8px 0"><span class="chip" style="background:#f9731622;color:#fb923c">Winner</span><span class="grow">${esc(w.title)}</span><span class="mut">${fmt(w.views)} views · ${w.vsMedian}× median</span><button class="alt" data-w="${esc(w.slug)}">Pick</button></div>`).join('') || '<p class="mut">Winners appear once you have posted reels with views. You can still repurpose any reel below.</p>'}</div>
  <div class="card"><div class="row">${reelPicker()}<button id="go">Make carousel + brief</button></div>
  ${sel?.carousel ? `<div class="slides" style="margin-top:12px">${sel.carousel.map(f => `<img src="/file/${esc(sel.slug)}/carousel/${esc(f)}?${Date.now()}" alt="">`).join('')}</div>` : ''}
  <h3>New hooks from the winner</h3>${(sel?.hooks || []).map(h => `<div class="lintli">✨ <span>${esc(h)}</span></div>`).join('') || '<p class="mut">Ask Claude: <i>“repurpose ' + esc(sel?.title || 'this reel') + '”</i>. The skill reads the brief and saves hooks here.</p>'}
  <div class="row"><input id="hk" placeholder="Add a hook manually" class="grow"><button class="alt" id="addh">Add</button></div></div>`;
  bindPicker(repurpose); document.querySelectorAll('[data-w]').forEach(b => (b.onclick = () => { S.slug = b.dataset.w; localStorage.setItem('rk.slug', S.slug); repurpose(); }));
  $('#go').onclick = async () => { $('#go').disabled = true; try { await api('/repurpose', { slug: sel.slug, style: S.style }); await refresh(); repurpose(); } catch (e) { toast(e.message); $('#go').disabled = false; } };
  $('#addh').onclick = async () => { if ($('#hk').value) { await api('/hooks', { slug: sel.slug, hook: $('#hk').value }); await refresh(); repurpose(); } };
}


// ---------------------------------------------------------------- Today
const STEPICON = { done: '✔', running: '…', waiting: '⏸', failed: '✘', pending: '·', skipped: '–' };
async function today() {
  const t = await api('/today'); const gd = await api('/guide'); const next = gd.steps.filter(x => !x.done && x.id !== 'chat').slice(0, 2); const run = t.runs.find(r => ['queued', 'running', 'waiting'].includes(r.status)) || t.runs[0];
  const u = t.usage;
  $('#main').innerHTML = `<h2>Today</h2><p class="sub">One click makes a reel from your references and posts it. Claude is used only where code can't do the job.</p>
  ${next.length ? `<div class="card" style="border-color:var(--ac)"><b>Start here</b> <span class="mut">(${gd.doneCount}/${gd.steps.length} done)</span>${next.map(x => `<div class="lintli"><span class="bad">○</span><span><b>${esc(x.title)}</b> <a href="${esc(x.link)}">open</a></span></div>`).join('')}<a href="#guide">Full guide</a></div>` : ''}
  ${t.brandMissing.length ? `<div class="card" style="border-color:var(--ac)"><b>Set up your brand first</b><p class="mut">Missing: ${esc(t.brandMissing.join(', '))}. <a href="#setup">Open Setup</a></p></div>` : ''}
  ${!t.claude ? `<div class="card" style="border-color:var(--bad)"><b>Claude Code isn't installed</b><p class="mut">Install it (<code>npm i -g @anthropic-ai/claude-code</code>) and run <code>claude</code> once to sign in.</p></div>` : ''}
  <div class="card"><div class="row"><div class="grow"><b style="font-size:20px">Make &amp; Post</b><div class="mut">references → idea → script → render → caption → post</div></div>
  <select id="postmode" style="width:auto"><option value="review" ${t.posting.mode === 'review' ? 'selected' : ''}>review before sharing</option><option value="auto" ${t.posting.mode === 'auto' ? 'selected' : ''}>post automatically</option><option value="none" ${t.posting.mode === 'none' ? 'selected' : ''}>render only</option></select>
  <button id="go" style="font-size:18px;padding:14px 26px" ${run && ['queued', 'running', 'waiting'].includes(run.status) ? 'disabled' : ''}>▶ Make &amp; Post</button></div>
  <p class="mut" style="margin:10px 0 0">Mode <b>${esc(t.mode)}</b> · today ${u.calls} Claude calls (${u.cacheHits} free from cache) · ${u.by.haiku?.calls || 0} haiku · ${u.by.sonnet?.calls || 0} sonnet · ${u.by.opus?.calls || 0} opus. <a href="#claude">Control models</a></p></div>
  ${run ? `<div class="card"><div class="row"><b class="grow">Run ${esc(run.id)} <span class="chip">${esc(run.status)}</span></b>${['queued', 'running', 'waiting'].includes(run.status) ? '<button class="alt" id="cancel">Cancel</button>' : ''}</div>
    ${run.steps.map(s => `<div class="lintli"><span class="${s.status === 'done' ? 'ok' : s.status === 'failed' ? 'bad' : 'mut'}" style="width:18px">${STEPICON[s.status]}</span><b style="width:120px">${esc(s.name)}</b><span class="mut grow">${esc(s.detail || '')}</span></div>`).join('')}
    ${run.error ? `<p class="bad">${esc(run.error)}</p>` : ''}${run.ctx?.slug && run.status === 'done' ? `<video controls playsinline src="/file/${esc(run.ctx.slug)}/reel.mp4" style="margin-top:10px"></video>` : ''}</div>` : ''}
  ${t.inbox.map(inboxCard(t)).join('')}
  <div class="card"><div class="row"><b class="grow">Idea queue</b><button class="alt" id="genideas">Generate 5 ideas</button></div>
  ${t.ideas.map(i => `<div class="row" style="margin:8px 0"><span class="chip ${i.status === 'approved' ? 'cta' : ''}">${esc(i.status)}</span><div class="grow"><b>${esc(i.hook)}</b><br><span class="mut">${esc(i.payoff)}</span></div><button class="alt" data-run="${esc(i.id)}">Make this</button></div>`).join('') || `<p class="mut">No ideas yet. ${t.refs} references saved.</p>`}</div>`;
  $('#postmode').onchange = async e => { await api('/brand', { posting: { mode: e.target.value } }); };
  $('#go').onclick = async () => { await api('/run', { post: $('#postmode').value }); toast('Started'); today(); };
  const c = $('#cancel'); if (c) c.onclick = async () => { await api('/run/cancel', { id: run.id }); today(); };
  $('#genideas').onclick = async e => { e.target.disabled = true; e.target.textContent = 'Thinking…'; try { const r = await api('/ideas', { generate: true }); toast(`${r.added} new ideas`); } catch (er) { toast(er.message); } today(); };
  document.querySelectorAll('[data-run]').forEach(b => (b.onclick = async () => { const i = t.ideas.find(x => x.id === b.dataset.run); await api('/run', { post: $('#postmode').value, idea: i }); today(); }));
  bindInbox(t);
  if (run && ['queued', 'running'].includes(run.status)) S.timers.push(setInterval(today, 2500));
}
function inboxCard(t) {
  return it => {
    const base = `<div class="card" data-inbox="${esc(it.id)}"><div class="row"><b class="grow">${esc(it.title)}</b><span class="chip">${esc(it.type)}</span></div><p class="mut" style="white-space:pre-wrap">${esc(it.body)}</p>`;
    if (it.type === 'checkin' || it.type === 'ask-references') return base + `<label>Paste reference reels (one per line: url | views | account size | caption)</label><textarea class="ref" style="min-height:90px" placeholder="https://instagram.com/.../reel/... | 2.4M | 170K | their hook"></textarea>${it.type === 'checkin' ? '<label>Anything to focus on today? (launch, offer, topic)</label><input class="focus">' : ''}<p class="row"><button data-act="submit">Save</button>${it.type === 'ask-references' ? '<button class="alt" data-act="skip">Skip references</button>' : ''}<button class="alt" data-act="dismiss">Dismiss</button></p></div>`;
    if (it.type === 'approve-ideas') { const ideas = (it.payload.ids || []).map(id => t.ideas.find(i => i.id === id)).filter(Boolean); return base + ideas.map(i => `<label style="text-transform:none;font-size:14px;color:var(--fg)"><input type="checkbox" class="idea" value="${esc(i.id)}" checked style="width:auto"> ${esc(i.hook)} <span class="mut">${esc(i.payoff)}</span></label>`).join('') + `<p class="row"><button data-act="ideas">Approve selected</button><button class="alt" data-act="dismiss">Dismiss</button></p></div>`; }
    if (it.type === 'review-post') return base + `<video controls playsinline src="/file/${esc(it.payload.slug)}/reel.mp4" style="max-width:240px"></video><p class="mut">${it.payload.method === 'computer' ? 'Claude has filled in the post in the Reelkit browser window and stopped before Share.' : ''}</p><p class="row"><button data-act="share">Share it</button><button class="alt" data-act="manual">I shared it myself</button><button class="alt" data-act="cancel">Cancel</button></p></div>`;
    if (it.type === 'need-login') return base + `<p class="row"><button data-act="browser">Open Reelkit browser</button><button class="alt" data-act="resume">I'm logged in, continue</button></p></div>`;
    if (it.type === 'need-brand') return base + `<p><a class="btn" href="#setup">Open Setup</a></p></div>`;
    return base + `<p><button class="alt" data-act="dismiss">Dismiss</button></p></div>`;
  };
}
function bindInbox() {
  document.querySelectorAll('[data-inbox]').forEach(card => {
    const id = card.dataset.inbox; card.querySelectorAll('[data-act]').forEach(b => (b.onclick = async () => {
      const act = b.dataset.act; const ans = {};
      if (act === 'dismiss') { await api('/inbox/dismiss', { id }); return today(); }
      if (act === 'browser') { await api('/browser', {}); return toast('Browser opened'); }
      if (act === 'submit') { ans.text = card.querySelector('.ref')?.value || ''; ans.focus = card.querySelector('.focus')?.value || ''; }
      if (act === 'skip') ans.skip = true; if (act === 'ideas') ans.approved = [...card.querySelectorAll('.idea:checked')].map(x => x.value);
      if (act === 'share' || act === 'cancel') ans.action = act; if (act === 'manual') ans.action = 'manual-done'; if (act === 'resume') ans.resumed = true;
      await api('/inbox/answer', { id, answer: ans }); toast('Saved'); today();
    }));
  });
}

// ---------------------------------------------------------------- Footage
async function footage() {
  $('#main').innerHTML = `<h2>Footage</h2><p class="sub">Your own talking-head video: removes um/uh, "you know", stutters and dead air, cleans the audio, adds captions in your style. All local.</p>
  <div class="card"><div class="split"><div><label>Video file</label><input type="file" id="ff" accept="video/*"></div><div><label>Cut level</label><select id="lvl"><option value="light">light: um, uh, er only</option><option value="standard" selected>standard: + you know, I mean, stutters</option><option value="aggressive">aggressive: + basically, literally, actually</option></select></div></div>
  <p class="row"><button id="an">Transcribe &amp; find fillers</button><span id="msg" class="mut"></span></p></div><div id="plan"></div>`;
  let file = S.footageFile || ''; const msg = t => ($('#msg').textContent = t);
  $('#an').onclick = async () => {
    const f = $('#ff').files[0]; if (!f && !file) return toast('Choose a video'); $('#an').disabled = true;
    if (f) { msg('Uploading…'); const r = await fetch('/api/footage/upload?name=' + encodeURIComponent(f.name), { method: 'POST', body: f }); file = (await r.json()).file; S.footageFile = file; }
    msg('Transcribing… (the first run downloads a speech model)'); await api('/footage/analyze', { file, level: $('#lvl').value });
    const poll = setInterval(async () => { const r = await fetch('/api/footage/plan?file=' + encodeURIComponent(file)); const pl = r.ok ? await r.json() : { pending: true }; if (!pl.pending) { clearInterval(poll); msg(''); $('#an').disabled = false; showPlan(pl); } else { await refresh(); const j = S.state.jobs.find(x => x.type === 'footage-analyze'); if (j?.status === 'failed') { clearInterval(poll); msg(j.error); $('#an').disabled = false; } } }, 2000); S.timers.push(poll);
  };
  function showPlan(plan) {
    const over = {}; const styles = S.state.styles;
    const draw = () => { const cut = plan.words.filter((w, i) => (over[i] != null ? over[i] : w.cut)).length;
      $('#plan').innerHTML = `<div class="card"><div class="row"><b class="grow">Transcript</b><span class="chip">${cut}/${plan.words.length} words cut</span><span class="chip">${plan.duration}s → ~${(plan.after).toFixed(1)}s</span></div>
      <p style="line-height:2.1;font-size:17px">${plan.words.map((w, i) => { const c = over[i] != null ? over[i] : w.cut; return `<span data-w="${i}" title="${esc(w.why || '')}" style="cursor:pointer;padding:1px 4px;margin:1px;border-radius:6px;${c ? 'background:#ef444433;color:#f87171;text-decoration:line-through' : ''}">${esc(w.t)}</span>`; }).join(' ')}</p><p class="mut">Click any word to toggle. Whisper can mishear fillers, so check the red ones.</p></div>
      <div class="card"><div class="split"><div><label>Caption style</label><select id="cs">${['volt', 'aurora-dark', 'mint-ledger', 'neon-night', 'bold-stripes', 'clean-white', 'paper', 'sunset', 'swiss-red'].filter(n => styles.find(x => x.name === n)).map(n => `<option>${esc(n)}</option>`).join('')}</select></div><div><label>Captions</label><select id="cc"><option value="1">on</option><option value="0">off</option></select></div></div><p><button id="rn">Cut &amp; caption</button> <span id="rmsg" class="mut"></span></p><div id="out"></div></div>`;
      document.querySelectorAll('[data-w]').forEach(e => (e.onclick = () => { const i = +e.dataset.w; const cur = over[i] != null ? over[i] : plan.words[i].cut; over[i] = !cur; draw(); }));
      $('#rn').onclick = async () => { $('#rn').disabled = true; $('#rmsg').textContent = 'Working…'; const r = await api('/footage/render', { file, level: $('#lvl').value, style: $('#cs').value, captions: $('#cc').value === '1', overrides: over });
        const poll2 = setInterval(async () => { await refresh(); const j = S.state.jobs.find(x => x.id === r.id); if (j?.status === 'done') { clearInterval(poll2); $('#rmsg').textContent = 'Done'; $('#rn').disabled = false; $('#out').innerHTML = `<video controls playsinline src="/footage/${esc(r.out)}?${Date.now()}" style="margin-top:10px"></video>`; } else if (j?.status === 'failed') { clearInterval(poll2); $('#rmsg').textContent = j.error; $('#rn').disabled = false; } }, 2000); S.timers.push(poll2); };
    };
    draw();
  }
}

// ---------------------------------------------------------------- Claude
async function claude() {
  const c = await api('/claude'); const u = c.usage; const st = c.settings;
  $('#main').innerHTML = `<h2>Claude</h2><p class="sub">Every model call goes through here. Code does the easy work for free; small tasks use the small model; results are cached.</p>
  <div class="card"><b>Mode</b><div class="row" style="margin-top:8px">${[['eco', 'Eco', 'haiku wherever possible'], ['balanced', 'Balanced', 'sonnet for writing, haiku for the rest'], ['quality', 'Quality', 'opus for writing, sonnet for the rest']].map(([k, n, d]) => `<button class="${st.mode === k ? '' : 'alt'}" data-mode="${k}">${n}<br><span style="font-weight:400;font-size:12px">${d}</span></button>`).join('')}</div></div>
  <div class="card tw"><table><tr><th>Task</th><th>What it does</th><th>Model</th></tr>${c.tasks.map(t => `<tr><td><code>${esc(t.id)}</code>${t.computer ? ' 🖥' : ''}</td><td>${esc(t.desc)}</td><td><select data-task="${esc(t.id)}" style="width:auto">${['auto', ...c.models].map(m => `<option value="${m}" ${(m === 'auto' ? !t.overridden : t.model === m && t.overridden) ? 'selected' : ''}>${m === 'auto' ? 'auto (' + t.model + ')' : m}</option>`).join('')}</select></td></tr>`).join('')}</table>
  <p class="mut">🖥 = Claude drives your browser. It tries the small model first and escalates to the next one only if the result fails validation.</p></div>
  <div class="split"><div class="card"><b>Usage today</b><p>${u.calls} model calls · <span class="ok">${u.cacheHits} served from cache (free)</span> · ${u.output.toLocaleString()} output tokens</p>${Object.entries(u.by).map(([k, v]) => `<div class="lintli"><b style="width:70px">${esc(k)}</b><span>${v.calls} calls · ${v.input.toLocaleString()} in · ${v.output.toLocaleString()} out</span></div>`).join('') || '<p class="mut">No calls yet.</p>'}
  <label>Daily call budget</label><input id="bc" type="number" value="${st.budget.dailyCalls}"><label>Daily output-token budget</label><input id="bt" type="number" value="${st.budget.dailyOutputTokens}"><p><button id="sv" class="alt">Save budget</button></p></div>
  <div class="card"><b>Never sent to a model</b><p class="mut">${c.codeOnly.map(esc).join(' · ')}.</p><p><button id="test" class="alt">Test Claude connection</button> <span id="tm" class="mut">${c.available ? '' : 'Claude Code CLI not found'}</span></p></div></div>`;
  document.querySelectorAll('[data-mode]').forEach(b => (b.onclick = async () => { await api('/claude', { mode: b.dataset.mode }); claude(); }));
  document.querySelectorAll('[data-task]').forEach(sel => (sel.onchange = async () => { const r = { ...st.routing }; if (sel.value === 'auto') delete r[sel.dataset.task]; else r[sel.dataset.task] = sel.value; await api('/claude', { routing: r }); claude(); }));
  $('#sv').onclick = async () => { await api('/claude', { budget: { dailyCalls: +$('#bc').value, dailyOutputTokens: +$('#bt').value } }); toast('Saved'); };
  $('#test').onclick = async () => { $('#tm').textContent = 'Testing…'; try { const r = await api('/claude/test', {}); $('#tm').textContent = `✔ works (${r.model}, ${r.usage.output} output tokens)`; } catch (e) { $('#tm').textContent = e.message; } };
}

// ---------------------------------------------------------------- Setup
async function setup() {
  const h = S.state.health; const { brand: b } = await api('/brand'); const P = b.production, Po = b.posting, D = b.daily;
  const row = (ok, t, fix) => `<div class="lintli"><span class="${ok ? 'ok' : 'bad'}">${ok ? '✔' : '✘'}</span><span>${t}${ok ? '' : ` <span class="mut">${fix}</span>`}</span></div>`;
  const f = (id, label, val, type = 'text') => `<label>${label}</label><input id="${id}" type="${type}" value="${esc(val)}">`;
  $('#main').innerHTML = `<h2>Setup</h2><p class="sub">Everything runs on this computer.</p>
  <div class="card"><b>Your brand</b><p class="mut">Claude only uses facts you put here. Never invent numbers: add real proof points.</p>${f('b_product', 'Product (one line)', b.product)}${f('b_audience', 'Who it is for', b.audience)}${f('b_problem', 'Their real problem', b.problem)}<div class="split"><div>${f('b_cta', 'CTA keyword (viewers comment this)', b.cta)}</div><div>${f('b_niche', 'Niche tag', b.niche)}</div></div>${f('b_tone', 'Tone', b.tone)}
  <label>Proof points (one per line: claim = number)</label><textarea id="b_proof" style="min-height:80px">${esc(b.proof.map(p => p.claim + (p.number ? ' = ' + p.number : '')).join('\n'))}</textarea><label>Competitor / inspiration handles (comma separated)</label><input id="b_comp" value="${esc(b.competitors.join(', '))}"></div>
  <div class="card"><b>Production</b>${f('b_site', 'Your website (used by the deep research)', b.website || '')}<label>Default style</label><div id="sgs"></div>
  <div class="split"><div><label>Presenter</label><select id="p_av">${['none', 'founder', 'robot', 'blob'].map(a => `<option ${a === P.avatar ? 'selected' : ''}>${a}</option>`).join('')}${P.avatar?.startsWith('heygen') ? `<option selected>${esc(P.avatar)}</option>` : ''}</select></div><div><label>Language</label><select id="p_lang">${['en', 'es', 'fr', 'it', 'pt', 'de', 'ja', 'ko', 'zh', 'hi', 'ru', 'uk', 'he', 'ar', 'el', 'tr'].map(l => `<option ${l === P.lang ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
  <label><input type="checkbox" id="p_sfx" style="width:auto" ${P.sfx !== false ? 'checked' : ''}> Sound effects (soft whoosh on cuts, pop on key words)</label>
  <h4 style="margin:18px 0 6px">Voice</h4><div id="vp"></div></div>
  <div class="card"><b>Posting</b><div class="split"><div><label>Method</label><select id="o_method"><option value="computer" ${Po.method === 'computer' ? 'selected' : ''}>Claude uses my browser (no API needed)</option><option value="api" ${Po.method === 'api' ? 'selected' : ''}>Instagram API</option><option value="manual" ${Po.method === 'manual' ? 'selected' : ''}>Manual (copy caption, open file)</option></select></div><div><label>Before sharing</label><select id="o_mode"><option value="review" ${Po.mode === 'review' ? 'selected' : ''}>ask me first</option><option value="auto" ${Po.mode === 'auto' ? 'selected' : ''}>post automatically</option><option value="none" ${Po.mode === 'none' ? 'selected' : ''}>render only</option></select></div></div>
  ${f('o_user', 'Your Instagram username (for reading insights)', Po.username)}<label><input type="checkbox" id="o_trial" style="width:auto" ${Po.trial ? 'checked' : ''}> post as trial reel when possible</label>
  <p class="row"><button class="alt" id="browser">Open Reelkit browser to log in to Instagram</button><span class="mut">Log in once; the login stays in this dedicated profile.</span></p></div>
  <div class="card"><b>Daily routine</b><label><input type="checkbox" id="d_on" style="width:auto" ${D.enabled ? 'checked' : ''}> Ask me for references and today's focus every day</label><div class="split"><div>${f('d_time', 'Time', D.time, 'time')}</div><div>${f('d_min', 'Minimum references', D.minReferences, 'number')}</div></div>
  <label><input type="checkbox" id="d_auto" style="width:auto" ${D.autopilot ? 'checked' : ''}> If I don't answer within <input id="d_grace" type="number" value="${D.graceMinutes}" style="width:80px;display:inline"> minutes, run Make &amp; Post automatically (still pauses for review if that is on)</label><label><input type="checkbox" id="n_on" style="width:auto" ${b.notify ? 'checked' : ''}> Desktop notifications</label></div>
  <p><button id="save" style="font-size:17px">Save</button></p>
  <div class="card"><b>Health</b>${row(h.ffmpeg, 'ffmpeg', 'winget install Gyan.FFmpeg')}${row(h.browser, 'Chrome or Edge + playwright-core', 'npm install')}${row(S.state.provider !== 'silent', 'Voice: ' + esc(S.state.provider), 'pip install piper-tts, then reelkit voices install en')}${row(h.instagram || Po.method !== 'api', 'Instagram API (only for method = API)', 'docs/INSTAGRAM.md')}</div>`;
  styleGallery($('#sgs'), P.style || 'auto', v => (P.style = v), { auto: true }); const vget = await voicePicker($('#vp'), P, () => $('#p_lang').value);
  $('#browser').onclick = async () => { await api('/browser', {}); toast('Browser opened: log in to Instagram'); };
  $('#save').onclick = async () => {
    const v = id => $('#' + id).value; const proof = v('b_proof').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [c, n] = l.split('='); return { claim: c.trim(), number: (n || '').trim() }; });
    await api('/brand', { product: v('b_product'), audience: v('b_audience'), problem: v('b_problem'), cta: v('b_cta'), niche: v('b_niche'), tone: v('b_tone'), proof, competitors: v('b_comp').split(',').map(x => x.trim()).filter(Boolean), notify: $('#n_on').checked,
      website: v('b_site'), production: { style: P.style || 'auto', avatar: v('p_av'), ...vget(), lang: v('p_lang'), sfx: $('#p_sfx').checked }, posting: { method: v('o_method'), mode: v('o_mode'), username: v('o_user'), trial: $('#o_trial').checked }, daily: { enabled: $('#d_on').checked, time: v('d_time'), minReferences: +v('d_min'), autopilot: $('#d_auto').checked, graceMinutes: +v('d_grace') } });
    toast('Saved'); };
}

// ---------------------------------------------------------------- voice picker
async function voicePicker(host, P, getLang) {
  const { providers, auto } = await api('/voices'); let prov = P.voice || 'auto', vid = P.voiceId || '';
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  const draw = () => {
    const cur = providers.find(p => p.id === prov); const lang = getLang();
    const voices = (cur?.voices || []).filter(v => v.lang === lang || v.lang === lang.split('-')[0]);
    host.innerHTML = `<label style="display:flex;gap:8px;align-items:center;text-transform:none;font-size:14px;color:var(--fg)"><input type="radio" name="vp" value="auto" style="width:auto" ${prov === 'auto' ? 'checked' : ''}> <b>Auto</b> <span class="mut">best available: ${esc(auto)}</span></label>
    ${providers.map(p => `<label style="display:flex;gap:8px;align-items:flex-start;text-transform:none;font-size:14px;color:${p.available ? 'var(--fg)' : 'var(--mut)'}"><input type="radio" name="vp" value="${esc(p.id)}" style="width:auto;margin-top:4px" ${p.id === prov ? 'checked' : ''} ${p.available ? '' : 'disabled'}><span><b>${esc(p.label)}</b> <span class="mut">${esc(p.kind)} · ${stars(p.quality)}</span><br>${p.available ? '<span class="ok">ready</span>' : `<span class="mut">not set up: ${esc(p.install)}</span>`}</span></label>`).join('')}
    <div class="row" style="margin-top:10px">${voices.length ? `<select id="vsel" style="width:auto"><option value="">default voice</option>${voices.map(v => `<option value="${esc(v.id)}" ${v.id === vid ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>` : ''}<button class="alt" id="vprev">▶ Preview</button><audio id="vaud" controls style="display:none;height:34px"></audio><span id="vmsg" class="mut"></span></div>`;
    host.querySelectorAll('input[name=vp]').forEach(r => (r.onchange = () => { prov = r.value; vid = ''; draw(); }));
    const sel = host.querySelector('#vsel'); if (sel) sel.onchange = () => (vid = sel.value);
    $('#vprev').onclick = async () => { $('#vmsg').textContent = 'Generating…'; try { const r = await api('/voices/preview', { provider: prov, voiceId: vid, lang }); const a = $('#vaud'); a.src = r.url; a.style.display = 'inline-block'; a.play(); $('#vmsg').textContent = ''; await api('/guide/confirm', { id: 'voiceChecked' }); } catch (e) { $('#vmsg').textContent = e.message; } };
  };
  draw(); return () => ({ voice: prov, voiceId: vid });
}

const md = t => { const lines = esc(t).split('\n'); let out = '', inList = false; for (let l of lines) { l = l.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/_(.+?)_/g, '<i>$1</i>'); if (/^- /.test(l)) { if (!inList) { out += '<ul>'; inList = true; } out += '<li>' + l.slice(2) + '</li>'; continue; } if (inList) { out += '</ul>'; inList = false; } if (/^### /.test(l)) out += '<h4>' + l.slice(4) + '</h4>'; else if (/^## /.test(l)) out += '<h3>' + l.slice(3) + '</h3>'; else if (/^# /.test(l)) out += '<h2>' + l.slice(2) + '</h2>'; else if (l.trim()) out += '<p>' + l + '</p>'; } return out + (inList ? '</ul>' : ''); };

// ---------------------------------------------------------------- Research
async function research() {
  const r = await api('/research'); const res = r.research; const stages = [['site', 'Your website'], ['audience', 'Your audience'], ['competitors', 'Competitors'], ['strategy', 'Strategy']];
  const { brand: b } = await api('/brand'); await refresh(); const job = S.state.jobs.find(j => j.type === 'research'); const running = job && ['queued', 'running'].includes(job.status);
  $('#main').innerHTML = `<h2>Research</h2><p class="sub">The first-time deep dive: what you really offer, who buys and in what words, what competitors do, and a content strategy. Runs once, saved, and feeds every script.</p>
  <div class="card"><div class="row"><div class="grow"><b>${res?.finished ? 'Research complete' : 'Not run yet'}</b><div class="mut">Website: ${esc(b.website || 'none yet (add it in Setup for better results)')} · uses Claude's web search + fetch (sonnet) · about 4 calls, 5 to 10 minutes</div></div>
  <button id="go" ${running ? 'disabled' : ''}>${running ? 'Running…' : res?.finished ? '↻ Refresh research' : '▶ Run deep research'}</button></div>
  <div style="margin-top:10px">${stages.map(([id, n]) => { const st = res?.stages?.[id]; return `<span class="chip ${st?.status === 'done' ? 'cta' : ''}" style="margin-right:6px">${st?.status === 'done' ? '✔' : st?.status === 'failed' ? '✘' : '·'} ${n}</span>`; }).join('')}</div>
  ${running ? `<div class="bar" style="margin-top:10px"><i style="width:${Math.round((job.progress || 0.05) * 100)}%"></i></div><p class="mut">${esc(job.stage || 'starting…')}</p>` : ''}
  ${stages.map(([id]) => res?.stages?.[id]?.status === 'failed' ? `<p class="bad">${esc(res.stages[id].error)}</p>` : '').join('')}</div>
  ${r.report ? `<div class="card md">${md(r.report)}</div>` : ''}`;
  $('#go').onclick = async () => { await api('/research/run', { force: !!res?.finished }); toast('Started'); research(); };
  if (running) S.timers.push(setInterval(research, 4000));
}

// ---------------------------------------------------------------- Leads & chat
async function leads() {
  const d = await api('/leads'); const c = d.chat; const st = d.status; const link = st?.url;
  const faqText = (c.faq || []).map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n');
  $('#main').innerHTML = `<h2>Leads &amp; chat</h2><p class="sub">A link for your Instagram bio. Visitors give name, email and what they need, then chat with an AI that only knows what you tell it here. Every visitor is saved as a lead.</p>
  <div class="card"><div class="row"><b class="grow">Business chat</b><label style="margin:0;text-transform:none;font-size:14px;color:var(--fg)"><input type="checkbox" id="c_on" style="width:auto" ${c.enabled ? 'checked' : ''}> turned on</label></div>
  ${c.enabled ? `<p>${link ? `Your link: <a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(link)}</a> <button class="alt" id="cp" style="padding:4px 10px">Copy</button>` : '<span class="mut">Starts with the app (restart it after turning on).</span>'}</p><p class="mut">${st?.tunnel ? 'Public through a temporary Cloudflare tunnel. The address changes each time the app restarts.' : link && link.includes('localhost') ? 'Only reachable on this computer. For a public link install cloudflared (winget install Cloudflare.cloudflared) and restart. ' + esc(st?.error || '') : ''}</p>` : ''}
  <div class="split"><div><label>Business name</label><input id="c_name" value="${esc(c.businessName)}"></div><div><label>Tagline</label><input id="c_tag" value="${esc(c.tagline)}"></div></div>
  <label>Welcome message</label><input id="c_wel" value="${esc(c.welcome)}" placeholder="Hi! Ask me anything about…">
  <label>FAQ (the assistant answers ONLY from this plus your brand facts). Format: Q: question then A: answer, blank line between</label><textarea id="c_faq" style="min-height:140px">${esc(faqText)}</textarea>
  <div class="split"><div><label>Free resource label (optional)</label><input id="c_ml" value="${esc(c.leadMagnet.label)}" placeholder="Pricing playbook"></div><div><label>Resource text or link</label><input id="c_mu" value="${esc(c.leadMagnet.url || c.leadMagnet.text)}" placeholder="https://…"></div></div>
  <label>Consent text shown to visitors</label><textarea id="c_con" style="min-height:60px">${esc(c.consent)}</textarea>
  <p class="row"><button id="c_save">Save</button><span class="mut">Replies use the small model (haiku) with their own daily budget (${'200'} messages), so visitors never use up your content budget.</span></p></div>
  <div class="card"><div class="row"><b class="grow">Leads (${d.leads.length})</b><a class="btn" href="/api/leads.csv" style="padding:6px 12px">Export CSV</a></div>
  ${d.leads.map(l => `<details style="border-bottom:1px solid var(--line);padding:8px 0"><summary><b>${esc(l.name)}</b> &lt;${esc(l.email)}&gt; <span class="chip">${esc(l.status)}</span> <span class="mut">${esc(l.created.slice(0, 10))}</span></summary><p><b>Needs:</b> ${esc(l.need)}</p>${(l.transcript || []).map(m => `<div class="lintli"><b style="width:70px">${m.role === 'user' ? 'Visitor' : 'AI'}</b><span>${esc(m.text)}</span></div>`).join('')}
  <p class="row"><select data-ls="${esc(l.id)}" style="width:auto">${['new', 'contacted', 'won', 'lost'].map(x => `<option ${x === l.status ? 'selected' : ''}>${x}</option>`).join('')}</select><a class="btn" href="mailto:${encodeURIComponent(l.email)}" style="padding:6px 12px">Email</a><button class="alt" data-ld="${esc(l.id)}">Delete</button></p></details>`).join('') || '<p class="mut">No leads yet.</p>'}</div>`;
  $('#c_save').onclick = async () => {
    const faq = $('#c_faq').value.split(/\n\s*\n/).map(b => { const q = b.match(/Q:\s*([\s\S]*?)\s*\n\s*A:\s*([\s\S]*)/i); return q ? { q: q[1].trim(), a: q[2].trim() } : null; }).filter(Boolean); const v = $('#c_mu').value.trim();
    await api('/brand', { chat: { enabled: $('#c_on').checked, businessName: $('#c_name').value, tagline: $('#c_tag').value, welcome: $('#c_wel').value, faq, consent: $('#c_con').value, leadMagnet: { label: $('#c_ml').value, url: /^https?:\/\//.test(v) ? v : '', text: /^https?:\/\//.test(v) ? '' : v } } }); toast('Saved. Restart the app to apply on/off changes.'); leads(); };
  const cp = $('#cp'); if (cp) cp.onclick = () => { navigator.clipboard?.writeText(link); toast('Copied'); };
  document.querySelectorAll('[data-ls]').forEach(sel => (sel.onchange = async () => { await api('/leads/status', { id: sel.dataset.ls, status: sel.value }); toast('Saved'); }));
  document.querySelectorAll('[data-ld]').forEach(b => (b.onclick = async () => { if (confirm('Delete this lead and its chat permanently?')) { await api('/leads/delete', { id: b.dataset.ld }); leads(); } }));
}

// ---------------------------------------------------------------- Guide
async function guide() {
  const g = await api('/guide');
  $('#main').innerHTML = `<h2>Guide</h2><p class="sub">${g.doneCount} of ${g.steps.length} steps done. This list checks itself.</p>
  <div class="card">${g.steps.map((x, i) => `<div class="step ${x.done ? 'done' : ''}"><div class="n">${x.done ? '✔' : i + 1}</div><div class="grow"><b>${esc(x.title)}</b><div class="mut">${esc(x.how)}</div><p class="row" style="margin:8px 0 0"><a class="btn" href="${esc(x.link)}" style="padding:5px 12px">Open</a>${x.confirm && !x.done ? `<button class="alt" data-c="${esc(x.confirm)}" style="padding:5px 12px">I logged in</button>` : ''}</p></div></div>`).join('')}</div>
  <div class="card md"><h3>Every day</h3><ul><li>The app asks for new references and today's focus (a notification and a card on <b>Today</b>). Answer in 30 seconds.</li><li>Press <b>Make &amp; Post</b>. With "review before sharing" on, it stops at the final Share screen so you can look first.</li><li>Check <b>Analyze</b> once a week. Winners appear on <b>Repurpose</b>.</li></ul>
  <h3>Keep usage low</h3><ul><li>Claude tab → <b>Eco</b>. Small tasks use haiku, identical prompts are cached, and code does lint, scoring, rendering and cutting for free.</li><li>The deep research and the style/script writing are the only sonnet tasks by default.</li></ul>
  <h3>If something breaks</h3><ul><li>Run <code>node bin/reelkit.mjs doctor</code> in the project folder. It lists what is missing and the fix.</li><li>Posting stops with a message in the inbox when Instagram asks you to log in or verify. Do that in the Reelkit browser window, then press Resume.</li><li>Voices silent? Setup → Voice → pick one marked ready and press Preview.</li><li>Scheduled posts, daily check-ins and the chat link only work while the app is running.</li></ul></div>`;
  document.querySelectorAll('[data-c]').forEach(b => (b.onclick = async () => { await api('/guide/confirm', { id: b.dataset.c }); guide(); }));
}
route();
