# Reelkit — a free, local alternative to getripping.com

Make Instagram Reels for your product: **swipe → script → voice → render → post → analyze → repurpose**.
Runs on your PC. Uses your own Claude Code as the writer (optional), ffmpeg as the editor. No subscription, no cloud, no dependencies.

Why this shape: Ripping itself is a local worker + your Claude Code. A **CLI + Claude Code skill** is the most effective copy:
works on Windows natively, scriptable, the skill provides the "brain", and a small local web dashboard gives the app feel. See `docs/RESEARCH.md`.

## Install (Windows)
```powershell
git clone <this repo> ; cd ripping
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1   # Node, ffmpeg, Python via winget
pip install edge-tts                                                   # optional free neural voice
npm install -g @anthropic-ai/claude-code                              # optional AI brain
node bin\reelkit.mjs doctor
```
macOS/Linux: install Node 18+ and ffmpeg, then the same `doctor`.

## Use
**With Claude Code (recommended):** open this folder in Claude Code and say *"make me a reel about <your product>"*. The `reel-studio` skill drives everything.

**By hand:**
```
node bin/reelkit.mjs new "Stop posting dead reels"   # edit the script.txt it prints
node bin/reelkit.mjs lint stop-posting-dead-reels
node bin/reelkit.mjs render stop-posting-dead-reels --style hyper-volt
node bin/reelkit.mjs score stop-posting-dead-reels
node bin/reelkit.mjs dashboard                        # http://localhost:4177
```
Voice auto-selects: ElevenLabs (`ELEVENLABS_API_KEY`) → edge-tts → Windows SAPI / macOS `say` / espeak → silent.
Posting & analytics: see `docs/INSTAGRAM.md`; schedule with `scripts/schedule-windows.ps1`.

## Status (honest)
Tested here: lint, score, render (video 1080×1920), carousel, unit tests. **Not tested live:** Instagram posting/insights, ElevenLabs, edge-tts, Windows SAPI path.
Visuals are text-on-gradient scenes — clean but simpler than Ripping's motion templates. The score is a heuristic, not a trained model.
Use only on accounts you own and follow Instagram's terms; don't post fake claims or testimonials.
