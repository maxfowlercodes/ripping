'use strict';
const $ = id => document.getElementById(id); let session = '';
const add = (cls, text) => { const d = document.createElement('div'); d.className = 'm ' + cls; d.textContent = text; $('log').appendChild(d); $('log').scrollTop = 1e9; return d; };
const post = async (p, b) => { const r = await fetch(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Something went wrong.'); return j; };
fetch('/api/info').then(r => r.json()).then(i => { document.title = i.name; $('name').textContent = i.name; $('tag').textContent = i.tagline || ''; $('consent').textContent = i.consent; document.documentElement.style.setProperty('--ac', /^#[0-9a-f]{3,8}$/i.test(i.accent) ? i.accent : '#6366f1'); window.WELCOME = i.welcome; if (!i.enabled) { $('lead').innerHTML = '<b>Chat is currently unavailable.</b>'; } });
$('lead').addEventListener('submit', async e => { e.preventDefault(); $('err').textContent = ''; $('go').disabled = true;
  try { const j = await post('/api/lead', { name: $('n').value, email: $('e').value, need: $('d').value, consent: $('c').checked, website: $('w').value }); session = j.session; $('lead').style.display = 'none'; $('chat').style.display = 'flex'; add('a', j.greeting || window.WELCOME); $('msg').focus(); }
  catch (er) { $('err').textContent = er.message; $('go').disabled = false; } });
$('send').addEventListener('submit', async e => { e.preventDefault(); const t = $('msg').value.trim(); if (!t) return; $('msg').value = ''; add('u', t); const w = add('a', '…'); $('sb').disabled = true;
  try { const j = await post('/api/chat', { session, message: t }); w.textContent = j.reply; } catch (er) { w.textContent = er.message; } $('sb').disabled = false; $('msg').focus(); });
