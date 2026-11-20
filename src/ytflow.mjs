// YouTube Shorts upload through YouTube Studio, driven over DevTools the same way as the Instagram composer (see igflow.mjs).
// A vertical video up to 3 minutes is treated as a Short automatically; "#Shorts" in the description helps.
import { waitFor, clickByText, setFile, typeText } from './igflow.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const VIS = `const vis = e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };`;
const q = sel => JSON.stringify(sel);

const focusBox = (page, hostSel, fallbackIndex) => page.ev(`(() => { const h = document.querySelector(${q(hostSel)}); let e = h && h.querySelector('#textbox,[contenteditable=true]'); if (!e) { const all = [...document.querySelectorAll('div[contenteditable=true],#textbox')]; e = all[${fallbackIndex}]; } if (!e) return false; e.focus(); e.click(); document.execCommand('selectAll'); return true; })()`);

export async function prepareYoutube(page, { file, title, description, log = () => {}, navigate = true }) {
  const step = async (name, fn) => { log(name); const v = await fn(); if (!v) throw new Error('step failed: ' + name); return v; };
  if (navigate) { await page.call('Page.navigate', { url: 'https://www.youtube.com/upload' }); await sleep(4500); }
  const href = await page.ev('location.href'); if (/accounts\.google\.com|\/signin|ServiceLogin/i.test(href)) return { status: 'login_required' };
  await step('Waiting for the upload screen', () => waitFor(() => page.ev(`!!document.querySelector('input[type=file]')`), 20000));
  await step('Handing over the video', async () => { await setFile(page, file); return true; });
  await step('Waiting for the details form', () => waitFor(() => page.ev(`!!document.querySelector('#title-textarea,[aria-label*="Add a title"],#textbox')`), 60000, 800)); await sleep(800);
  await step('Writing the title', async () => { if (!(await focusBox(page, '#title-textarea', 0))) return false; await typeText(page, title.slice(0, 100)); await sleep(300); return true; });
  await step('Writing the description', async () => { if (!(await focusBox(page, '#description-textarea', 1))) return false; await typeText(page, description.slice(0, 4900)); await sleep(300); return true; });
  const shown = await page.ev(`(() => { const t = document.querySelector('#title-textarea #textbox,#title-textarea [contenteditable=true]'); return t ? (t.innerText || '').trim() : ''; })()`);
  if (shown && !shown.toLowerCase().includes(title.trim().slice(0, 15).toLowerCase())) throw new Error('step failed: the title did not stick');
  await step('Answering "made for kids"', async () => (await page.ev(`(() => { const r = document.querySelector('[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]'); if (!r) return false; r.click(); return true; })()`)) || (await clickByText(page, ["No, it's not made for kids"])));
  await sleep(500);
  for (let i = 0; i < 4; i++) {
    if (await page.ev(`!!document.querySelector('[name="PUBLIC"]') && (() => { const r = document.querySelector('[name="PUBLIC"]'); const b = r.getBoundingClientRect(); return b.width > 0; })()`)) break;
    await step('Next (' + (i + 1) + ')', async () => (await page.ev(`(() => { const b = document.querySelector('#next-button'); if (b && b.getAttribute('aria-disabled') !== 'true') { b.click(); return true; } return false; })()`)) || (await clickByText(page, ['Next']))); await sleep(1400);
  }
  await step('Choosing Public', () => waitFor(() => page.ev(`(() => { const r = document.querySelector('[name="PUBLIC"]'); if (!r) return false; r.click(); return true; })()`), 8000, 500));
  await step('Checking the Publish button is there', () => waitFor(() => page.ev(`!!document.querySelector('#done-button')`), 8000));
  return { status: 'ready', note: 'filled in by Reelkit' };
}

export async function publishYoutube(page, { log = () => {} } = {}) {
  log('Waiting for the upload to finish, then publishing');
  const ready = await waitFor(() => page.ev(`(() => { const b = document.querySelector('#done-button'); return !!b && b.getAttribute('aria-disabled') !== 'true' && !b.hasAttribute('disabled'); })()`), 10 * 60000, 3000);
  if (!ready) return { status: 'error', note: 'The upload did not finish within 10 minutes. Check YouTube Studio before trying again.' };
  await page.ev(`document.querySelector('#done-button').click(); true`);
  const ok = await waitFor(() => page.ev(`(() => /video published|video uploaded|processing will begin|your video is now|published/i.test(document.body.innerText))()`), 120000, 1500);
  if (!ok) return { status: 'error', note: 'Clicked Publish but did not see the confirmation within 2 minutes. Check YouTube Studio before trying again.' };
  const url = await page.ev(`(() => { const a = [...document.querySelectorAll('a[href*="youtu.be"],a[href*="youtube.com/shorts"],a[href*="watch?v="]')][0]; return a ? a.href : ''; })()`);
  return { status: 'posted', url };
}
