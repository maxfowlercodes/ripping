# Reverse-engineering notes: Ripping (getripping.com)

Source: public marketing pages only (home, /refunds, /updates), fetched 2026-11-19. Everything below is the vendor's own claim
unless marked "inferred". No private code, traffic or accounts were accessed.

## What it is
"Turn Instagram into a money printer for your SaaS." A desktop worker + web dashboard that produces short-form Reels
for promoting software, driven by the **user's own Claude Code** (Max plan recommended). Ripping keeps no Claude token.

## Pipeline (6 stages)
| Stage | Ripping claim | Reelkit equivalent |
|---|---|---|
| Swipe | reads public IG pages, "Find winners" prompt | Claude skill step 1 (you supply references; no scraping) |
| Script | hook engine; checks: hook in 3 s, one idea/line, ending comment | `reelkit lint` (same rules, transparent) |
| Produce | voice (ElevenLabs/local), "29 scenes drawn to the words", HeyGen avatar, render | `reelkit render` (ffmpeg scenes, ElevenLabs/edge-tts/OS voices) |
| Post | post/schedule feed or trial reels, calendar | `queue` + `post --due` + dashboard calendar |
| Analyze | views/likes/shares/saves, day-1/3/7 curves | `analyze` + dashboard table |
| Repurpose | new hooks, carousels | skill step 6 + `carousel` |
| Virality Brain | 0-100 score "calibrated on real reels" | `score` — heuristic only, NOT trained (be skeptical of any vendor's calibration claim too) |

## Architecture (inferred from the changelog)
- Local **worker** process; each reel runs as a **Claude Code session** inside a sandbox (writes only its folder; network limited to vendor host, fonts, npm). Windows via WSL/Ubuntu + bubblewrap/socat. Setup installs Node, ffmpeg, Claude Code CLI.
- Web dashboard on Supabase/Vercel; setup progress and settings sync from there. Signed auto-updates between reels. Resume-from-saved-work for stalled reels.
- Styles = JS/React-ish motion templates ("kits"), some GPU-rendered; custom style = Claude generates a template from a reference reel.
- Pricing (re-verified on the #pricing section): **Growth** $99/mo (was $199), 7-day free trial, cancel anytime. Includes unlimited research and scripting, the video engine, up to 250 videos/mo, unlimited revisions, custom motion/screens/voices, 30 style kits, create-your-own style, analytics panel, HeyGen avatars, 10 sub-accounts, 10 Instagram accounts. Requires Claude Code (Max recommended), billed separately by Anthropic. **Done-For-You** $2,500/mo, 30-120 videos, weekly strategy sync, currently full (waitlist). No money-back guarantee.
- Not found: any Lifetime Offer on the homepage (the refunds page mentions one, with no price). The FAQ answers ("Can't I just use ChatGPT or Claude for this?", "My product isn't ready yet", "I don't have time") are in expanders a text fetch cannot open, so they are unknown.

## What Reelkit deliberately does differently
- Free, MIT, no account, no cloud, native Windows (no WSL), zero npm dependencies.
- ffmpeg-only renderer: reliable and portable, but simpler visuals than motion-graphics templates. Upgrade path: add Remotion/HyperFrames-style templates as new "renderers".
- No Instagram scraping (ToS risk). Research is user-supplied.
- Honest virality estimate: a documented heuristic, not a model.

## Not replicated
HeyGen avatars (add a provider in `src/voice.mjs`/render), footage cutting with filler removal (ffmpeg silenceremove + whisper — natural next step), community/coaching, GPU styles, trained retention model, mobile PWA (dashboard is responsive on your LAN).
