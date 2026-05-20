# 08 — Bot Logging

Log search crawler and AI bot requests at the edge, annotated with Cloudflare's verified-bot status. Does NOT modify the response — the bot sees exactly what a user would see.

## Use cases

- Crawl budget analysis (which URLs is Googlebot hitting, how often?)
- Debugging indexation issues (is Googlebot even reaching the page?)
- Tracking AI training bot activity (GPTBot, ClaudeBot, CCBot)
- Monitoring third-party SEO tool crawlers (Ahrefs, Semrush)
- Per-country crawl pattern analysis
- Detecting spoofed User-Agents by comparing UA-match to Cloudflare's verified-bot flag

## What this Worker does NOT do

**It does not cloak.** It does not serve different content to bots. It does not redirect bots. It does not block them. It is a read-only logger. Serving different content to crawlers vs users is a [policy violation](https://developers.google.com/search/docs/essentials/spam-policies#cloaking).

If you want to block AI bots, do that via `robots.txt` (see Worker 04) or Cloudflare's built-in [AI bot blocking](https://blog.cloudflare.com/declaring-your-aindependence-block-ai-bots-scrapers-and-crawlers-with-a-single-click/).

## Verification strategies

The default implementation identifies bots by User-Agent pattern match. This is:

- **Fast** — no network calls, negligible CPU.
- **Spoofable** — anyone can set `User-Agent: Googlebot`. For rough analytics it's fine; for decisions that depend on trust (like rate-limiting or content changes), don't rely on it alone.

Cloudflare also exposes `request.cf.verifiedBotCategory` — a server-side flag that Cloudflare sets based on its own verification (reverse DNS, IP range, etc.). The Worker logs this alongside the UA match so you can cross-reference in analytics.

By default the Worker logs **every** UA match and records the verification result as a field, so spoofed traffic is captured but clearly distinguishable. If you only want verified bots in your logs, set `REQUIRE_VERIFICATION = true` at the top of `src/index.js` — UA-only matches with no Cloudflare verification are then skipped entirely.

For production-grade verification, do reverse-DNS in your log pipeline (not in the Worker hot path). Google publishes the [verification procedure](https://developers.google.com/search/docs/crawling-indexing/verifying-googlebot).

## Log destinations

By default, the Worker uses `console.log(JSON.stringify(entry))`, which is captured by Cloudflare's built-in [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/) when observability is enabled in `wrangler.toml`.

For higher-volume or longer-retention logging, swap the `logBotRequest` implementation:

- **[Logpush](https://developers.cloudflare.com/logs/logpush/)** — push logs to R2, S3, Datadog, Splunk, etc.
- **[Cloudflare Queues](https://developers.cloudflare.com/queues/)** — batch requests for downstream processing.
- **Direct HTTP POST** — send to your own analytics endpoint.

## Deploy

```bash
npm install
npx wrangler login
npx wrangler deploy
```

## Testing

```bash
npx wrangler dev
# in another terminal:
curl -A "Googlebot/2.1 (+http://www.google.com/bot.html)" http://localhost:8787/
# check the wrangler dev terminal for the JSON log line
```

## Gotchas

- **CPU budget.** This Worker runs on every request to the routed patterns. Keep the logging fast — building the JSON entry and using `waitUntil` is fine. Don't make synchronous network calls in the hot path.
- **PII concerns.** `cf-connecting-ip` is the end-user's IP. If you're logging actual user traffic (not just bot traffic), review your privacy policy and GDPR obligations. This Worker only logs when a bot UA is detected, which avoids most user-IP logging, but review before enabling globally.
- **Log volume.** A busy site sees thousands of bot hits per day. Make sure your downstream log sink can handle the volume without running up a bill.
- **False positives on AI bots.** Some AI user-agent strings are ambiguous (e.g., "Mozilla/5.0 (compatible; AI-Agent/1.0)"). The patterns here err on the side of specificity; update them as new bots emerge.

## Extending this

- **Track bot hit rate per URL:** accumulate counters in [Durable Objects](https://developers.cloudflare.com/durable-objects/) or [D1](https://developers.cloudflare.com/d1/) and expose a dashboard.
- **Alert on unusual crawl patterns:** sudden spike in 404s to Googlebot, or a sudden drop in crawl rate, is a leading indicator of indexation problems.
- **Sample instead of logging everything:** on very high-traffic sites, log 10% of bot requests instead of 100%.
  ```javascript
  if (Math.random() < 0.1) ctx.waitUntil(logBotRequest(request, bot));
  ```
- **Combine with Worker 04 (robots.txt):** use log data to figure out which paths bots are hitting that they shouldn't be, then update `robots.txt` accordingly.
