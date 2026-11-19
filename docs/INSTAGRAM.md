# Instagram setup (only for post / analyze / swipe discover)
1. Convert the IG account to Professional (Creator or Business) and link it to a Facebook Page.
2. Create a Meta developer app (Business type), add the Instagram API with Facebook Login, add yourself as a tester/admin.
3. Generate a long-lived user token with `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`.
4. Find your Instagram business account id, then: `node bin/reelkit.mjs account add main --user-id <ID> --token <TOKEN>` (repeat with other names for more accounts).
5. Test: `reelkit account list`, then `reelkit analyze`.

What each feature calls (official Graph API):
* **post / schedule:** resumable Reels upload via `rupload.facebook.com`, then `media_publish`. `--trial` adds `trial_params={"graduation_strategy":"MANUAL"}`; promote a trial reel to followers in the Instagram app.
* **analyze:** per-media insights (`views, reach, likes, comments, shares, saved, total_interactions`) requested one at a time, plus account reach split by `follow_type` (followers vs non-followers).
* **swipe discover:** Business Discovery on public Business/Creator accounts (`like_count`, `comments_count`, `view_count` where returned). Hidden like counts and age-gated accounts are not returned; when views are missing, a likes-based estimate is used and the multiplier says so in its source field.

Caveats: written from Meta's documentation, **not verified against a live account here**. Meta renames metrics and API versions (override with `IG_API_VERSION`). Tokens expire (~60 days): refresh them. Publishing is rate limited. Third-party sources disagree about trial-reel API limits, so test with one reel first.
