'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = async (p, body) => { const r = await fetch('/api' + p, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (j.error) throw new Error(j.error); return j; };
const toast = m => { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => (t.style.display = 'none'), 2600); };
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const fmt = n => (n == null ? '–' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n.toLocaleString());
const S = { state: null, slug: localStorage.getItem('rk.slug') || '', style: localStorage.getItem('rk.style') || 'aurora-dark', timers: [] };
const TABS = [['swipe', '01', 'Swipe'], ['script', '02', 'Script'], ['produce', '03', 'Produce'], ['post', '04', 'Post'], ['analyze', '05', 'Analyze'], ['repurpose', '06', 'Repurpose'], ['setup', '', 'Setup']];
const stop = () => { S.timers.forEach(clearInterval); S.timers = []; };
const reels = () => S.state?.reels || [];
const cur = () => reels().find(r => r.slug === S.slug) || reels()[0];
async function refresh() { S.state = await api('/state'); if (!S.slug && reels()[0]) S.slug = reels()[0].slug; }
function reelPicker(id = 'pick') { return `<select id="${id}">${reels().map(r => `<option value="${esc(r.slug)}" ${r.slug === (cur() || {}).slug ? 'selected' : ''}>${esc(r.title)}</option>`).join('') || '<option>(no reels yet)</option>'}</select>`; }
function bindPicker(fn, id = 'pick') { const e = $('#' + id); if (e) e.onchange = () => { S.slug = e.value; localStorage.setItem('rk.slug', S.slug); fn(); }; }
function newReelBtn(fn) { return `<button class="alt" id="newreel">+ New reel</button>`; }
function bindNew(fn) { const b = $('#newreel'); if (b) b.onclick = async () => { const t = prompt('Reel title'); if (!t) return; const r = await api('/reel', { title: t }); S.slug = r.slug; await refresh(); fn(); }; }

async function route() {
  stop(); const h = (location.hash || '#swipe').slice(1);
  $('#nav').innerHTML = TABS.map(([k, n, l]) => `<a href="#${k}" class="${k === h ? 'on' : ''}"><b>${n}</b>${l}</a>`).join('');
  try { await refresh(); await ({ swipe, script, produce, post, analyze, repurpose, setup }[h] || swipe)(); } catch (e) { $('#main').innerHTML = `<div class="card bad">${esc(e.message)}</div>`; }
}
addEventListener('hashchange', route);

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
  <div class="card"><b>Style</b> <span class="mut">(${S.state.styles.length})</span><div class="grid" style="margin-top:10px">${S.state.styles.map(s => `<div class="card stylecard ${s.name === S.style ? 'sel' : ''}" data-s="${esc(s.name)}" style="margin:0"><b>${esc(s.name)}</b><br><span class="mut" style="font-size:12px">${esc(s.desc)}</span></div>`).join('')}</div></div>
  <div class="split"><div class="card"><div class="split"><div><label>Voice</label><select id="voice"><option value="auto">auto (${esc(S.state.provider)})</option><option>elevenlabs</option><option>edge</option><option>sapi</option><option>say</option><option>espeak</option><option>silent</option></select></div><div><label>Language</label><select id="lang">${['en', 'es', 'fr', 'it', 'pt', 'de', 'ja', 'ko', 'zh', 'hi', 'ru', 'uk', 'he', 'ar', 'el', 'tr'].map(l => `<option ${((r.lang || 'en') === l) ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
  <p class="row"><label style="margin:0"><input type="checkbox" id="draft" style="width:auto"> fast draft</label><span class="grow"></span><button id="go">Render</button></p><div id="jobs"></div></div>
  <div class="card" id="player">${files.reel ? `<video controls playsinline src="/file/${r.slug}/reel.mp4?${r.rendered || ''}"></video>` : files.draft ? `<video controls playsinline src="/file/${r.slug}/draft.mp4"></video>` : '<p class="mut">No render yet.</p>'}<div id="vir"></div></div></div>` : ''}`;
  bindPicker(produce); bindNew(produce); if (!r) return;
  document.querySelectorAll('.stylecard').forEach(e => (e.onclick = () => { S.style = e.dataset.s; localStorage.setItem('rk.style', S.style); document.querySelectorAll('.stylecard').forEach(x => x.classList.toggle('sel', x === e)); }));
  $('#go').onclick = async () => { await api('/render', { slug: r.slug, style: S.style, voice: $('#voice').value, lang: $('#lang').value, draft: $('#draft').checked }); toast('Queued'); poll(); };
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

// ---------------------------------------------------------------- Setup
async function setup() {
  const h = S.state.health; const row = (ok, t, fix) => `<div class="lintli"><span class="${ok ? 'ok' : 'bad'}">${ok ? '✔' : '✘'}</span><span>${t}${ok ? '' : ` <span class="mut">${fix}</span>`}</span></div>`;
  $('#main').innerHTML = `<h2>Setup</h2><p class="sub">Everything runs on this computer.</p><div class="card">${row(h.ffmpeg, 'ffmpeg', 'Install: winget install Gyan.FFmpeg')}${row(h.browser, 'Chrome or Edge + playwright-core (renderer)', 'Run: npm install')}${row(h.font, 'Fonts', 'Set REELKIT_FONT')}
  ${row(h.instagram, 'Instagram account (posting + analytics)', 'reelkit account add … (docs/INSTAGRAM.md)')}${row(h.elevenlabs, 'ElevenLabs key (optional, best voices + exact caption timing)', 'reelkit key elevenlabs &lt;key&gt;')}${row(h.heygen, 'HeyGen key (optional, avatar videos)', 'reelkit key heygen &lt;key&gt;')}
  <p class="mut">Voice in use: <b>${esc(S.state.provider)}</b>. Accounts: ${S.state.accounts.map(a => esc(a.name)).join(', ') || 'none'}.</p></div>
  <div class="card"><b>Phone access</b><p class="mut">Run <code>reelkit dashboard --lan</code>, open the printed link on your phone, then “Add to Home Screen”. The link contains a private token.</p></div>`;
}
route();
