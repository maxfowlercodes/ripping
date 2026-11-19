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

  // ---- v2 styles: transitions, camera moves, grain, presenters
  R('mesh-glow',    { desc: 'Drifting colour-mesh glow, gradient key words, wipe transitions', font: 'Inter', bg: 'mesh', key: 'gradient', transition: 'wipe', grain: 0.08,
    colors: { bg1: '#07070f', bg2: '#312e81', accent: '#a78bfa', accent2: '#34d399', ribbon1: '#f472b6', fg: '#ffffff', keyFg: '#07070f', card: '#12121f', cardFg: '#f1f5f9' }, caption: cap({}) });
  R('neon-night',   { desc: 'Floating particles, neon highlighter, glitch cuts', font: 'Inter', bg: 'particles', key: 'highlight', transition: 'glitch', grain: 0.06,
    colors: { bg1: '#05010f', bg2: '#1a0b3d', accent: '#22d3ee', accent2: '#f0abfc', fg: '#ffffff', keyFg: '#05010f', card: '#100824', cardFg: '#f5f3ff' }, caption: cap({ weight: 900 }) });
  R('bold-stripes', { desc: 'Sports-broadcast stripes, flash cuts, upper-case', font: 'Inter', bg: 'stripes', key: 'highlight', transition: 'flash', camera: 0.045,
    colors: { bg1: '#facc15', bg2: '#eab308', accent: '#111827', fg: '#111827', keyFg: '#facc15', card: '#ffffff', cardFg: '#111827' }, caption: cap({ upper: true, weight: 900, ls: '-0.03em' }) });
  R('spotlight',    { desc: 'Stage spotlight on black, warm underline key words', font: 'Inter', bg: 'spotlight', key: 'underline', transition: 'zoom', grain: 0.07,
    colors: { bg1: '#050505', bg2: '#27272a', accent: '#fbbf24', fg: '#fafafa', keyFg: '#050505', card: '#18181b', cardFg: '#fafafa' }, caption: cap({ weight: 800 }) });
  R('blueprint',    { desc: 'Technical blueprint grid, mono caption, typed feel', font: "ui-monospace,'Cascadia Code',Menlo,Consolas", bg: 'blueprint', key: 'highlight', transition: 'wipe',
    colors: { bg1: '#0b3a8f', bg2: '#0a2a6b', dot: '#ffffff1f', accent: '#fde047', fg: '#ffffff', keyFg: '#0a2a6b', card: '#0e47b0', cardFg: '#ffffff' }, caption: cap({ weight: 700, size: 78, sizeVis: 66, ls: '0' }) });
  R('chat-pop',     { desc: 'Pastel candy with big chat bubbles', font: 'Inter', bg: 'gradient', key: 'highlight', transition: 'zoom',
    colors: { bg1: '#fde68a', bg2: '#fbcfe8', accent: '#ec4899', fg: '#3b0764', keyFg: '#ffffff', card: '#ffffff', cardFg: '#1f2937' }, caption: cap({ weight: 900 }) });
  R('presenter-night', { desc: 'Glowing voice orb that pulses with the narration, over a mesh glow', font: 'Inter', bg: 'mesh', key: 'highlight', transition: 'wipe', grain: 0.06, avatar: { character: 'orb' },
    colors: { bg1: '#080818', bg2: '#3730a3', accent: '#818cf8', accent2: '#c084fc', ribbon1: '#38bdf8', fg: '#ffffff', keyFg: '#0b0b24', card: '#14142b', cardFg: '#f1f5f9' }, caption: cap({}) });
  R('presenter-day',   { desc: 'Animated presenter on a bright ribbon', font: 'Inter', bg: 'ribbon', key: 'highlight', transition: 'zoom', avatar: { character: 'orb' },
    colors: { bg1: '#f8fafc', bg2: '#c7d2fe', ribbon1: '#a78bfa', ribbon2: '#fdba74', accent: '#4f46e5', fg: '#0f172a', keyFg: '#ffffff', card: '#ffffff', cardFg: '#0f172a' }, caption: cap({}) });
  R('presenter-bot',   { extends: 'presenter-night', desc: 'Robot presenter, terminal vibes', bg: 'grid', avatar: { character: 'robot' }, colors: { bg1: '#04110a', bg2: '#06240f', dot: '#22c55e18', accent: '#22d3ee', fg: '#e6fffa', keyFg: '#04110a', card: '#0a1f14', cardFg: '#e6fffa' } });
  R('presenter-blob',  { extends: 'presenter-day', desc: 'Friendly blob mascot presenter', bg: 'gradient', avatar: { character: 'blob' }, colors: { bg1: '#ffedd5', bg2: '#fecdd3', accent: '#ea580c', fg: '#431407', keyFg: '#ffffff' } });

  // ---- v3 styles (21 more)
  R('synthwave',       { desc: 'Retro sun and neon grid floor', font: 'Inter', bg: 'synthwave', key: 'gradient', transition: 'glitch', grain: 0.05,
    colors: { bg1: '#12002b', bg2: '#4a0d67', accent: '#ff2bd6', accent2: '#ffe14d', fg: '#ffffff', keyFg: '#12002b', card: '#1d0640', cardFg: '#fdf4ff' }, caption: cap({ weight: 900, upper: true, ls: '-0.02em', shadow: '0 0 24px #ff2bd699' }) });
  R('sunrise-waves',   { desc: 'Warm gradient with slow layered waves', font: 'Inter', bg: 'waves', key: 'highlight', transition: 'wipe',
    colors: { bg1: '#ffedd5', bg2: '#fdba74', accent: '#ea580c', accent2: '#f43f5e', ribbon1: '#fb7185', fg: '#431407', keyFg: '#ffffff', card: '#ffffff', cardFg: '#431407' }, caption: cap({}) });
  R('ocean-waves',     { desc: 'Cool blue waves, calm and trustworthy', font: 'Inter', bg: 'waves', key: 'underline', transition: 'zoom',
    colors: { bg1: '#e0f2fe', bg2: '#7dd3fc', accent: '#0369a1', accent2: '#0ea5e9', ribbon1: '#38bdf8', fg: '#082f49', keyFg: '#fff', card: '#ffffff', cardFg: '#082f49' }, caption: cap({ weight: 700 }) });
  R('confetti-party',  { desc: 'Falling confetti, loud and happy', font: 'Inter', bg: 'confetti', key: 'highlight', transition: 'zoom', camera: 0.04,
    colors: { bg1: '#7c3aed', bg2: '#c026d3', accent: '#fde047', accent2: '#22d3ee', ribbon1: '#fb7185', fg: '#ffffff', keyFg: '#3b0764', card: '#ffffff', cardFg: '#2e1065' }, caption: cap({ weight: 900 }) });
  R('pop-halftone',    { desc: 'Comic pop-art halftone, shouty upper-case', font: "Impact,'Arial Black',Inter", bg: 'halftone', key: 'highlight', transition: 'flash', camera: 0.05,
    colors: { bg1: '#fde047', bg2: '#ef4444', accent: '#111827', fg: '#111827', keyFg: '#fde047', card: '#ffffff', cardFg: '#111827' }, caption: cap({ upper: true, weight: 900, ls: '0.01em', size: 124, sizeVis: 104, shadow: '4px 4px 0 #ffffff' }) });
  R('checker-bold',    { desc: 'Black/white checkerboard with pill captions', font: 'Inter', bg: 'checker', key: 'highlight', transition: 'flash',
    colors: { bg1: '#ffffff', bg2: '#e5e7eb', accent: '#ef4444', fg: '#ffffff', pill: '#111827', pillFg: '#ffffff', keyFg: '#ffffff', card: '#ffffff', cardFg: '#111827' }, caption: cap({ pill: true, weight: 800, size: 100, sizeVis: 84 }) });
  R('sunburst',        { desc: 'Rotating sunburst rays, game-show energy', font: 'Inter', bg: 'rays', key: 'highlight', transition: 'zoom', camera: 0.04,
    colors: { bg1: '#dc2626', bg2: '#f97316', accent: '#fde047', fg: '#ffffff', keyFg: '#7f1d1d', card: '#ffffff', cardFg: '#7f1d1d' }, caption: cap({ weight: 900, upper: true, shadow: '0 6px 0 #7f1d1d' }) });
  R('bokeh-dream',     { desc: 'Soft glowing bokeh, dreamy and gentle', font: 'Inter', bg: 'bokeh', key: 'gradient', transition: 'zoom', grain: 0.05,
    colors: { bg1: '#1e1b4b', bg2: '#581c87', accent: '#f9a8d4', accent2: '#93c5fd', ribbon1: '#fcd34d', fg: '#ffffff', keyFg: '#1e1b4b', card: '#2a2260', cardFg: '#fdf2f8' }, caption: cap({ weight: 700 }) });
  R('matrix-rain',     { desc: 'Falling code rain, hacker terminal', font: "ui-monospace,'Cascadia Code',Menlo,Consolas", bg: 'matrix', key: 'highlight', transition: 'glitch',
    colors: { bg1: '#000a03', bg2: '#001a08', accent: '#00ff66', fg: '#d1fae5', keyFg: '#00140a', card: '#03140a', cardFg: '#bbf7d0' }, caption: cap({ weight: 700, size: 76, sizeVis: 64, ls: '0' }) });
  R('cinema-noir',     { desc: 'Black-and-white spotlight, letterbox, serif', font: "Georgia,'Playfair Display','Times New Roman'", bg: 'spotlight', key: 'underline', transition: 'zoom', camera: 0.025, letterbox: 150, grain: 0.1,
    colors: { bg1: '#050505', bg2: '#3f3f46', accent: '#e5e5e5', fg: '#fafafa', keyFg: '#050505', card: '#18181b', cardFg: '#fafafa' }, caption: cap({ weight: 700, ls: '0', size: 96, sizeVis: 84 }), zones: { capTop: 230, capTopFree: 480, capH: 560, visTop: 820, visH: 700 } });
  R('podcast-karaoke', { desc: 'Calm dark mesh; every word shown, current word lights up', font: 'Inter', bg: 'mesh', key: 'color', transition: 'flash', grain: 0.05,
    colors: { bg1: '#0a0a14', bg2: '#27224f', accent: '#fbbf24', accent2: '#60a5fa', ribbon1: '#a78bfa', fg: '#e2e8f0', keyFg: '#0a0a14', card: '#15152b', cardFg: '#e2e8f0' }, caption: cap({ mode: 'karaoke', weight: 800, size: 92, sizeVis: 78 }) });
  R('tiktok-pill',     { desc: 'White caption pills on a punchy gradient', font: 'Inter', bg: 'gradient', key: 'highlight', transition: 'wipe',
    colors: { bg1: '#f43f5e', bg2: '#7c3aed', accent: '#fde047', fg: '#111827', pill: '#ffffff', pillFg: '#111827', keyFg: '#111827', card: '#ffffff', cardFg: '#111827' }, caption: cap({ pill: true, weight: 900, size: 96, sizeVis: 82 }) });
  R('notebook',        { desc: 'Handwritten notebook paper, red-marker key words', font: "'Segoe Print','Bradley Hand','Comic Sans MS','Marker Felt',cursive", bg: 'paper', key: 'underline', transition: 'wipe',
    colors: { bg1: '#fffdf5', bg2: '#fef9c3', accent: '#dc2626', fg: '#1e3a8a', keyFg: '#fff', card: '#ffffff', cardFg: '#1e3a8a' }, caption: cap({ mode: 'block', weight: 700, ls: '0', size: 96, sizeVis: 80 }) });
  R('kraft-stamp',     { desc: 'Brown kraft paper, bold stamped upper-case', font: "Impact,'Arial Black',Inter", bg: 'flat', key: 'highlight', transition: 'flash',
    colors: { bg1: '#c8a27a', bg2: '#b98c60', accent: '#7f1d1d', fg: '#2a1a0c', keyFg: '#fef3c7', card: '#f5e6c8', cardFg: '#2a1a0c' }, caption: cap({ upper: true, weight: 900, ls: '0.02em', size: 118, sizeVis: 98 }) });
  R('sticky-note',     { desc: 'Yellow sticky-note energy, friendly and casual', font: "'Segoe Print','Bradley Hand','Comic Sans MS',cursive", bg: 'flat', key: 'underline', transition: 'zoom',
    colors: { bg1: '#fde047', bg2: '#facc15', accent: '#dc2626', fg: '#27272a', keyFg: '#fff', card: '#fffbeb', cardFg: '#27272a' }, caption: cap({ mode: 'block', weight: 700, ls: '0', size: 100, sizeVis: 84 }) });
  R('glass',           { desc: 'Frosted-glass cards over a colour mesh', font: 'Inter', bg: 'mesh', key: 'gradient', transition: 'zoom', grain: 0.06, glass: true,
    colors: { bg1: '#0f172a', bg2: '#1d4ed8', accent: '#67e8f9', accent2: '#f0abfc', ribbon1: '#a78bfa', fg: '#ffffff', keyFg: '#0f172a', card: 'rgba(255,255,255,0.14)', cardFg: '#ffffff' }, caption: cap({}) });
  R('mono-minimal',    { desc: 'Quiet white space, thin giant type', font: 'Inter', bg: 'flat', key: 'underline', transition: 'none', camera: 0.015, progressBar: false,
    colors: { bg1: '#ffffff', bg2: '#f4f4f5', accent: '#111111', fg: '#111111', keyFg: '#fff', card: '#fafafa', cardFg: '#111111' }, caption: cap({ weight: 300, size: 124, sizeVis: 104, ls: '-0.04em' }) });
  R('luxury-gold',     { desc: 'Black and gold serif, slow and premium', font: "Georgia,'Playfair Display','Times New Roman'", bg: 'spotlight', key: 'gradient', transition: 'zoom', camera: 0.02, grain: 0.07,
    colors: { bg1: '#0a0a0a', bg2: '#2b2112', accent: '#d4af37', accent2: '#f5e6a8', fg: '#f8f4e8', keyFg: '#0a0a0a', card: '#14110a', cardFg: '#f8f4e8' }, caption: cap({ weight: 600, ls: '0', size: 100, sizeVis: 86 }) });
  R('sage-calm',       { desc: 'Soft sage greens, wellness and care', font: 'Inter', bg: 'dots', key: 'highlight', transition: 'zoom', camera: 0.015,
    colors: { bg1: '#f3f7f1', bg2: '#dbe8d4', dot: '#4d7c0f22', accent: '#a3c585', fg: '#27401c', keyFg: '#27401c', card: '#ffffff', cardFg: '#27401c' }, caption: cap({ weight: 700 }) });
  R('fintech-clean',   { desc: 'Crisp blue-on-white, numbers first', font: 'Inter', bg: 'dots', key: 'highlight', transition: 'flash',
    colors: { bg1: '#f8fafc', bg2: '#e0e7ff', dot: '#1d4ed822', accent: '#2563eb', fg: '#0b1b3a', keyFg: '#ffffff', card: '#ffffff', cardFg: '#0b1b3a' }, caption: cap({ weight: 800 }) });

  // ---- keynote-style: restrained, big type, one accent
  const SF = "-apple-system,'SF Pro Display','Segoe UI Variable Display','Segoe UI',Inter";
  R('keynote-dark',    { desc: 'Pure black, large confident type, one blue-to-violet accent', font: SF, bg: 'flat', key: 'gradient', transition: 'none', camera: 0.018, progressBar: false,
    colors: { bg1: '#000000', bg2: '#0b0b0f', accent: '#2997ff', accent2: '#bf5af2', fg: '#f5f5f7', keyFg: '#000', card: '#1c1c1e', cardFg: '#f5f5f7' }, caption: cap({ weight: 650, size: 120, sizeVis: 100, ls: '-0.035em' }) });
  R('keynote-light',   { desc: 'Soft white, large type, calm blue accent', font: SF, bg: 'flat', key: 'gradient', transition: 'none', camera: 0.018, progressBar: false,
    colors: { bg1: '#fbfbfd', bg2: '#f5f5f7', accent: '#0071e3', accent2: '#5e5ce6', fg: '#1d1d1f', keyFg: '#fff', card: '#ffffff', cardFg: '#1d1d1f' }, caption: cap({ weight: 650, size: 120, sizeVis: 100, ls: '-0.035em' }) });
  R('keynote-graphite',{ desc: 'Graphite grey with a warm accent, premium and quiet', font: SF, bg: 'rim', key: 'gradient', transition: 'zoom', camera: 0.02, progressBar: false, grain: 0.05,
    colors: { bg1: '#161618', bg2: '#2a2a2e', accent: '#ff9f0a', accent2: '#ff375f', fg: '#f5f5f7', keyFg: '#161618', card: '#232326', cardFg: '#f5f5f7' }, caption: cap({ weight: 600, size: 116, sizeVis: 98, ls: '-0.03em' }) });

  // ---- tags: used by the style chooser (mood, niches, energy 1-5, light/dark)
  const T = (m, n, e, tone) => ({ mood: m.split(' '), niches: n.split(' '), energy: e, tone });
  const TAGS = {
    'aurora-dark': T('friendly techy', 'saas dev-tools creator b2b', 3, 'dark'), 'aurora-light': T('friendly calm', 'saas coaching education b2b', 3, 'light'),
    'orbit-dark': T('techy serious', 'dev-tools saas fintech b2b', 3, 'dark'), 'orbit-light': T('techy calm', 'dev-tools saas b2b', 3, 'light'),
    'mint-ledger': T('calm serious', 'fintech b2b legal real-estate', 2, 'light'), 'mint-ledger-dark': T('calm techy', 'fintech crypto saas', 2, 'dark'),
    volt: T('bold energetic', 'creator gaming fitness ecommerce', 5, 'dark'), 'volt-pink': T('bold energetic playful', 'creator ecommerce fitness', 5, 'dark'),
    newsroom: T('serious dramatic', 'b2b legal nonprofit education', 4, 'dark'), paper: T('cozy serious', 'education coaching creator', 2, 'light'), 'paper-ink': T('cozy dramatic', 'education creator', 2, 'dark'),
    terminal: T('techy retro', 'dev-tools saas', 3, 'dark'), 'terminal-amber': T('techy retro', 'dev-tools', 3, 'dark'), sunset: T('friendly playful', 'creator coaching ecommerce', 3, 'dark'), ocean: T('calm friendly', 'coaching health saas', 2, 'dark'),
    'swiss-red': T('bold serious', 'agency b2b creator', 4, 'light'), 'swiss-blue': T('serious minimal', 'agency b2b fintech', 3, 'light'), vhs: T('retro playful', 'gaming creator ecommerce', 4, 'dark'),
    'clean-white': T('minimal calm', 'saas b2b education', 2, 'light'), 'clean-black': T('minimal serious', 'saas dev-tools', 2, 'dark'),
    'mesh-glow': T('friendly techy', 'saas creator ai', 3, 'dark'), 'neon-night': T('energetic techy', 'gaming creator saas', 4, 'dark'), 'bold-stripes': T('bold energetic', 'ecommerce fitness local-business', 5, 'light'),
    spotlight: T('dramatic serious', 'coaching creator legal', 2, 'dark'), blueprint: T('techy serious', 'dev-tools b2b real-estate', 3, 'dark'), 'chat-pop': T('playful friendly', 'ecommerce coaching kids', 4, 'light'),
    'presenter-night': T('friendly techy', 'saas creator ai', 3, 'dark'), 'presenter-day': T('friendly calm', 'coaching saas education', 3, 'light'), 'presenter-bot': T('techy playful', 'dev-tools ai saas', 3, 'dark'), 'presenter-blob': T('friendly playful', 'kids education ecommerce', 3, 'light'),
    synthwave: T('retro energetic', 'gaming creator', 4, 'dark'), 'sunrise-waves': T('warm friendly', 'coaching health food local-business', 2, 'light'), 'ocean-waves': T('calm serious', 'health fintech coaching legal', 2, 'light'),
    'confetti-party': T('playful energetic', 'kids ecommerce creator events', 5, 'dark'), 'pop-halftone': T('bold energetic playful', 'ecommerce fitness local-business', 5, 'light'), 'checker-bold': T('bold energetic', 'creator ecommerce fitness', 4, 'light'),
    sunburst: T('bold energetic', 'ecommerce local-business fitness events', 5, 'dark'), 'bokeh-dream': T('calm dreamy', 'coaching health creator', 1, 'dark'), 'matrix-rain': T('techy retro', 'dev-tools security ai', 3, 'dark'),
    'cinema-noir': T('dramatic serious luxury', 'legal luxury coaching creator', 2, 'dark'), 'podcast-karaoke': T('calm friendly', 'coaching creator education', 2, 'dark'), 'tiktok-pill': T('energetic playful', 'creator ecommerce fitness', 5, 'dark'),
    notebook: T('cozy friendly', 'education coaching kids creator', 2, 'light'), 'kraft-stamp': T('bold cozy', 'food local-business ecommerce', 4, 'light'), 'sticky-note': T('playful cozy', 'education coaching creator', 3, 'light'),
    glass: T('friendly techy luxury', 'saas ai fintech', 3, 'dark'), 'mono-minimal': T('minimal luxury calm', 'saas luxury agency', 1, 'light'), 'luxury-gold': T('luxury dramatic', 'luxury real-estate coaching legal', 1, 'dark'),
    'keynote-dark': T('minimal luxury calm', 'saas luxury agency ai creator', 1, 'dark'), 'keynote-light': T('minimal calm friendly', 'saas education coaching ai', 1, 'light'), 'keynote-graphite': T('luxury calm dramatic', 'luxury saas agency', 2, 'dark'),
    'sage-calm': T('calm cozy', 'health coaching food', 1, 'light'), 'fintech-clean': T('serious calm', 'fintech saas b2b real-estate', 2, 'light'),
  };
  for (const n in TAGS) if (window.RK.styles[n]) window.RK.styles[n].tags = TAGS[n];

  // transitions for the originals
  ['aurora-dark', 'aurora-light'].forEach(n => (window.RK.styles[n].transition = 'zoom'));
  ['orbit-dark', 'orbit-light', 'mint-ledger', 'mint-ledger-dark', 'clean-white', 'clean-black'].forEach(n => { window.RK.styles[n].transition = 'flash'; });
  window.RK.styles['vhs'].transition = 'glitch'; window.RK.styles['volt'].transition = 'flash'; window.RK.styles['newsroom'].transition = 'wipe';
})();
