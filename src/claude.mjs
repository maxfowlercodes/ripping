// The Claude control layer. Every LLM call in Reelkit goes through askClaude():
//  - code first: tasks that code can do never reach a model
//  - cheapest capable model per task (haiku/sonnet/opus), editable per task, with Eco/Balanced/Quality presets
//  - cheap-first escalation: try the small model, validate, escalate only on failure
//  - result cache (identical prompt => zero usage), daily call/token budget, usage ledger
//  - pure-text tasks run with NO tools, NO skills, NO MCP, in an empty folder (smallest prompt, safest)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { home, ensureDir, readJson, writeJson } from './util.mjs';
import { resolveClaude } from './claudebin.mjs';
import { isCancelled } from './jobctx.mjs';

export const MODELS = ['haiku', 'sonnet', 'opus'];
export const DENY_BROWSER = ['browser_run_code_unsafe', 'browser_run_code', 'browser_evaluate', 'browser_network_requests', 'browser_network_request', 'browser_console_messages', 'browser_install', 'browser_drag'].map(t => 'mcp__playwright__' + t);
// mode -> model for each task. 'none' = never call a model (code does it).
export const TASKS = {
  ideas:             { desc: 'Turn saved references + brand into post ideas',            eco: 'haiku',  balanced: 'sonnet', quality: 'sonnet', effort: 'low',    ttlDays: 7 },
  script_write:      { desc: 'Write the reel script (hook, beats, visuals)',            eco: 'sonnet', balanced: 'sonnet', quality: 'opus',   effort: 'medium', ttlDays: 30 },
  lint_fix:          { desc: 'Fix only the lint issues in a script',                    eco: 'haiku',  balanced: 'haiku',  quality: 'sonnet', effort: 'low',    ttlDays: 30 },
  hook_variants:     { desc: 'Alternative hooks for a winner or weak opener',           eco: 'haiku',  balanced: 'haiku',  quality: 'sonnet', effort: 'low',    ttlDays: 30 },
  caption_hashtags:  { desc: 'Instagram caption + hashtags',                            eco: 'haiku',  balanced: 'haiku',  quality: 'sonnet', effort: 'low',    ttlDays: 30 },
  reference_analysis:{ desc: 'Extract the formula from a saved reference',              eco: 'haiku',  balanced: 'haiku',  quality: 'sonnet', effort: 'low',    ttlDays: 90 },
  analytics_summary: { desc: 'Plain-English read of the numbers (only if data changed)', eco: 'haiku', balanced: 'haiku',  quality: 'sonnet', effort: 'low',    ttlDays: 3 },
  translate:         { desc: 'Translate a script keeping numbers and visuals',          eco: 'haiku',  balanced: 'haiku',  quality: 'sonnet', effort: 'low',    ttlDays: 90 },
  style_make:        { desc: 'Generate a custom video style',                           eco: 'sonnet', balanced: 'sonnet', quality: 'opus',   effort: 'medium', ttlDays: 90 },
  chat_reply:        { desc: 'Answer a website/Instagram visitor in the business chat', eco: 'haiku', balanced: 'haiku', quality: 'sonnet', effort: 'low', ttlDays: 0 },
  brand_autofill:    { desc: 'Onboarding: fill in your brand details from your website', eco: 'haiku', balanced: 'sonnet', quality: 'sonnet', effort: 'low', ttlDays: 30, web: true },
  research_site:     { desc: 'First-run: read your website and extract what you really offer', eco: 'sonnet', balanced: 'sonnet', quality: 'opus', effort: 'medium', ttlDays: 30, web: true },
  research_audience: { desc: 'First-run: who buys, their pains and exact words (web search)', eco: 'sonnet', balanced: 'sonnet', quality: 'opus', effort: 'medium', ttlDays: 30, web: true },
  research_competitors: { desc: 'First-run: competitors, adjacent accounts, angles (web search)', eco: 'sonnet', balanced: 'sonnet', quality: 'opus', effort: 'medium', ttlDays: 30, web: true },
  research_strategy: { desc: 'First-run: pillars, 10 starter ideas, do-not-say list', eco: 'sonnet', balanced: 'sonnet', quality: 'opus', effort: 'medium', ttlDays: 30 },
  computer_check:    { desc: 'Check the browser works and you are logged in (read-only)', eco: 'haiku', balanced: 'haiku', quality: 'sonnet', effort: 'low', ttlDays: 0, computer: true, escalate: true },
  computer_post:     { desc: 'Drive the browser to post a reel',                        eco: 'haiku',  balanced: 'haiku',  quality: 'sonnet', effort: 'low',    ttlDays: 0, computer: true, escalate: true },
  computer_insights: { desc: 'Read reel insights off the website',                      eco: 'haiku',  balanced: 'haiku',  quality: 'sonnet', effort: 'low',    ttlDays: 0, computer: true, escalate: true },
  computer_research: { desc: 'Browse competitors/hashtags and list outlier reels',      eco: 'haiku',  balanced: 'sonnet', quality: 'sonnet', effort: 'low',    ttlDays: 1, computer: true, escalate: true },
};
// Things that are deliberately NOT model calls: lint, scoring, rendering, captions timing, scheduling, analytics math,
// ranks/winners, filler detection, carousel layout, thumbnails, calendar, queueing.
export const CODE_ONLY = ['lint', 'virality score', 'render', 'caption timing', 'filler cutting', 'scheduling', 'analytics math', 'winner detection', 'carousel layout'];

const settingsPath = () => path.join(home(), 'settings.json');
export const DEFAULT_SETTINGS = { mode: 'eco', routing: {}, budget: { dailyCalls: 60, dailyOutputTokens: 120000, chatDaily: 200 }, cache: true, claudeBin: 'claude' };
export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...readJson(settingsPath(), {}), budget: { ...DEFAULT_SETTINGS.budget, ...(readJson(settingsPath(), {}).budget || {}) } });
export const saveSettings = patch => { const s = { ...getSettings(), ...patch }; writeJson(settingsPath(), s); return s; };
export function modelFor(task, settings = getSettings()) {
  const t = TASKS[task]; if (!t) throw new Error('unknown task ' + task);
  const o = settings.routing?.[task]; if (o && (MODELS.includes(o) || o === 'none')) return o;
  return t[settings.mode] || t.balanced;
}

const ledgerPath = () => path.join(home(), 'usage.jsonl');
export const readLedger = () => (fs.existsSync(ledgerPath()) ? fs.readFileSync(ledgerPath(), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);
const logUse = e => { ensureDir(home()); fs.appendFileSync(ledgerPath(), JSON.stringify(e) + '\n'); };
export function usageToday(since = new Date(new Date().setHours(0, 0, 0, 0))) {
  const rows = readLedger().filter(r => new Date(r.t) >= since); const by = {};
  for (const r of rows) { const k = r.cached ? 'cache' : r.model; by[k] = by[k] || { calls: 0, input: 0, output: 0, cost: 0 }; by[k].calls++; by[k].input += r.input || 0; by[k].output += r.output || 0; by[k].cost += r.cost || 0; }
  const live = rows.filter(r => !r.cached);
  return { calls: live.length, cacheHits: rows.length - live.length, output: live.reduce((a, r) => a + (r.output || 0), 0), cost: +live.reduce((a, r) => a + (r.cost || 0), 0).toFixed(4), by };
}

const cacheDir = () => ensureDir(path.join(home(), 'llm-cache'));
const keyOf = o => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex');

/** Build the claude CLI argv for a task. Exported for tests and dry runs. */
export function buildArgs({ task, prompt, system, schema, model, effort, maxTurns, mcpConfig, allowedTools, stream, settings = getSettings() }) {
  const T = TASKS[task] || {}; const a = ['-p', prompt, '--model', model, ...(stream ? ['--output-format', 'stream-json', '--verbose'] : ['--output-format', 'json']), '--no-session-persistence'];
  a.push('--max-turns', String(maxTurns ?? (T.computer ? 40 : T.web ? 20 : schema ? 3 : 2)));
  if (effort || T.effort) a.push('--effort', effort || T.effort);
  if (system) a.push('--append-system-prompt', system);
  if (schema) a.push('--json-schema', JSON.stringify(schema));
  if (T.web) { a.push('--tools', 'WebSearch,WebFetch', '--allowedTools', 'WebSearch', 'WebFetch', '--permission-mode', 'dontAsk', '--disable-slash-commands', '--strict-mcp-config'); }
  else if (T.computer) {
    a.push('--mcp-config', typeof mcpConfig === 'string' ? mcpConfig : JSON.stringify(mcpConfig), '--strict-mcp-config', '--disable-slash-commands', '--tools', '');
    if (allowedTools?.length) a.push('--allowedTools', ...allowedTools);
    a.push('--disallowedTools', ...DENY_BROWSER);
    a.push('--permission-mode', 'dontAsk');
  } else { a.push('--tools', '', '--disable-slash-commands', '--strict-mcp-config'); }
  return a;
}

function runCli(args, { cwd, bin, timeoutMs, stream, onEvent, stallMs }) {
  return new Promise((resolve, reject) => {
    const rc = resolveClaude(bin === 'claude' ? undefined : bin); // finds claude.exe / the npm package behind claude.cmd on Windows
    const env = { ...process.env, MCP_TIMEOUT: process.env.MCP_TIMEOUT || '90000', MCP_TOOL_TIMEOUT: process.env.MCP_TOOL_TIMEOUT || '120000' }; // give the browser component time to start
    const p = spawn(rc.cmd, [...rc.pre, ...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); let out = '', err = '', buf = '', final = null, done = false, last = Date.now();
    const finish = fn => { if (done) return; done = true; clearTimeout(to); clearInterval(wd); fn(); };
    const abort = msg => finish(() => { try { p.kill(); } catch {} reject(new Error(msg)); });
    const to = setTimeout(() => abort('Claude timed out'), timeoutMs);
    const wd = setInterval(() => { if (isCancelled()) return abort('Cancelled'); if (stallMs && Date.now() - last > stallMs) abort(`Claude stopped responding for ${Math.round(stallMs / 1000)} seconds, so Reelkit stopped it. Try again; if it repeats, run "node bin/reelkit.mjs browser-test" to see why.`); }, 1000);
    p.stdout.on('data', d => { last = Date.now(); if (!stream) { out += d; return; }
      buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue; let ev; try { ev = JSON.parse(line); } catch { continue; } if (ev.type === 'result') final = ev; try { onEvent && onEvent(ev, abort); } catch {} } });
    p.stderr.on('data', d => (err += d));
    p.on('error', e => finish(() => reject(new Error(e.code === 'ENOENT' ? 'Claude Code CLI not found. Install: npm i -g @anthropic-ai/claude-code, then run `claude` once to sign in.' : e.message))));
    p.on('close', code => finish(() => resolve({ code, out: stream ? (final ? JSON.stringify(final) : '') : out, err })));
  });
}
/** Human-readable line for a tool call Claude is making (shown live in the app). */
export function describeTool(name, input = {}) {
  const n = String(name).replace(/^mcp__playwright__/, ''); const short = u => { try { const x = new URL(u); return x.host + x.pathname + (x.search ? x.search.slice(0, 40) : ''); } catch { return String(u).slice(0, 60); } };
  switch (n) {
    case 'browser_navigate': return 'Opening ' + short(input.url); case 'browser_snapshot': return 'Reading the page'; case 'browser_take_screenshot': return 'Looking at the page';
    case 'browser_click': return 'Clicking ' + (input.element || 'an item'); case 'browser_type': return 'Typing'; case 'browser_press_key': return 'Pressing ' + (input.key || 'a key');
    case 'browser_wait_for': return 'Waiting for the page'; case 'browser_file_upload': return 'Uploading the video'; case 'browser_navigate_back': return 'Going back'; case 'browser_scroll': case 'browser_mouse_wheel': return 'Scrolling';
    case 'WebSearch': return 'Searching the web: ' + String(input.query || '').slice(0, 60); case 'WebFetch': return 'Reading ' + short(input.url);
    default: return n.replace(/^browser_/, '').replace(/_/g, ' ');
  }
}
const parseJsonOut = s => { try { return JSON.parse(s.trim().split('\n').filter(Boolean).pop()); } catch { return null; } };
export const extractJson = text => { if (typeof text !== 'string') return text; const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text]; const body = m[1]; const i = Math.min(...['{', '['].map(c => { const k = body.indexOf(c); return k < 0 ? 1e9 : k; })); try { return JSON.parse(body.slice(i)); } catch { try { return JSON.parse(body.slice(i, Math.max(body.lastIndexOf('}'), body.lastIndexOf(']')) + 1)); } catch { return null; } } };

/**
 * askClaude({task, prompt, system, schema, validate, key})
 *  - validate(out) -> true|string(reason): escalate to the next model if it fails (only when allowed)
 *  returns {output, model, cached, usage}
 */
export async function askClaude({ task, prompt, system, schema, validate, cacheKey, mcpConfig, allowedTools, maxTurns, cwd: workDir, timeoutMs = 180000, force = false, onProgress, log = () => {} }) {
  const settings = getSettings(); const T = TASKS[task]; if (!T) throw new Error('unknown task ' + task);
  let model = modelFor(task, settings); if (model === 'none') throw new Error(`task "${task}" is disabled in routing`);
  const ladder = T.escalate || validate ? MODELS.slice(MODELS.indexOf(model)).slice(0, 2) : [model]; // at most one escalation step
  const ck = keyOf({ task, prompt, system, schema, v: 1, ck: cacheKey });
  const cf = path.join(cacheDir(), ck + '.json');
  if (!force && settings.cache && T.ttlDays && fs.existsSync(cf)) {
    const c = readJson(cf, null); if (c && Date.now() - c.t < T.ttlDays * 864e5) { logUse({ t: new Date().toISOString(), task, model: c.model, cached: true }); return { output: c.output, model: c.model, cached: true, usage: null }; }
  }
  // chat replies have their own daily bucket so visitors can never starve content creation (and vice versa)
  const today0 = new Date(new Date().setHours(0, 0, 0, 0)); const rows = readLedger().filter(r => new Date(r.t) >= today0 && !r.cached); const isChat = task === 'chat_reply';
  const used = rows.filter(r => (r.task === 'chat_reply') === isChat).length; const cap = isChat ? (settings.budget.chatDaily ?? 200) : settings.budget.dailyCalls;
  if (used >= cap) throw new Error(isChat ? 'chat budget reached' : `Daily Claude call budget reached (${used}/${cap}). Raise it in the Claude tab or wait until tomorrow.`);
  if (!isChat && rows.filter(r => r.task !== 'chat_reply').reduce((a, r) => a + (r.output || 0), 0) >= settings.budget.dailyOutputTokens) throw new Error('Daily Claude output-token budget reached.');
  let lastErr = null;
  for (const m of ladder) {
    const stream = !!(T.computer || T.web); const args = buildArgs({ task, prompt, system, schema, model: m, mcpConfig, allowedTools, maxTurns, stream, settings });
    if (process.env.REELKIT_CLAUDE_DRYRUN) return { output: { dryRun: true, argv: args }, model: m, cached: false, usage: null };
    const cwd = workDir || fs.mkdtempSync(path.join(os.tmpdir(), 'reelkit-claude-')); const t0 = Date.now();
    log(`claude ${m} · ${task}`);
    const onEvent = (ev, abort) => {
      if (ev.type === 'system' && ev.subtype === 'init' && T.computer) { const bad = (ev.mcp_servers || []).filter(x => ['failed', 'needs-auth', 'disabled'].includes(x.status)); if (bad.length) return abort(`The browser-control component did not start (${bad.map(x => x.name + ': ' + x.status).join(', ')}). Check that Node.js is installed, then run "npm install" in the Reelkit folder and try again.`); log('Browser control connected'); }
      if (ev.type === 'assistant') for (const c of ev.message?.content || []) if (c.type === 'tool_use') { const line = describeTool(c.name, c.input); log(line); if (onProgress) onProgress(line); }
    };
    const r = await runCli(args, { cwd, bin: settings.claudeBin || 'claude', timeoutMs, stream, onEvent, stallMs: T.computer ? 150000 : T.web ? 180000 : 0 }); if (!workDir) fs.rmSync(cwd, { recursive: true, force: true });
    const j = parseJsonOut(r.out);
    if (!j) { lastErr = new Error('Claude returned no JSON: ' + (r.err || r.out).slice(0, 300)); continue; }
    const usage = { input: (j.usage?.input_tokens || 0) + (j.usage?.cache_creation_input_tokens || 0) + (j.usage?.cache_read_input_tokens || 0), output: j.usage?.output_tokens || 0, cost: j.total_cost_usd || 0, turns: j.num_turns };
    logUse({ t: new Date().toISOString(), task, model: m, ...usage, ms: Date.now() - t0, error: !!j.is_error });
    if (j.is_error) { lastErr = new Error(String(j.result || 'Claude error').slice(0, 300)); continue; }
    let out = j.structured_output ?? (schema ? extractJson(j.result) : j.result);
    if (schema && out == null) { lastErr = new Error('Claude did not return valid JSON'); continue; }
    if (validate) { const v = validate(out); if (v !== true) { lastErr = new Error('validation failed: ' + v); log(`validation failed on ${m}: ${v}${m !== ladder[ladder.length - 1] ? ' → escalating' : ''}`); continue; } }
    if (settings.cache && T.ttlDays) writeJson(cf, { t: Date.now(), model: m, output: out });
    return { output: out, model: m, cached: false, usage };
  }
  throw lastErr || new Error('Claude call failed');
}

export const claudeAvailable = () => !!resolveClaude(getSettings().claudeBin).found;
