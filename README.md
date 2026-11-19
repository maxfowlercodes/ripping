# Reelkit: a free, local alternative to getripping.com

Make Instagram Reels that sell your product, end to end: **Swipe → Script → Produce → Post → Analyze → Repurpose**.
It runs on your own computer, uses Claude Code as the writer (optional), Chrome/Edge + ffmpeg as the video engine, and costs nothing. No account, no cloud, one npm dependency.

* Research the vendor and design decisions: [`docs/RESEARCH.md`](docs/RESEARCH.md) · what is built vs not: [`docs/PARITY.md`](docs/PARITY.md)

## What you get
| | |
|---|---|
| **Dashboard** (PWA, phone-friendly) | Swipe feed with outlier multipliers, script editor with Hook/Line/Comment tags, Produce (style picker, render progress, player, Virality Brain retention graph), Post calendar, Analyze (D1/D3/D7, who's watching, ranks), Repurpose (winners, carousel, hooks) |
| **Video engine** | Word-synced captions with key-word effects, animated counters, charts, **racing bars**, tier lists, terminal, checklists, phone screenshots; 20 styles; 16 languages incl. RTL and CJK; resumable renders |
| **Claude Code skills** | `reel-studio` (the whole pipeline) and `style-maker` (build your own style from a reference) |
| **Extras** | HeyGen avatar compositing, own-footage cutter (silences, fillers, audio cleanup, captions), `branch` variants, multi-account posting, trial reels, calibration against your own results |

## Install

**Windows 10/11 (no WSL):**
```powershell
git clone <this repo> ; cd ripping
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1   # Node, ffmpeg, Python via winget
npm install                                                            # playwright-core; it uses the Edge you already have
pip install edge-tts                                                   # optional free neural voices
npm install -g @anthropic-ai/claude-code                               # optional AI brain
node bin\reelkit.mjs doctor
```
**macOS / Linux:** install Node 18+, ffmpeg and Chrome/Chromium (or Edge), then `npm install` and `node bin/reelkit.mjs doctor`.

## Use it

**1. With Claude Code (recommended):** open this folder in Claude Code and say *"set up reels for <your product>"*, then *"make a reel about <topic>"*. The skill runs the pipeline and asks before anything is published.

**2. In the dashboard:** `node bin/reelkit.mjs dashboard` → http://localhost:4177. For your phone: `dashboard --lan`, open the printed link (it contains a private token), then *Add to Home Screen*. The dashboard also runs the render worker and the scheduler, so leave it open for scheduled posts.

**3. By CLI:** `node bin/reelkit.mjs` lists every command.
```
reelkit new "Stop giving out free trials"        # template script with visual directives
reelkit lint free-trials ; reelkit score free-trials
reelkit render free-trials --style orbit-dark --draft     # fast preview, then drop --draft
reelkit render free-trials --lang ja --voice edge          # other language
reelkit swipe discover creator1,creator2 --niche "SaaS founders"
reelkit queue free-trials --at 2026-11-20T08:00 --trial
reelkit analyze ; reelkit rank ; reelkit repurpose free-trials
```

### Script format
One line per beat. Hook first (≤ 8 words), one action last. Add visuals at the end of a line and mark key words:
```
Stop giving out *free* trials.
We onboarded 628 teams. {counter: 628 | teams onboarded | +64%}
Who wins? {bars: Claude=10>43.5, Lovable=5>30, Cursor=2>12 | Share of apps | %}
Comment *PLAYBOOK* and I'll send it.
```
Visuals: `counter`, `bars`, `chart`, `tier`, `code`, `list`, `big`, `image`, `screen` (see `.claude/skills/reel-studio/references/script-rules.md`).

### Connect Instagram, voices, avatars (all optional)
* Instagram posting/analytics/discovery: [`docs/INSTAGRAM.md`](docs/INSTAGRAM.md) then `reelkit account add main --user-id ID --token TOKEN`
* `reelkit key elevenlabs <key>` (best voices, exact caption timing) · `reelkit key heygen <key>` (avatars: `render --avatar heygen:<avatarId>:<voiceId>`)
* Keys are stored in `~/.reelkit/secrets.json` (mode 600), never in the repo.

### Suggested Claude Code permissions (apply yourself in `.claude/settings.json`)
I did not write this file for you, since it changes what Claude may do without asking. A sensible starting point: allow `Bash(node bin/reelkit.mjs:*)`, `Bash(ffmpeg:*)`, edits inside `reelkit-data/**` and `styles/custom/**`; deny reading `~/.reelkit/**` and `**/.env`, and deny `Bash(node bin/reelkit.mjs post:*)` so publishing always needs your explicit OK.

## Honest status
* **Tested here:** scripts/lint, the motion renderer (20 styles spot-checked; counters, bars, tiers, highlighter captions, Japanese, Hebrew RTL), per-scene resume, carousel PNGs, avatar chroma-key compositing (with a test clip), silence cutting, swipe import, analytics/ranks/D1-D3-D7 on simulated data, the dashboard API and UI (phone width, no JS errors), localhost/Host/path-traversal guards, 13 unit tests.
* **Written from official docs but not run live (needs your accounts/keys):** Instagram publishing (incl. trial reels), insights, Business Discovery; ElevenLabs; edge-tts; HeyGen; Windows SAPI voices; faster-whisper filler removal and caption burn-in.
* **Not built:** posting while your PC is off (run `reelkit worker` on an always-on machine), GPU/3D and illustrated styles, a trained virality model (the score is a transparent heuristic you can calibrate with `reelkit calibrate` after ~8 posts), community/coaching.
* Rendering takes roughly 1-3 minutes for a 30 s reel (frames are captured from a browser); `--draft` is ~4× faster.

Use only on accounts you own and follow Instagram's terms. Don't post fake claims or testimonials. This project is independent and unaffiliated with getripping.com, Meta, Anthropic, HeyGen or ElevenLabs.
