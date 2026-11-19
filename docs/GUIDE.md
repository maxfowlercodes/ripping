# Reelkit guide (plain steps)

Time to first reel: about 30 minutes, most of it downloads and the one-time research.

## 0. What you need
| Needed | For | Get it |
|---|---|---|
| Node.js 18+ | everything | nodejs.org (or `winget install OpenJS.NodeJS.LTS`) |
| Chrome or Edge | video rendering, posting | already on Windows (Edge) |
| Python 3.10+ | free voices, transcription | python.org (or `winget install Python.Python.3.12`) |
| Claude Code + a Claude plan | writing, research, posting, chat | `npm i -g @anthropic-ai/claude-code`, then run `claude` once and sign in |
| Instagram account | posting | yours |
| Optional: ElevenLabs key, HeyGen key, Instagram API | nicer voices, photoreal avatar, posting while the PC is off | add later, none are required |

## 1. Install (Windows)
1. Download this repo, open PowerShell in the folder.
2. `powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1`. If it says to reopen PowerShell, do, then run it again.
3. Start it with the **Reelkit** shortcut on your Desktop (or `npm start`).
4. The setup wizard opens. Follow it. When it finishes, the **Guide** tab keeps a self-ticking checklist.

macOS/Linux: `npm install`, `pip install piper-tts faster-whisper kokoro-onnx soundfile`, `node bin/reelkit.mjs doctor`.

## 2. First-run setup
The **setup wizard opens by itself** the first time and does everything below with buttons (installs, sign-in, autofill, voice previews, Instagram login detection). Use this section only if you want to know what each step does or to redo one. You can reopen the wizard any time from Settings → *Run the setup wizard again*.

The Guide tab ticks these off by itself:
1. **Claude**: Claude tab → *Test Claude connection*. Set mode to **Eco** (cheapest).
2. **Brand**: Setup → Your brand. Be concrete: what it is, who it is for, their real problem, a CTA word (e.g. PLAYBOOK). Under *Proof points* write one per line as `claim = number` using only real numbers. Add your website URL.
3. **Deep research** (once): Research tab → *Run*. Four stages: your site, your audience (their own words), competitors, strategy. About 5 to 10 minutes. You get a report with sources, a "do not say" list, content pillars and 10 starter ideas. Items it could not verify are labelled.
4. **Voice**: Setup → Voice. Press **Preview** on a few. Best free: **Kokoro** (`pip install kokoro-onnx soundfile` then `node bin\reelkit.mjs voices install kokoro`). ElevenLabs: `node bin\reelkit.mjs key elevenlabs <key>` whenever you are ready; it then shows as "ready".
5. **Instagram login**: Setup → Posting → *Open Reelkit browser*, log in to Instagram in that window once, press *I logged in* in the Guide. (This is a separate browser profile; Reelkit never sees your password.)
6. **References**: Today → paste 3 reels that did well in your niche: `url | views | account size | caption`. Claude copies the structure, never the words.

## 3. Make a reel
* **One click**: Today → **Make & Post**. Keep *review before sharing* on at first. It writes the script, picks a style that fits, renders, writes the caption, prepares the post in the browser and stops at Share. Look, then press **Share it**.
* **By hand**: Script tab (edit text, see the checks) → Produce tab (pick a style from the gallery, press Preview on a voice, Render).
* **Your own footage**: Footage tab → choose a video → *Transcribe* → click any word to keep or cut it → *Cut & caption*.

## 4. Business chat and leads (optional)
1. Leads tab → turn on, write a tagline, a welcome line and a FAQ (`Q:` / `A:`). The assistant only knows your brand facts + this FAQ + the research digest, and says "I'm not sure, the owner will follow up" otherwise.
2. A link appears. For a **public** link, install cloudflared once (`winget install Cloudflare.cloudflared`) and restart the app; Reelkit opens a free temporary tunnel. The address changes every restart; for a stable link use a named Cloudflare tunnel on your own domain (see Cloudflare docs).
3. Put the link in your Instagram bio and tell viewers to comment your CTA word.
4. Visitors enter name, email and what they need (with a consent tick), then chat. Each becomes a lead (Leads tab: status, transcript, CSV export, delete).
Chat is rate limited (per visitor and per day) and has its own daily budget so it can never use up your content budget.

## 5. Every day
The app notifies you with a **Daily check-in** at your chosen time: add new reference reels and a focus, approve ideas, press Make & Post. If you turn on *auto-run*, it does it for you after your grace period, still stopping before Share if review is on.

## 6. What it costs (your Claude plan)
Measured in my tests, Eco mode: a reel from idea to caption ≈ 6 calls (5 haiku, 1 sonnet), ≈ 5k output tokens. First-time deep research ≈ 4 sonnet calls, ≈ 11k output tokens (one time). 5 chat replies ≈ 5 haiku calls, ≈ 0.7k output tokens. Browser posting reads page snapshots, so it uses mostly *input* tokens. Cached results cost nothing. Claude tab shows live usage and lets you cap it.

## 6b. Updating
Close Reelkit, then in PowerShell from the Reelkit folder: `powershell -ExecutionPolicy Bypass -File scripts\update-windows.ps1`. It downloads the latest version and keeps your data and installed packages.

## 7. Troubleshooting
| Symptom | Fix |
|---|---|
| I clicked Reelkit and nothing happened | It now shows a message box if it cannot start. Logs are in `%USERPROFILE%\.reelkit\` (launcher.log, server.err.log). To see errors live, run `npm start` in the Reelkit folder. If the page opens at http://localhost:4177 Reelkit is running and only the window failed; run `node bin\reelkit.mjs open` |
| Something is missing | `node bin\reelkit.mjs doctor` lists it with the fix |
| "Claude Code CLI not found" | install it and run `claude` once to sign in. Reelkit finds the npm `.cmd` shim on Windows by itself; if it still says not found, run `where claude` and tell me what it prints |
| Posting stops with "log in" | open the Reelkit browser window, log in or pass the check, press Resume in the inbox card |
| No sound / robotic voice | Setup → Voice → pick one marked *ready*, Preview; install Kokoro |
| Captions out of sync | install faster-whisper (`pip install faster-whisper`); Reelkit then aligns captions to the real audio |
| Footage cutter leaves an "uh" | click the word in the transcript to cut it |
| Chat link not public | install cloudflared and restart |
| Scheduled posts/check-ins did not run | the app must be running (use *Start at login*) |

## 8. Safety and honesty
* Claude only states numbers you gave it. Check the *do not say* list from the research before posting claims.
* Posting through the Instagram website is automation of a website; Meta's terms restrict that. Keep volumes human-like and review before sharing. It is your account and your risk.
* The chat page tells visitors an AI replies and asks consent. Do not collect data you are not allowed to. Delete leads on request (Leads tab).
