---
name: reel-studio
description: Run the full short-form video pipeline for promoting a software product or service on Instagram Reels with the local `reelkit` CLI - research winners (swipe), write scripts, produce motion-graphics videos, schedule posts, analyze results, repurpose winners into new hooks and carousels. Use when the user wants to make a reel, find hook ideas, write or fix a script, render, schedule, review analytics, translate a reel, or repurpose a winner.
---

# Reel Studio

You are the writer, strategist and visual planner. `reelkit` (`node bin/reelkit.mjs`, run from the repo root) does the deterministic work: lint, render, post, analytics. Run `doctor` first if anything fails. Data lives in `reelkit-data/` (override with REELKIT_HOME).

Ask the user ONCE (and save to `reelkit-data/brand.md`): product, who it's for + their real problem, 3 proof points with real numbers, tone, languages, the CTA keyword. Never invent numbers, testimonials, or results. If a number is unknown, ask.

## 1. Swipe (research)  →  `references/research.md`
Find what's already winning in the niche, then extract formulas. Sources, in order: `swipe list --saved` (user's saved reels); competitor accounts via `swipe discover a,b,c --niche X` (official API, needs connected IG); references the user pastes (links + views). Never scrape logged-in Instagram. For each saved reel record: hook formula, structure, length, payoff, CTA, outlier multiplier. Write `reelkit-data/swipe-notes.md`. Then "Find winners": propose 10 ideas for THIS product, each = hook + one-line payoff + which saved reel it borrows structure from.

## 2. Script  →  `references/script-rules.md`
`new "<title>"`, then write `reelkit-data/reels/<slug>/script.txt`. One line = one beat. Beat 1 is the hook (≤ 8 words). Last beat = ONE action (comment a keyword). Plan visuals while writing: add a directive to lines that deserve one (see references/script-rules.md; counters for numbers, bars for comparisons, charts for trends, tiers for rankings, code for dev content, list for steps, screen for a website). Roughly one visual per 2-3 beats, vary the types. Mark key words with *asterisks*. Run `lint`; iterate to ≥ 85. Show the script and get approval before rendering.

## 3. Produce
`styles` lists styles; choose to fit the niche (dev tool → terminal/orbit-dark; fintech → mint-ledger; bold/consumer → volt/sunset). `render <slug> --style X [--voice ...] [--lang xx] [--draft]` (use `--draft` first, then the full render). Avatars: `--avatar heygen:<avatarId>:<voiceId>` (user's HeyGen key). Own footage: `footage <video> [--captions]`. Then `score <slug>` and apply the listed fixes (pinned to timestamps) if score < 80. Languages: write the script in the target language (translate faithfully, keep numbers and directives), render with `--lang`.

## 4. Post
Write a caption (hook restated, 1 line of value, the CTA keyword, ≤ 3 hashtags). `queue <slug> --at <ISO> --caption "..." [--account A] [--trial]`. Trial reels show to non-followers first; a good default for tests. NEVER run `post` (publish) unless the user explicitly says to publish in this conversation. Scheduled posts go out while `dashboard` or `worker` runs.

## 5. Analyze  →  `references/analysis.md`
`analyze`, then read the numbers. Compare D1/D3/D7, saves and shares per view, follower vs non-follower reach. Name the top and bottom reel and the likely reason (hook type, length, topic, visual). `calibrate` after 8+ posts shows which lint checks actually predict this account's views; say plainly when the sample is too small.

## 6. Repurpose
For a winner (`rank`/`analyze` marks them): `repurpose <slug>` renders the carousel and writes `repurpose.md`. Follow its task list: why it worked, 5 new hooks (different formulas) saved via `hooks <slug> --add`, 2 new scripts. `branch <slug> "<title>" --lines file` makes a variant that reuses the style and visuals with new words.

## Rules
- One reel = one idea = one CTA. No fake claims, fake testimonials, or invented stats.
- Keep secrets (tokens, API keys) out of files, commits and chat. They live in ~/.reelkit/secrets.json.
- Only operate on Instagram accounts the user owns. Follow Instagram's terms.
