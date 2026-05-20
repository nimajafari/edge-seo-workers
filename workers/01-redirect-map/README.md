# 01 — Redirect Map

Serve 301 redirects at scale from a JSON map (or Workers KV for very large maps). Replaces `.htaccess` or Nginx redirect blocks for Cloudflare-fronted sites.

## Use cases

- Platform migration (WordPress → Shopify, etc.)
- URL structure overhaul
- Domain consolidation
- Legacy URL cleanup after content audits
- Consolidating redirect chains from earlier migrations into single-hop 301s

## Configuration

1. Edit `src/redirects.json` to contain your `oldPath → newPath` map.
2. Edit `wrangler.toml` to set the `routes` your Worker should handle.
3. Review the constants at the top of `src/index.js`:
   - `PRESERVE_QUERY_STRING` — whether to carry `?utm_*` and other params through
   - `REDIRECT_STATUS` — 301 for permanent (default), 302 for temporary

## Deploy

```bash
npm install
npx wrangler login
npx wrangler deploy
```

## Testing locally

```bash
npx wrangler dev
# in another terminal:
curl -I http://localhost:8787/old-product-page
# should return: HTTP/1.1 301 Moved Permanently
#                location: /products/new-slug
```

## Using Workers KV for large maps

If your redirect map exceeds ~5,000 entries, bundling it in the Worker is wasteful. Move it to [Workers KV](https://developers.cloudflare.com/kv/):

1. Create a KV namespace:
   ```bash
   npx wrangler kv:namespace create REDIRECTS_KV
   ```
2. Uncomment the `[[kv_namespaces]]` block in `wrangler.toml` and paste in the namespace ID.
3. Bulk-upload your redirects:
   ```bash
   npx wrangler kv:bulk put --binding=REDIRECTS_KV redirects-bulk.json
   ```
   where `redirects-bulk.json` has the format:
   ```json
   [
     { "key": "/old-page", "value": "/new-page" },
     { "key": "/another", "value": "/target" }
   ]
   ```
4. Replace the lookup in `src/index.js` with:
   ```javascript
   const target = await env.REDIRECTS_KV.get(url.pathname);
   ```

## Gotchas

- **Exact-match only, and case-sensitive.** Lookups are an exact match on `url.pathname`. `/old-page` will **not** match `/old-page/` (trailing slash) or `/Old-Page` (different case) — these are the most common misses in real migrations. Add every variant you expect to your map, or normalize the path before lookup (e.g. lowercase it and strip a trailing slash). Pick one trailing-slash convention and redirect to it consistently.
- **Redirect chains.** If a path in your map points to another path that's *also* in the map, the Worker only redirects once per request. The browser handles the second hop. That's intentional — you should flatten chains in the map itself.
- **Query string preservation.** With `PRESERVE_QUERY_STRING = true`, the incoming query is carried over **only when the destination has no query of its own**. If a target already includes `?foo=bar`, the incoming query is dropped rather than merged — so don't rely on this to combine params. If you're cleaning up tracking params during a migration, set `PRESERVE_QUERY_STRING = false` and handle UTMs separately.
- **Cache interaction.** By default, redirect responses from Workers are not cached by Cloudflare's edge cache. For very high-traffic redirects, explicitly cache them with `Cache-Control: public, max-age=3600` on the response to reduce Worker invocations.

## How to extend this

- **Regex / pattern matching:** swap the JSON lookup for a list of `{ pattern: RegExp, target: string }` rules.
- **Locale-aware redirects:** inspect `request.headers.get('accept-language')` or `request.cf.country` before deciding the target.
- **A/B testing migrations:** split traffic between old and new URLs while you verify performance.
