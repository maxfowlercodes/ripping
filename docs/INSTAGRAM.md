# Instagram setup (only needed for `post` / `analyze`)
1. Convert the IG account to Professional (Creator/Business) and link it to a Facebook Page.
2. Create a Meta developer app (Business type), add Instagram API + Facebook Login, add yourself as tester.
3. Generate a long-lived user token with `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `pages_show_list`.
4. Set env vars: `IG_ACCESS_TOKEN`, `IG_USER_ID` (the IG business account id).
5. Test: `node bin/reelkit.mjs post <reel>`.
Caveats: the publish/insights code follows Meta's documented Graph API but is **untested against a live account** here; the `--trial` flag (trial reels) and metric names (`views`, `saved`) may change by API version — override with `IG_API_VERSION`. Tokens expire (~60 days); refresh them. Publishing is rate-limited (~50 posts/24h).
