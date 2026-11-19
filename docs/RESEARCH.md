# Reverse-engineering notes: Ripping (getripping.com)

**Sources (all public, read 2026-11-19):** homepage (text + 11 phone screenshots supplied by the user), `/refunds`, `/updates` (61-release changelog), `/security`, `/terms` (§1–24.2). No private code, traffic, prompts, assets or accounts were accessed. Claims are the vendor's own unless marked *(inferred)*.

> Legal note: Ripping's Terms (§5.7, 8.2, 8.3) forbid *its users* from reverse engineering it or using it to build competing products. This repo is an independent implementation built only from public marketing/changelog/security pages, with original styles, names, code and designs. Read their Terms yourself before relying on this, and do not copy their assets, style names, prompts or branding.

## 1. What it is
"Turn Instagram into a money printer for your SaaS." A desktop **worker** plus a web dashboard that makes short-form Reels to sell software. All content generation runs on the *user's own computer* with the *user's own Claude Code* (Max plan recommended, "uses your own Claude usage"); Ripping stores no Claude token. Voice (ElevenLabs) and avatar (HeyGen) keys are the user's own and optional. The Instagram connection is stored server-side (encrypted token) so posts go out while the computer sleeps. Entity: Zogby LLC; founder-led coaching/community upsell.

## 2. Pipeline and UI (from the screenshots)
| # | Stage | Observed UI | Reelkit |
|---|---|---|---|
| 01 | **Swipe** | "My Feed", niche filter chip ("SaaS founders"), Tinder-style card stack, reject ✕ / undo ↶ / save ♥, view count (2.4M), **outlier multiplier badge** (14×, 31×), "Saved 4" | Swipe tab + `swipe` CLI; multiplier = views ÷ baseline; official Business Discovery import, CSV/JSON import, manual add |
| 02 | **Script** | Title, runtime (1:01), "Saved"; lines tagged **Hook**, body, **Comment** (CTA) | Script tab: live autosave, Hook/Line/Comment chips, runtime, lint |
| 03 | **Produce** | Production card with runtime, preview, progress bar; "your voice and your face" | Produce tab: style picker, voice/lang, draft/full render, job progress, player |
| 04 | **Post** | Weekly **Calendar** ("Week of Oct 5, 1 posted · 3 scheduled"), thumbnails, times 7:51/8:00 AM, Posted/Scheduled | Post tab calendar, schedule form, trial toggle, multi-account |
| 05 | **Analyze** | per-reel Views/Likes/Saves tiles, "Views since posting" curve, "Day 7" | Analyze tab: tiles, D1/D3/D7 columns, sparklines, who's watching, rank |
| 06 | **Repurpose** | **Winner** badge + views, **Carousel (4 slides, Ready)** with SWIPE cover + numbered slides, **New hooks from the winner** | Repurpose tab: winners, carousel (cover/steps/CTA), hooks list |

**Styles gallery:** "Pick a style → Ripping makes the reel", 36 styles, each card shows a phone preview, a New badge, a one-line description, and (for older styles) real @getripping view counts. Seen: HeyGen Presenter (avatar between motion graphics), Basic Motion (graphics + voice, no face), Ledger Mint, Bar Race Dark, Gradient Ribbon, Graphite Orbit. Preview content shows dashboard-card counters ("628", "2,036", "9,851") with growing line charts, racing bars, key-word highlighter wipes, "white key word" captions. "Or create your own custom style".

## 3. Feature inventory (homepage + changelog 0.1.0 → 0.4.60)
- **Research:** reads public Instagram pages locally (0.4.14), creators' bios (0.4.16), ideas generated one at a time, "Find winners" prompt; claims hooks "trained on 40M winners" *(unverifiable)*.
- **Script engine:** hook in 3 s, one idea per line, ending comment, matching on-screen text.
- **Voices:** ElevenLabs (optional) or free on-device voices (0.4.25); free voices in ES/FR/IT/PT (0.4.29); voice pitch, translate (0.4.60); HeyGen avatar voice (0.4.31). Retries up to 3 reads, keeps best take; captions always show the exact script (0.4.43).
- **Languages:** Russian, Ukrainian, Belarusian, Bulgarian, Macedonian, Serbian, Kazakh, Kyrgyz, Hebrew (RTL) (0.4.36); Japanese (no-space captions, on-demand font) (0.4.48); Hindi/Devanagari (0.4.56); Greek, Arabic (0.4.60).
- **Visual engine:** "29 scenes drawn to the words"; styles each have fonts, colors, backgrounds, key-word effect, transition, own music (0.4.23, 0.4.49); 24 new styles (cartoon, cut paper, clay, physics, 3D blocks, kinetic type, departure boards, Swiss posters, pixel art, VHS, liquid) (0.4.55); 6 more incl. GPU/3D styles (0.4.57); caption font picker (12 fonts, case/weight/size) (0.4.54); Look panel for colour/brightness/warmth/caption backing (0.4.53).
- **Own footage:** one take or several clips, cut word-for-word, fillers removed, sound cleaned, in every style (0.4.37, Macs first); on-device transcription, no ElevenLabs needed (0.4.52); iPhone HDR handled (0.4.53).
- **Branch:** new videos from a finished reel's shots/scenes/music with new words, using a small fraction of Claude usage (0.4.44).
- **Custom styles:** user's Claude builds a style from a reference reel/keyframe + dials (0.4.16–0.4.17); share Public styles after Ripping approves (SHA-256 frozen) (0.4.18).
- **Virality Brain:** 0–100 score, estimated retention graph, avg watch time, skip rate, fixes pinned to timestamps; "calibrated on real reels" *(unverifiable)*.
- **Post/Analyze:** schedule feed or trial reels; day-1/3/7 curves; account views/reach/followers; "who's watching" followers vs non-followers; 11 gamified ranks (Rookie → Icon, 0 → 100M views).
- **Accounts:** up to 10 IG accounts and 10 sub-accounts on Growth (0.4.22); Terms say one subscription = one individual/brand and one connected IG account unless agency features are enabled.
- **Mobile:** home-screen web app (not native).
- **Reliability:** resumable reels from saved work, stall detection, never-finish-as-plain-text-cards, ~3 h cap then simplified finish; Windows stays awake; auto-update between reels, signed releases (0.4.30+), rollback on failed start.

## 4. Architecture *(inferred from changelog + security page)*
- **Worker** runs as the user in `~/Ripping`; each reel = a Claude Code session driving a deterministic render toolchain (Node, ffmpeg, a browser engine "Ripping's own Chromium" for screenshots, GPU for some styles). Claude is the *planner/author of scenes*; code renders them.
- **Sandbox:** reel sessions can write only the Ripping folder, reach only the vendor host/fonts/npm, never see ElevenLabs/HeyGen keys (0.4.39–41; Mac sandbox, Linux/Windows via bubblewrap+socat in WSL). Writing/research jobs run Claude Code with *no tools in an empty folder*.
- **Control plane:** getripping.com (Supabase + Vercel Blob hints) dispatches jobs (reel, style, writing, research, voice/avatar changes, updates) to a paired computer; per-computer keys, owner-only pairing from same network + email notice, answers checked for account match.
- **Style supply chain:** styles are code; Public styles are reviewed, frozen and SHA-256 fingerprinted before other members' computers install them.

## 5. Pricing (re-verified on `#pricing`)
**Growth $99/mo** (was $199), 7-day trial, cancel anytime: unlimited research + scripting, video engine, up to 250 videos/mo, unlimited revisions, custom motion/screens/voices, 30 style kits, create-your-own style, analytics + growth panel, HeyGen avatars, 10 sub-accounts, 10 IG accounts. Requires Claude Code (Max recommended), billed by Anthropic separately. **Done-For-You $2,500/mo**, 30–120 videos, weekly strategy sync, currently full. **Lifetime Offer $397** one-off (Terms §7.11: course library, Growth plan without fees, 12 months group coaching, "Private Line"; "lifetime" = as long as the service is offered; all sales final). No money-back guarantee. FAQ answers are in expanders that a text fetch cannot read, so they are unknown.

## 6. Reelkit design decisions
- **Same shape, minus the server.** Everything local: CLI + dashboard + Claude Code skills; Claude Code is the author, deterministic code is the renderer.
- **Renderer:** HTML/CSS/SVG scenes in Chromium (your installed Edge/Chrome), a pure function of time `f(t)`, captured to frames and encoded by ffmpeg. Scenes are cached per beat, so renders resume. This is the same family of approach as HTML-to-video tools; it is what makes counters, racing bars, charts, and word-synced captions possible without a paid engine.
- **Style system:** 20 original built-in styles = 10 background engines × palettes, 3 caption modes, 4 key-word effects, plus a shared widget library (counter card, chart, racing bars with live re-ranking, tier list, terminal, checklist, phone screenshot). Custom styles are JS files (style-maker skill).
- **Instagram via official APIs only** (Content Publishing resumable upload, trial_params, insights, Business Discovery). No scraping.
- **Security:** secrets outside the repo (`~/.reelkit/secrets.json`, mode 600); dashboard binds to localhost, with a Host-header guard against DNS rebinding; `--lan` requires a private token; no auto-publish from the skill without explicit user consent.

## 7. API facts used (searched 2026-11-19; verify against Meta's current docs)
- Business Discovery: `GET /{ig-user-id}?fields=business_discovery.username(x){followers_count,media{like_count,comments_count,view_count,...}}`; read-only for Business/Creator accounts; `view_count` is the field for Business Discovery; like counts omitted if hidden; age-gated accounts not returned.
- Trial reels: Content Publishing API `trial_params={"graduation_strategy":"MANUAL"|"SS_PERFORMANCE"}` per Meta's changelog (Nov 2025); sources disagree on API graduation and limits; reelkit uses MANUAL and leaves graduation to the app.
- Insights: account `reach` supports `breakdown=follow_type` (follower/non-follower/unknown); metrics are moving from impressions to **views**; unsupported metric/breakdown combos return generic errors, so reelkit requests metrics one at a time and skips failures.


## 8. v0.3 design notes (how Reelkit maps to what the vendor does, and where it differs)
- **Claude as a controlled worker.** The vendor runs each reel as a Claude Code session in a sandbox and "writing/research" jobs with no tools in an empty folder. Reelkit does the same for text tasks (`--tools ""`, `--disable-slash-commands`, `--strict-mcp-config`, empty cwd) and adds per-task model routing, caching and budgets, because the stated goal is not to burn plan usage on small/easy work.
- **Posting.** The vendor stores an Instagram token server-side so posts go out while the PC sleeps. Reelkit's default is local: Claude drives a dedicated Chrome (CDP) through Playwright MCP, so no Meta developer app is needed; the Graph API path remains as an option. Trade-off: automation of the web UI is fragile and against Meta's terms; the review-before-share gate is on by default.
- **Reading data.** The vendor reads public Instagram pages locally (0.4.14) and creators' bios (0.4.16). Reelkit's `research` and web-insights tasks use the same idea via the logged-in dedicated browser (read-only prompts).
- **Own footage.** The vendor cuts "word for word with filler words removed" (0.4.37, Macs first) using on-device transcription (0.4.52). Reelkit uses faster-whisper (verbatim prompt, ffmpeg-decoded audio) + a word classifier + a cut planner that compresses pauses, with a click-to-override transcript.
- **Avatars.** The vendor offers HeyGen presenter videos. Reelkit adds free built-in vector presenters whose mouths follow the audio envelope; HeyGen is optional.
- **Reliability.** Vendor: resume from saved work, ~3 h cap. Reelkit: per-scene render cache, durable runs/jobs, worker in a child process, gates that wait indefinitely for you.
