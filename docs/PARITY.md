# Parity matrix: Ripping vs Reelkit (honest)
✅ built and tested here · 🟡 built, untested live (needs your keys/accounts) · ⛔ not built

| Capability | Ripping | Reelkit |
|---|---|---|
| Swipe feed with save/skip/undo, niche filter, outlier multiplier | yes | ✅ (UI, keyboard, touch swipe, CSV/JSON import) · 🟡 official Business Discovery import |
| Reads public IG pages for you | yes | ⛔ deliberately (ToS risk); you import or use Discovery |
| Script editor: hook/body/comment tags, runtime, autosave | yes | ✅ + 9-rule linter |
| AI writing/research | your Claude Code | ✅ same idea: Claude Code skills (reel-studio, style-maker) |
| Motion graphics: counters, charts, racing bars, tiers, terminal, lists, phone screens | 36 styles | ✅ 20 styles + 7 widgets; custom styles via JS |
| Word-synced captions + key-word effects | yes | ✅ (estimated timing; exact with ElevenLabs timestamps 🟡) |
| Voices | ElevenLabs + on-device | ✅ OS voices (SAPI/say/espeak) · 🟡 edge-tts, ElevenLabs |
| 15+ languages incl. RTL, CJK, Devanagari | yes | ✅ RTL/CJK layout + tokenizer · 🟡 voices per language |
| HeyGen avatar presenter | yes | 🟡 API + chroma-key compositing (compositing ✅ with a test clip) |
| Own footage: cut silences/fillers, clean audio | yes (Macs first) | ✅ silence cut + loudnorm · 🟡 filler words/captions need `pip install faster-whisper` |
| Branch (variants reusing style/visuals) | yes | ✅ `branch` |
| Resumable renders, job queue, worker | yes | ✅ per-scene cache + durable jobs |
| Calendar, schedule, trial reels, multi-account | yes | ✅ UI/queue · 🟡 live publishing |
| Posting while your computer is off | yes (their server) | ⛔ needs an always-on machine running `reelkit worker` |
| Analytics: views/likes/saves/shares, D1/3/7, who's watching, ranks | yes | ✅ (verified with simulated data) · 🟡 live insights |
| Virality Brain 0–100 + retention graph + timestamped fixes | yes ("calibrated") | ✅ transparent heuristic + `calibrate` against *your* results (not a trained model) |
| Repurpose: winners, carousel (cover/steps), new hooks | yes | ✅ carousel PNGs · hooks via Claude skill |
| Mobile | home-screen web app | ✅ PWA over LAN with private token |
| GPU/3D styles, cut-paper/clay/pixel-art etc. | yes | ⛔ (add as style plugins) |
| Community, coaching, signed auto-updates, sandboxed Claude sessions | yes | ⛔ (git pull; scope Claude Code's permissions yourself, see README) |


## v0.3 additions
| Capability | Status |
|---|---|
| One-click Make & Post with durable, resumable runs and gates (brand, references, review-before-share, login) | ✅ real run verified (post step set to render-only) |
| Claude model routing per task, Eco/Balanced/Quality, cache, budgets, usage ledger, cheap-first escalation | ✅ verified with real `claude -p` calls |
| Claude operates the browser (post / insights / competitor research) | ✅ post flow verified on a local mock site (haiku, 2 calls) · ⛔ **not verified on real Instagram** |
| Daily check-in (references, focus, ideas) + optional auto-run + notifications | ✅ check-in created by the worker; 🟡 OS notifications untested |
| Motion v2: transitions, camera, grain, 9 new widgets, 10 new styles (30 total) | ✅ |
| Built-in lip-synced presenters (founder/robot/blob) | ✅ (cartoon, not photoreal) |
| HeyGen avatar | 🟡 API + chroma-key compositing; untested with a key |
| Filler-word/stutter/pause cutting with transcript editor, captions in style | ✅ real speech, Whisper base.en · note Whisper may mishear "uh" |
| Piper offline voices + Whisper-exact caption timing for any voice | ✅ |
| Desktop app (Electron + tray + native notifications + start at login) | 🟡 written, **untested** (Electron download blocked here); no-install Edge/Chrome app window path ✅ logic, 🟡 on Windows |
| Windows installer/shortcut scripts | 🟡 untested (no Windows machine) |


## v0.4 additions
| Capability | Status |
|---|---|
| Kokoro + Piper offline voices, provider catalog with previews | ✅ audio verified by Whisper transcription (I cannot judge naturalness) |
| Edge voices | 🟡 untested here (network); ElevenLabs 🟡 (your key later) |
| Generated sound effects (whoosh, pop, thud) | ✅ |
| 50 styles with tags, thumbnails, chooser (code + Claude shortlist) | ✅ |
| First-run deep research (4 web stages, sourced report, ideas, digest) | ✅ real run |
| Business chat with lead capture, FAQ grounding, rate limits, own budget | ✅ real conversation + browser test · 🟡 public tunnel untested |
| Leads tab (status, transcript, CSV, delete) | ✅ |
| In-app Guide with self-ticking checklist + docs/GUIDE.md | ✅ |


## v0.5 additions
| Capability | Status |
|---|---|
| Setup wizard (10 steps, resumable) with computer check, whitelisted one-click installers, Claude sign-in/test, spend mode | ✅ rendered and clicked through in a browser; installers' *whitelist* and API tested · 🟡 actual installs not run here (they hit the network/pip/winget) |
| Autofill business details from your website | ✅ real run (one haiku web call) |
| Instagram login auto-detection (session cookie in the Reelkit browser) | ✅ tested with real headless Chrome · 🟡 not against real Instagram |
| Apple-style redesign (sidebar, tab bar, switches, segmented controls, dialogs, light/dark, custom icons) | ✅ screenshotted light, dark, mobile |
| Keynote-style video templates (dark, light, graphite) | ✅ |
| In-app API key fields (ElevenLabs, HeyGen) saved to a private 0600 file, never returned | ✅ |
| Start-with-Windows (scheduled task) from the wizard | 🟡 untested (no Windows machine) |
