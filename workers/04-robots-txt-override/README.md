# 04 — Robots.txt Override

Serve a custom `robots.txt` (and optionally `ads.txt`, `security.txt`, or any other well-known file) on platforms that won't let you edit it directly.

## Use cases

- Shopify, Wix, Squarespace, or other SaaS platforms with limited robots.txt control
- Enterprise CMS products where changing `robots.txt` requires a deployment pipeline
- Adding or removing AI crawler rules (GPTBot, ClaudeBot, CCBot, etc.) without CMS changes
- Blocking internal paths, search result pages, or faceted URLs from crawling
- Adding additional sitemap references

## Configuration

Edit the `CUSTOM_ROBOTS_TXT` constant at the top of `src/index.js`.

To override additional files like `ads.txt`, add entries to the `OVERRIDES` object.

**Route only the paths you're overriding.** Don't route the Worker to the entire site — that bills Worker invocations for every request. Use specific path routes:

```toml
routes = [
  { pattern = "example.com/robots.txt", zone_name = "example.com" },
  { pattern = "example.com/ads.txt", zone_name = "example.com" }
]
```

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
curl http://localhost:8787/robots.txt
```

After deploy, verify in Google Search Console's robots.txt tester that the rules parse as expected.

## Gotchas

- **Path-specific routes save money.** Routing the Worker to `/*` and then checking the path inside the Worker works — but it invokes the Worker on *every* request to your site. Routing it to `/robots.txt` only invokes it when someone requests that specific file. For a busy site, the difference is measurable on your bill.
- **Cache-Control matters.** The default `max-age=3600` means Cloudflare's edge cache will serve `robots.txt` for up to an hour without re-invoking the Worker. Tune this down (e.g., `max-age=300`) if you're actively iterating on the rules, then raise it once stable.
- **Don't contradict the origin.** If your origin CMS emits a `robots.txt` too, the Worker's response wins because it runs first. That's the whole point. But be aware that the two are now divergent, and future changes to the CMS's `robots.txt` won't propagate unless you update the Worker.
- **AI crawler rules change.** The list of AI training bots has grown and will keep growing. Plan to revisit the blocked user-agent list every few months. [Dark Visitors](https://darkvisitors.com/) maintains a useful reference.

## Extending this

- **Dynamic robots.txt based on subdomain:** read `url.hostname` and return different content for `www.`, `staging.`, `dev.`, etc. Useful for keeping staging indexable.
- **Environment-aware output:** use Wrangler environments (`wrangler.toml` `[env.staging]` sections) to serve a `Disallow: /` blanket block from staging Workers.
- **Sitemap generation:** intercept `/sitemap.xml` the same way and generate it from KV or D1 on the fly.
