// Deterministic Instagram composer, driven over the DevTools socket. Instagram's web page keeps animating (videos, placeholders), and
// browser-automation clicks wait for an element to be "stable", so they time out there. A plain DOM click does not wait: it is what
// a person's click amounts to once the element is on screen. Claude is only the fallback when a step here cannot find its element.
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function openPage(port, { urlMatch = /instagram\.com/, gotoUrl } = {}) {
  if (typeof WebSocket === 'undefined') throw new Error('Needs Node 22+');
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2500) })).json();
  const pages = list.filter(t => t.type === 'page' && t.webSocketDebuggerUrl); const t = pages.find(x => urlMatch.test(x.url)) || pages[0]; if (!t) throw new Error('No browser tab is open');
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pending = new Map();
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('devtools connection failed')); });
  ws.onmessage = e => { const m = JSON.parse(e.data); const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  const call = (method, params = {}) => new Promise((res, rej) => { const i = ++id; const to = setTimeout(() => { pending.delete(i); rej(new Error(method + ' timed out')); }, 15000); pending.set(i, { res: v => { clearTimeout(to); res(v); }, rej: e => { clearTimeout(to); rej(e); } }); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split('\n')[0] || 'page script failed'); return r.result.value; };
  const page = { call, ev, url: t.url, close: () => { try { ws.close(); } catch {} } };
  if (gotoUrl && !urlMatch.test(t.url)) { await call('Page.navigate', { url: gotoUrl }); await sleep(4500); }
  return page;
}

const VIS = `const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none'; };`;
/** Click the (last, i.e. topmost) visible clickable whose exact text or aria-label matches. */
export const clickByText = (page, texts) => page.ev(`(() => { ${VIS} const want = ${JSON.stringify(texts)}.map(x => x.toLowerCase());
  const els = [...document.querySelectorAll('button,[role=button],[role=menuitem],a,[tabindex]')].filter(e => vis(e) && (want.includes((e.innerText || '').trim().toLowerCase()) || want.includes((e.getAttribute('aria-label') || '').toLowerCase())));
  const el = els[els.length - 1]; if (!el) return false; el.click(); return true; })()`);
export const clickIcon = (page, labels) => page.ev(`(() => { ${VIS} const want = ${JSON.stringify(labels)}.map(x => x.toLowerCase());
  const icons = [...document.querySelectorAll('svg[aria-label]')].filter(s => want.includes(s.getAttribute('aria-label').toLowerCase()) && vis(s));
  const s = icons[0]; if (!s) return false; const t = s.closest('a,button,[role=button],[role=link],[tabindex]') || s.parentElement; t.click(); return true; })()`);
export const hasText = (page, text) => page.ev(`(() => { ${VIS} return [...document.querySelectorAll('[role=dialog] *, body *')].some(e => e.children.length === 0 && vis(e) && (e.innerText || '').toLowerCase().includes(${JSON.stringify(text.toLowerCase())})); })()`);
export async function waitFor(fn, ms = 10000, step = 400) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch {} await sleep(step); } return false; }

export async function setFile(page, file) {
  const r = await page.call('Runtime.evaluate', { expression: `(() => { const l = [...document.querySelectorAll('input[type=file]')]; return l.find(i => /video|mp4|quicktime/i.test(i.accept || '')) || l[l.length - 1] || null; })()` });
  if (!r.result?.objectId) throw new Error('No file input found on the page');
  await page.call('DOM.setFileInputFiles', { objectId: r.result.objectId, files: [file] });
}

/** Whole composer: open Create, attach video, Next x2, caption, optional trial. Stops before Share. Throws with the step that failed. */
export async function prepareDeterministic(page, { file, caption, trial, log = () => {} }) {
  const step = async (name, fn) => { log(name); const v = await fn(); if (!v) throw new Error('step failed: ' + name); return v; };
  await page.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  if (/\/accounts\/login/.test(await page.ev('location.href'))) return { status: 'login_required' };
  if (!(await waitFor(() => page.ev(`document.querySelectorAll('svg[aria-label]').length > 3`), 12000))) throw new Error('step failed: page not ready');
  await step('Opening the Create menu', async () => (await clickIcon(page, ['New post', 'Create'])) || (await clickByText(page, ['Create', 'New post'])));
  await sleep(700); await clickByText(page, ['Post']); // a submenu shows Post / Live video / Ad on some layouts
  await step('Waiting for the upload screen', () => waitFor(() => page.ev(`!!document.querySelector('input[type=file]')`), 9000));
  await step('Handing over the video', async () => { await setFile(page, file); return true; });
  await step('Waiting for the preview', () => waitFor(() => clickByText(page, ['Next']), 25000, 700)); await sleep(1200);
  await step('Moving to the edit step', () => waitFor(() => clickByText(page, ['Next']), 12000, 700)); await sleep(900);
  await page.ev(`(() => { const ok = [...document.querySelectorAll('button,[role=button]')].find(b => /^ok$/i.test((b.innerText || '').trim())); if (ok) ok.click(); return true; })()`);
  await step('Writing the caption', async () => {
    const found = await waitFor(() => page.ev(`(() => { const e = document.querySelector('[aria-label="Write a caption..."],[aria-label^="Write a caption"],div[role=textbox][contenteditable=true],textarea'); if (!e) return false; e.focus(); e.click(); return true; })()`), 15000);
    if (!found) return false;
    const lines = String(caption).split('\n'); for (let i = 0; i < lines.length; i++) { if (i) { await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' }); await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); } if (lines[i]) await page.call('Input.insertText', { text: lines[i] }); }
    await sleep(500); const typed = await page.ev(`(() => { const e = document.querySelector('[aria-label^="Write a caption"],div[role=textbox][contenteditable=true],textarea'); return e ? (e.innerText || e.value || '') : ''; })()`);
    return typed.replace(/\s+/g, ' ').includes(lines.find(l => l.trim()).trim().slice(0, 25));
  });
  if (trial) { try { await page.ev(`(() => { const t = [...document.querySelectorAll('[role=switch],input[type=checkbox]')].find(x => /trial|non-follower/i.test((x.closest('div')?.parentElement?.innerText || ''))); if (t && t.getAttribute('aria-checked') !== 'true' && !t.checked) t.click(); return true; })()`); } catch {} }
  await step('Checking the Share button is there', () => waitFor(() => page.ev(`(() => { ${VIS} return !!([...document.querySelectorAll('button,[role=button]')].find(b => /^share$/i.test((b.innerText || '').trim()) && vis(b))); })()`), 8000));
  return { status: 'ready', note: 'filled in by Reelkit' };
}

export async function shareDeterministic(page, { log = () => {} } = {}) {
  log('Clicking Share'); if (!(await clickByText(page, ['Share']))) throw new Error('Share button not found');
  const ok = await waitFor(() => page.ev(`(() => { const t = document.body.innerText; return /your reel has been shared|reel shared|your post has been shared|post shared/i.test(t); })()`), 120000, 1500);
  if (!ok) return { status: 'error', note: 'Clicked Share but did not see the confirmation within 2 minutes. Check Instagram before trying again.' };
  return { status: 'posted' };
}
