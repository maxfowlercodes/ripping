# Reelkit: a free, private Reels studio that Claude runs for you

**One click:** *references → idea → script → motion-graphics video (with a lip-synced presenter) → caption → post to Instagram → track results.*
Runs on your own computer. Claude Code is the brain (your own plan, used sparingly); Chrome/Edge + ffmpeg are the studio; your Instagram is operated by Claude through a dedicated browser window. No subscription, no cloud.

Research on the product this is modelled on: [`docs/RESEARCH.md`](docs/RESEARCH.md) · what is built vs. untested: [`docs/PARITY.md`](docs/PARITY.md)

## What's in it
| Area | What you get |
|---|---|
| **Today (home)** | Big **Make & Post** button, run timeline, inbox (daily check-in, "any new references?", approve ideas, *review before sharing*), idea queue, usage meter |
| **Claude control** | Eco / Balanced / Quality modes, per-task model table (haiku/sonnet/opus), result cache, daily call + token budgets, usage ledger, cheap-first escalation. See below |
| **Computer use** | Claude drives a dedicated Chrome profile (Playwright MCP): posts the reel, reads insights, researches competitors. Browser survives between calls, so there is a real *prepare → you review → share* gate |
| **Motion templates v2** | 30 styles, transitions (wipe/flash/zoom/glitch), camera pushes, grain, 17 widgets (counter, charts, **racing bars**, tier list, chat, notifications, donut, compare, timeline, browser, price, stats…), word-exact captions with key-word effects |
| **Presenters** | Free built-in animated avatars (founder, robot, blob) lip-synced to the real audio; blink, brow-raise on key words, hand gestures. HeyGen supported if you have a key |
| **Footage cutter** | Your own video: Whisper transcript → removes um/uh, "you know", stutters, dead air (click words to override) → punch-ins, audio cleanup, loudness → captions in any style |
| **Voices** | Piper (offline, free), ElevenLabs, edge-tts, OS voices; 16 languages incl. RTL/CJK; captions are aligned to the real audio with Whisper |
| **Daily routine** | Asks for references and today's focus at your chosen time, shows yesterday's numbers, proposes ideas, can auto-run if you don't answer |
| **Swipe / Analyze / Repurpose** | Outlier multipliers, D1/D3/D7 curves, ranks, carousels, hooks from winners (all as before) |
| **App** | Electron desktop app with tray + native notifications + start-at-login, or a no-install Edge/Chrome app window |

## Install (Windows)
```powershell
git clone <this repo> ; cd ripping
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
```
That installs Node + Python (winget), runs `npm install` (renderer + bundled ffmpeg), installs Piper + Whisper, downloads one offline voice, creates a **Desktop shortcut**, and runs `doctor`. Optional: `scripts\create-shortcut.ps1 -AtLogin` to start Reelkit at login (needed for scheduled posts / daily check-ins while you're away). Install Claude Code and sign in once: `npm i -g @anthropic-ai/claude-code`, then `claude`.

macOS/Linux: Node 18+, Chrome/Chromium, `npm install`, `pip install piper-tts faster-whisper`, `node bin/reelkit.mjs voices install en`, `node bin/reelkit.mjs doctor`.

**The app:** double-click the Desktop shortcut (Edge/Chrome app window, nothing else to install), or `npm run app` for the Electron app, or `npm run dist:win` to build a Windows installer (build it on Windows; Electron couldn't be downloaded in my test environment, so the Electron shell is **untested**).

## First run (5 minutes)
1. **Setup tab → Your brand.** Product, audience, their real problem, CTA keyword, and **real proof points** (`teams switched = 212`). Claude may only use numbers you list here.
2. **Setup → Posting → "Open Reelkit browser"** and log in to Instagram once (stored in a dedicated profile, never in the repo).
3. **Today → Make & Post.** It asks for 3+ reference reels first (paste `url | views | account size | caption`), then does the rest and stops before Share so you can look at it. Switch to *post automatically* when you trust it.

## How Claude is controlled (and kept cheap)
Everything goes through one function (`src/claude.mjs`):
* **Code first, model second.** Never sent to a model: lint, virality score, rendering, caption timing, filler cutting, scheduling, analytics math, winner detection, carousel layout, scoring, calendars.
* **Right model per task** (editable in the Claude tab or `reelkit route <task> haiku|sonnet|opus|auto`). *Eco*: haiku for ideas, lint fixes, captions, hooks, analysis, translation, **and browser posting**; sonnet only for script writing and style design. Nothing uses Opus unless you pick *Quality* or override it.
* **Cheap-first escalation.** Computer-use tasks try the small model and validate the result; only on failure do they escalate one step.
* **Cache:** identical prompts cost nothing (verified: second call = 0 usage).
* **Pure-text calls run with no tools, no skills, no MCP, in an empty folder** (small prompt, safe). Computer-use calls get exactly one MCP server and only the reel's folder for uploads.
* **Budgets:** daily call and output-token caps stop runaway loops. `reelkit usage` shows spend.
* Measured in my test run (Eco, real calls): references→idea→script→lint→caption was **6 model calls, 5 haiku + 1 sonnet, ≈ 4.9k output tokens, ≈ $0.03 list-price equivalent**. Computer-use posting on haiku took 2 short calls (~20 s) against the mock site, but it reads page snapshots so it uses far more *input* tokens than writing tasks. Expect real Instagram to cost more.

## CLI (everything the app does)
```
reelkit autopilot [--post review|auto|none] [--at ISO]    # one-click Make & Post
reelkit autopilot status | answer <id> --action share|cancel|manual-done | resume <id>
reelkit mode eco|balanced|quality ; reelkit route <task> haiku ; reelkit usage ; reelkit claude   # control + test Claude
reelkit brand set product "..." ; reelkit refs add "url | views | baseline | caption" ; reelkit ideas --generate
reelkit research --handles a,b            # Claude browses and lists outlier reels into Swipe
reelkit footage my-video.mp4 --level standard --style volt     # cut fillers + caption
reelkit render <reel> --style presenter-night --avatar founder --voice piper
reelkit browser ; reelkit inbox ; reelkit daily ; reelkit dashboard --open|--lan ; reelkit worker
```
Script visuals and the `style-maker` / `reel-studio` skills are as in `.claude/skills/`.

## Honest status
**Tested for real in this repo's environment:** the whole pipeline with live Claude calls (haiku + sonnet) including the reference gate, idea → script → lint → render → caption; Piper voice; Whisper alignment; the footage cutter on real synthesized speech (10.15 s → 6.58 s, fillers removed, captions overlaid) through the app's API with the worker in a child process; avatar lip-sync; 20+ widgets/styles by eye; Japanese and Hebrew; the web app in a browser (no JS errors); **Claude operating Chrome via Playwright MCP against a mock Instagram-style page** (upload → caption → stop → separate call → share, verified on the page); 27 unit tests.
**Not tested (needs your machine/accounts):** the real Instagram website (its UI changes and my prompts may need tuning; **Meta's terms restrict automation of the web UI and your account could be challenged or limited. Your risk; keep volumes human-like and keep *review before sharing* on at first**), the Electron shell and all Windows scripts, ElevenLabs/HeyGen/edge-tts, Instagram Graph API publishing/insights.
**Limits:** presenters are friendly cartoon characters, not photoreal (a photoreal talking head needs HeyGen or a GPU lip-sync model, not included); Whisper sometimes mishears "uh" (hence the click-to-override transcript); scheduled posts and the daily routine only run while the app is running; no GPU/3D styles.
This is a private tool: independent of and unaffiliated with getripping.com, Meta, Anthropic, HeyGen or ElevenLabs. Read Ripping's Terms and Instagram's terms yourself.
