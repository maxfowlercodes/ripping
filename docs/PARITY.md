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
