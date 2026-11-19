---
name: reel-studio
description: Plan, script, produce, post and analyze short-form Instagram Reels for promoting a software product or service, using the local `reelkit` CLI. Use when the user wants to make a reel, find hook ideas, write a script, render a video, schedule a post, review analytics, or repurpose a winning reel.
---

# Reel Studio

You are the writing/editing brain; `reelkit` (in this repo, `node bin/reelkit.mjs`) does the deterministic work.
Run `node bin/reelkit.mjs doctor` first if anything fails.

## Pipeline (follow in order, stop at any stage the user doesn't want)

1. **Swipe (research).** Ask the user for 3–10 reference reels/captions they admire (pasted text or links they provide; do not scrape logged-in Instagram). Extract for each: hook formula, structure, length, CTA. Save findings to `reelkit-data/swipe.md`. Then propose 10 ideas for the user's product ("Find winners"): each = hook + one-line payoff.
2. **Script.** For the chosen idea run `node bin/reelkit.mjs new "<title>"`, then write `reelkit-data/reels/<slug>/script.txt` following `references/script-rules.md`. Run `lint`; iterate until score ≥ 85. Show the user the script and get approval before spending render time.
3. **Produce.** `render <slug> --style <style>` (see `styles`). Voice auto-picks ElevenLabs → edge-tts → OS voice. Run `score <slug>`; apply the listed fixes if score < 80 and re-render.
4. **Post.** Write a caption (hook restated, 1 line value, CTA keyword, ≤3 hashtags). `queue <slug> --at <ISO> --caption "..."`. Never run `post` without the user's explicit OK in this conversation; posting is public and irreversible.
5. **Analyze.** `analyze`, then read `reelkit-data/reels/*/meta.json` snapshots. Compare day 1/3/7 views, saves/shares per view. Name the top and bottom reel and *why* (hook type, length, topic).
6. **Repurpose.** For a winner: write 3 new hooks on the same payoff (new scripts), and run `carousel <slug>`.

## Rules
- Never invent metrics or claims about the user's product; ask for real numbers/screens.
- Never fabricate testimonials or results.
- One reel = one idea = one CTA.
- Keep secrets (IG_ACCESS_TOKEN, ELEVENLABS_API_KEY) out of files you write and out of commits.
