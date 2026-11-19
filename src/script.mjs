// Script format: plain text, one line = one scene/beat. First line = hook, last line = CTA.
// Optional first line "# Title". Lines starting with // are notes. "[style: x]" directive allowed.
export function parseScript(text) {
  const lines = text.split(/\r?\n/);
  let title = '', style = null;
  const beats = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (!l || l.startsWith('//')) continue;
    if (l.startsWith('# ')) { title = l.slice(2).trim(); continue; }
    const m = l.match(/^\[style:\s*([\w-]+)\]$/i);
    if (m) { style = m[1].toLowerCase(); continue; }
    beats.push(l);
  }
  return { title, style, beats };
}

const words = s => s.split(/\s+/).filter(Boolean);
const POWER = /\b(you|your|stop|never|secret|mistake|free|how|why|\$\d|\d+x|\d+k|nobody|everyone|worst|best|truth|before|without)\b/i;
const FILLER = /\b(um|uh|like|basically|actually|literally|just|really|very)\b/gi;
const CTA = /\b(comment|dm|follow|link in bio|save|share|send|reply|type)\b/i;

/** Lint a script. Returns {checks:[{id,pass,msg,weight}], score, speakSeconds}. */
export function lint(script) {
  const { beats } = script;
  const checks = [];
  const add = (id, pass, msg, weight) => checks.push({ id, pass, msg, weight });
  const total = beats.reduce((n, b) => n + words(b).length, 0);
  const speak = total / 2.6; // ~156 wpm
  const hook = beats[0] || '';
  const hookWords = words(hook).length;
  const hookSecs = hookWords / 2.6;

  add('hook-length', hookWords > 0 && hookSecs <= 3.2, `Hook is ${hookWords} words (~${hookSecs.toFixed(1)}s). Keep it ≤ 8 words so it lands inside 3 seconds.`, 20);
  add('hook-power', POWER.test(hook) || /\?$/.test(hook), 'Hook should address "you", pose a question, or promise a specific outcome/number.', 15);
  add('one-idea', beats.every(b => words(b).length <= 14), 'Every line should carry one idea (≤ 14 words). Split long lines.', 12);
  add('length', speak >= 12 && speak <= 45, `Runtime ≈ ${speak.toFixed(0)}s. Sweet spot is 12–45s.`, 12);
  add('filler', !beats.some(b => (b.match(FILLER) || []).length > 1), 'Cut filler words (just, really, basically…).', 8);
  add('cta', CTA.test(beats[beats.length - 1] || ''), 'Last line needs one clear action (comment a keyword, follow, save…).', 15);
  add('beats', beats.length >= 5 && beats.length <= 14, `${beats.length} beats. 5–14 keeps visual pace up (a new visual every ~3s).`, 8);
  add('pacing', new Set(beats.map(b => words(b).length)).size > 2, 'Vary line lengths so the rhythm is not monotone.', 5);
  add('numbers', beats.some(b => /\d/.test(b)), 'At least one concrete number makes claims credible.', 5);

  const maxW = checks.reduce((n, c) => n + c.weight, 0);
  const got = checks.reduce((n, c) => n + (c.pass ? c.weight : 0), 0);
  return { checks, score: Math.round((got / maxW) * 100), speakSeconds: speak };
}

/** Heuristic "virality brain": estimated retention curve + scored report. Transparent heuristics, not a trained model. */
export function virality(script, durations) {
  const l = lint(script);
  const t = durations?.length ? durations : script.beats.map(b => words(b).length / 2.6 + 0.4);
  const total = t.reduce((a, b) => a + b, 0);
  const hookStrength = (l.checks.find(c => c.id === 'hook-length').pass ? 0.5 : 0) + (l.checks.find(c => c.id === 'hook-power').pass ? 0.35 : 0) + 0.15;
  let retention = 100 * (0.55 + 0.35 * hookStrength); // % surviving past 3s
  const curve = [];
  let acc = 0, avg = 0, prev = 100;
  const decayPerBeat = 1 - (l.score >= 80 ? 0.035 : l.score >= 60 ? 0.07 : 0.12);
  script.beats.forEach((b, i) => {
    const start = acc; acc += t[i];
    const r = i === 0 ? retention : curve[i - 1].pct * decayPerBeat;
    curve.push({ at: +start.toFixed(1), pct: +r.toFixed(1), line: b });
    avg += ((prev + r) / 2 / 100) * t[i]; prev = r;
  });
  const fixes = l.checks.filter(c => !c.pass).map(c => ({ id: c.id, fix: c.msg }));
  const worst = curve.reduce((m, p, i, a) => (i && a[i - 1].pct - p.pct > (m.drop || 0) ? { drop: a[i - 1].pct - p.pct, i } : m), {});
  if (worst.i != null) fixes.push({ id: 'dropoff', at: curve[worst.i].at, fix: `Biggest estimated drop-off at ${curve[worst.i].at}s ("${curve[worst.i].line}"). Add a pattern interrupt or visual change here.` });
  return { score: l.score, estSkipRate: +(100 - retention).toFixed(0), avgWatchSeconds: +avg.toFixed(1), duration: +total.toFixed(1), curve, fixes };
}
