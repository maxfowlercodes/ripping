---
name: style-maker
description: Create a custom video style for reelkit from a reference reel/screenshot or a description. Use when the user wants "my own style", a brand-matched look, or to copy the vibe (not the content) of a reference video they provide.
---

# Style maker
A style is a JS file in `styles/custom/<name>.js` (loaded automatically; also from `reelkit-data/styles/`). Most styles are configuration extending a built-in; write code only for something truly new.

1. Get the reference: a screenshot/keyframe the user provides, plus brand colors and fonts if any. Describe the look in 5 properties: background, caption layout, key-word effect, card look, motion pace.
2. Start from the closest built-in (`node bin/reelkit.mjs styles`) and override with `extends`:
```js
window.RK.registerStyle('acme-night', {
  extends: 'orbit-dark',
  desc: 'Acme brand: ink background, lime highlighter',
  font: "'Space Grotesk',Inter",
  bg: 'grid',                 // gradient | ribbon | rim | dots | grid | scan | news | paper | swiss | flat
  key: 'highlight',           // highlight | gradient | underline | color
  colors: { bg1: '#0a0a0a', bg2: '#151515', accent: '#c6ff3d', fg: '#ffffff', keyFg: '#0a0a0a', card: '#141414', cardFg: '#fff' },
  caption: { mode: 'words', size: 118, sizeVis: 100, weight: 800, upper: false, align: 'center' }, // mode: words | oneword | block
});
```
3. New background: `window.RK.backgrounds.myBg = (layer, cfg, C) => { /* build DOM in layer */ return t => { /* update for time t */ }; }` (must be a pure function of t: no randomness, no real time).
4. Render a draft with a test script: `render <slug> --style acme-night --draft --voice silent`; inspect frames with `ffmpeg -ss 3 -i draft.mp4 -frames:v 1 f.png` and look at them. Iterate until it reads well at phone size (captions inside the 90px side margins, nothing important in the bottom 340px).
5. Never embed a third party's brand assets or copy another vendor's templates; take inspiration only.
