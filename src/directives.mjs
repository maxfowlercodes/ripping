// Visual directives at the end of a script line:  Some words. {counter: 9851 | paying users | +64%}
// Mark key words with *asterisks*.
const num = s => Number(String(s).replace(/[, ]/g, ''));
export const DIRECTIVES = ['counter', 'chart', 'bars', 'tier', 'code', 'list', 'big', 'image', 'screen', 'none'];

export function splitDirective(line) {
  const m = line.match(/^(.*?)\s*\{\s*(\w+)\s*(?::\s*([^}]*))?\}\s*$/);
  if (!m || !DIRECTIVES.includes(m[2].toLowerCase())) return { text: line, visual: null };
  return { text: m[1].trim(), visual: parseVisual(m[2].toLowerCase(), (m[3] || '').trim()) };
}

export function parseVisual(type, arg) {
  const parts = arg.split('|').map(s => s.trim());
  switch (type) {
    case 'none': return { type: 'none' };
    case 'counter': return { type, value: num(parts[0]), label: parts[1] || 'TOTAL', delta: parts[2] || '', app: parts[3] };
    case 'chart': {
      const pts = parts[0].split(',').map(Number);
      return pts.length > 2 && pts.every(Number.isFinite) ? { type, points: pts, title: parts[1] } : { type, shape: parts[0] || 'up', title: parts[1] };
    }
    case 'bars': {
      const items = parts[0].split(',').map(s => { const [n, v] = s.split('='); const [a, b] = (v || '0').split('>'); return b == null ? { name: n.trim(), from: 0, to: num(a) } : { name: n.trim(), from: num(a), to: num(b) }; });
      return { type, items, title: parts[1] || '', unit: parts[2] || '' };
    }
    case 'tier': return { type, rows: parts[0].split(';').map(s => { const [t, v] = s.split('='); return { tier: t.trim().toUpperCase(), items: (v || '').split(',').map(x => x.trim()).filter(Boolean) }; }) };
    case 'code': return { type, text: arg };
    case 'list': return { type, items: arg.split(';').map(s => s.trim()).filter(Boolean) };
    case 'big': return { type, text: arg };
    case 'image': return { type, src: arg };
    case 'screen': return { type, url: arg };
  }
  return null;
}

/** Strip *key* markers and return {text, keys:Set of word indexes (0-based over whitespace-split words)} */
export function extractKeys(raw) {
  const words = raw.split(/\s+/).filter(Boolean); const keys = new Set(); const out = [];
  words.forEach((w, i) => { const m = w.match(/^([^\w*]*)\*+([^*]+)\*+([^\w*]*)$/); if (m) { keys.add(i); out.push(m[1] + m[2] + m[3]); } else out.push(w.replace(/\*/g, '')); });
  return { text: out.join(' '), keys };
}
