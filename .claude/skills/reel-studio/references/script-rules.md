# Script rules (what `reelkit lint` enforces)
- Format: `# Title`, optional `[style: aurora-dark]`, then one beat per line. `//` lines are notes.
- Beat 1 is the hook: ≤ 8 words; speak to "you", ask a question, or name a number/outcome. Must land in 3 seconds.
- Every line ≤ 14 words, one idea. A new visual every ~3 seconds ⇒ 5–14 beats, 12–45 s total.
- Last beat: ONE action (comment a keyword, follow, save). Comment-keyword CTAs drive reach.
- No filler words. At least one concrete number.

## Visual directives (end of a line)
| Directive | Example | Use for |
|---|---|---|
| `{counter: N \| label \| delta}` | `{counter: 628 \| teams onboarded \| +64%}` | a headline number with a growing chart |
| `{bars: A=from>to, B=to \| title \| unit}` | `{bars: Claude=10>43.5, Lovable=5>30 \| Share of apps \| %}` | races / comparisons (bars re-rank live) |
| `{chart: up\|down\|s\|flat}` or `{chart: 1,3,8,20}` | `{chart: down \| Churn}` | trends |
| `{tier: S=A,B; A=C}` | `{tier: S=Claude; A=Cursor,Copilot}` | rankings |
| `{code: text}` | `{code: npm i reelkit}` | typed terminal command |
| `{list: a; b; c}` | `{list: Hook; Proof; CTA}` | steps/checklists |
| `{big: text}` | `{big: 3x}` | one huge stat |
| `{screen: URL}` | `{screen: https://example.com/pricing}` | captures the page as a phone screenshot |
| `{image: path}` | `{image: shots/dash.png}` | your own screenshot |
| `{none}` | | suppress the auto big-number |
Key words: `*word*` gets the style's highlight effect. Numbers are highlighted automatically.

## Hook formulas
1. Mistake: "Stop doing X if you want Y."  2. Result-first: "I got N customers from one reel."  3. Contrarian: "Everyone says X. They're wrong."  4. Question: "Why does nobody ____?"  5. Before/after: "From 0 to N in M days. Here's how."  6. Stakes: "If you're doing X in 2026, you're lighting money on fire."

## Skeleton
Hook → Problem (stakes) → Why it happens → Fix 1 → Fix 2 → Proof/number → CTA
