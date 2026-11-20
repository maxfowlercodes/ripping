// Background environment probes for the dashboard: slow spawns (python, where, claude) run asynchronously and are cached,
// so no API request ever waits on them.
import { probe, runAsync, PYTHON, isWin } from './util.mjs';
import { resolveClaudeAsync } from './claudebin.mjs';
import { getSettings, claudeEnv } from './claude.mjs';

const HAS = ['ffmpeg', 'ffprobe', 'cloudflared', 'edge-tts', 'espeak-ng', 'espeak', 'say', 'piper', 'notify-send', 'xclip', 'pbcopy'];
const PYMODS = ['faster_whisper', 'kokoro_onnx, soundfile', 'piper'];
let inflight = null, last = 0;

export function enableProbeMode() { probe.on = true; }
export async function refreshProbes({ maxAgeMs = 0 } = {}) {
  if (inflight) return inflight; if (Date.now() - last < maxAgeMs) return;
  inflight = (async () => {
    await Promise.all([
      ...HAS.map(async c => { const r = await runAsync(isWin ? 'where' : 'which', [c]); probe.map.set('has:' + c, r.ok && !r.missing); }),
      ...PYMODS.map(async m => { const r = await runAsync(PYTHON(), ['-c', `import ${m}`]); probe.map.set('py:' + m, r.ok); }),
      (async () => { const r = await runAsync(PYTHON(), ['--version']); probe.map.set('py:version', r.ok ? (r.out || r.err).trim() : ''); })(),
      (async () => {
        const c = await resolveClaudeAsync(getSettings().claudeBin); probe.map.set('claude:resolved', c); probe.map.set('has:claude', !!c.found);
        if (!c.found) return probe.map.set('claude:status', { installed: false, loggedIn: false });
        const r = await runAsync(c.cmd, [...c.pre, 'auth', 'status'], { timeout: 15000, env: { ...process.env, ...claudeEnv() } });
        try { const j = JSON.parse(r.out); probe.map.set('claude:status', { installed: true, loggedIn: !!j.loggedIn, method: j.authMethod }); } catch { const prev = probe.map.get('claude:status'); probe.map.set('claude:status', prev?.loggedIn ? { ...prev, stale: true } : { installed: true, loggedIn: false, unknown: true }); }
      })(),
    ]); last = Date.now();
  })().finally(() => { inflight = null; });
  return inflight;
}
