// Built-in styles: configuration objects consumed by RK.engine. Original designs (not copies of any vendor's styles).
(function () {
  const R = window.RK.registerStyle;
  const cap = (o) => Object.assign({ mode: 'words', size: 118, sizeVis: 100, weight: 800, align: 'center' }, o);

  R('aurora-dark',  { desc: 'Violet-to-peach ribbon on deep navy, highlighter key words', font: 'Inter', bg: 'ribbon', key: 'highlight',
    colors: { bg1: '#0b1022', bg2: '#4c1d95', ribbon1: '#7c3aed', ribbon2: '#fb923c', accent: '#fde68a', accent2: '#fb923c', fg: '#ffffff', keyFg: '#1e1b4b', card: '#ffffff', cardFg: '#0f172a', muted: '#c7d2fe' }, caption: cap({}) });
  R('aurora-light', { extends: 'aurora-dark', desc: 'Same ribbon on a bright ground',
    colors: { bg1: '#f8fafc', bg2: '#c7d2fe', ribbon1: '#a78bfa', ribbon2: '#fdba74', accent: '#4f46e5', fg: '#0f172a', keyFg: '#ffffff', muted: '#475569' } });
  R('orbit-dark',   { desc: 'Near-black with a lunar rim of light, gradient key words', font: 'Inter', bg: 'rim', key: 'gradient',
    colors: { bg1: '#05060b', bg2: '#1b1450', accent: '#8b5cf6', accent2: '#22d3ee', fg: '#f8fafc', keyFg: '#05060b', card: '#0f1324', cardFg: '#e5e7eb', muted: '#94a3b8' }, caption: cap({ weight: 700 }) });
  R('orbit-light',  { extends: 'orbit-dark', colors: { bg1: '#f4f6ff', bg2: '#dbe4ff', accent: '#4f46e5', accent2: '#06b6d4', fg: '#0b1020', card: '#ffffff', cardFg: '#0b1020' } });
  R('mint-ledger',  { desc: 'Fintech calm: mint dot-grid, green highlighter', font: 'Inter', bg: 'dots', key: 'highlight',
    colors: { bg1: '#f0fdf4', bg2: '#d1fae5', dot: '#16a34a26', accent: '#4ade80', fg: '#052e16', keyFg: '#052e16', card: '#ffffff', cardFg: '#052e16', muted: '#166534' }, caption: cap({}) });
  R('mint-ledger-dark', { extends: 'mint-ledger', bg: 'grid', colors: { bg1: '#06140d', bg2: '#0a2418', dot: '#4ade8018', accent: '#4ade80', fg: '#ecfdf5', keyFg: '#052e16', card: '#0d2a1c', cardFg: '#ecfdf5' } });
  R('volt',         { desc: 'Kinetic type: one huge word at a time, black and yellow', font: 'Inter', bg: 'flat', key: 'color',
    colors: { bg1: '#000000', bg2: '#1b0033', accent: '#e6ff00', accent2: '#ff00aa', fg: '#ffffff', keyFg: '#000000', card: '#111111', cardFg: '#ffffff' }, caption: cap({ mode: 'oneword', size: 180, sizeVis: 130, weight: 900, upper: true, ls: '-0.04em' }) });
  R('volt-pink',    { extends: 'volt', colors: { accent: '#ff2bd6', accent2: '#00e5ff', keyFg: '#000000' } });
  R('newsroom',     { desc: 'Breaking-news desk with ticker', font: 'Inter', bg: 'news', key: 'underline', ticker: 'BREAKING • LIVE • JUST IN • ',
    colors: { bg1: '#0f172a', bg2: '#7f1d1d', accent: '#facc15', fg: '#ffffff', keyFg: '#111111', card: '#ffffff', cardFg: '#0f172a' }, caption: cap({ mode: 'block', size: 80, sizeVis: 70, upper: true, weight: 900 }), zones: { capTopFree: 380, capHFree: 800 } });
  R('paper',        { desc: 'Cream paper with editorial serif', font: "Georgia,'Playfair Display','Times New Roman'", bg: 'paper', key: 'underline',
    colors: { bg1: '#f5efe3', bg2: '#fffaf0', accent: '#c2410c', fg: '#1c1917', keyFg: '#fff', card: '#fffdf8', cardFg: '#1c1917' }, caption: cap({ mode: 'block', weight: 700, ls: '-0.01em' }) });
  R('paper-ink',    { extends: 'paper', colors: { bg1: '#15110d', bg2: '#241d16', accent: '#fb923c', fg: '#fef3c7', card: '#241d16', cardFg: '#fef3c7' } });
  R('terminal',     { desc: 'Developer terminal, phosphor green', font: "ui-monospace,'Cascadia Code',Menlo,Consolas", bg: 'grid', key: 'highlight',
    colors: { bg1: '#020b05', bg2: '#04170a', dot: '#22c55e18', accent: '#22c55e', fg: '#bbf7d0', keyFg: '#022c22', card: '#06140a', cardFg: '#bbf7d0' }, caption: cap({ weight: 700, size: 74, sizeVis: 62, ls: '0' }) });
  R('terminal-amber', { extends: 'terminal', colors: { accent: '#f59e0b', fg: '#fde68a', dot: '#f59e0b18', bg2: '#1a1103', card: '#140e03', cardFg: '#fde68a', keyFg: '#1a1103' } });
  R('sunset',       { desc: 'Warm sunset gradient', font: 'Inter', bg: 'gradient', key: 'highlight',
    colors: { bg1: '#ff7e5f', bg2: '#6a1b9a', accent: '#ffe66d', fg: '#ffffff', keyFg: '#3b0764', card: '#ffffff', cardFg: '#1f2937' }, caption: cap({}) });
  R('ocean',        { extends: 'sunset', colors: { bg1: '#0ea5e9', bg2: '#1e1b4b', accent: '#fef08a', keyFg: '#082f49' } });
  R('swiss-red',    { desc: 'Swiss poster: flush-left bold upper-case', font: 'Inter', bg: 'swiss', key: 'highlight',
    colors: { bg1: '#f4f1ea', bg2: '#e11d48', accent: '#e11d48', fg: '#111111', keyFg: '#ffffff', card: '#ffffff', cardFg: '#111111' }, caption: cap({ align: 'left', upper: true, weight: 900, size: 100, sizeVis: 80, ls: '-0.03em', valign: 'flex-start' }), zones: { capTop: 210, capTopFree: 300, capHFree: 900 } });
  R('swiss-blue',   { extends: 'swiss-red', colors: { bg2: '#1d4ed8', accent: '#1d4ed8' } });
  R('vhs',          { desc: 'Scanlines and glow', font: 'Inter', bg: 'scan', key: 'gradient',
    colors: { bg1: '#150a2e', bg2: '#2a0a3d', accent: '#ff3df5', accent2: '#00f0ff', fg: '#f5f3ff', keyFg: '#150a2e', card: '#1a0f35', cardFg: '#f5f3ff' }, caption: cap({ weight: 900, shadow: '3px 0 #ff00aa88,-3px 0 #00f0ff88' }) });
  R('clean-white',  { desc: 'Minimal white', font: 'Inter', bg: 'flat', key: 'highlight', progressBar: true,
    colors: { bg1: '#ffffff', bg2: '#f1f5f9', accent: '#2563eb', fg: '#0f172a', keyFg: '#ffffff', card: '#f8fafc', cardFg: '#0f172a' }, caption: cap({}) });
  R('clean-black',  { extends: 'clean-white', colors: { bg1: '#000000', bg2: '#0a0a0a', accent: '#38bdf8', fg: '#ffffff', keyFg: '#001018', card: '#111827', cardFg: '#f9fafb' } });
})();
