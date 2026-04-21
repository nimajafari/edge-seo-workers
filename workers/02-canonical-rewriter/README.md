# 02 — Canonical Rewriter

Rewrite or inject `<link rel="canonical">` tags at the edge. Handles both cases:

- If the page already has a canonical tag, its `href` is rewritten.
- If the page has no canonical tag at all, one is injected before `</head>`.

Uses [`HTMLRewriter`](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/) for streaming parse — cheap even on large pages.

## Use cases

- Fixing a broken canonical policy inherited from a CMS you don't fully control
- Enforcing HTTPS canonicals when origin still emits HTTP
- Stripping tracking parameters from canonicals (UTMs, gclid, etc.)
- Enforcing trailing-slash consistency across a site
- Adding canonicals to legacy sections of the site that never had them

## Configuration

The canonical policy lives in the `computeCanonical()` function at the top of `src/index.js`. The default policy:

1. Forces `https://`
2. Strips common tracking params (`utm_*`, `gclid`, `fbclid`, etc.)
3. Removes trailing slashes (except on root)

Adapt it to whatever your site's actual canonical policy is. Common extensions:

- Force lowercase paths
- Strip port numbers
- Strip session IDs (`jsessionid`, `phpsessid`)
- Force `www.` or non-`www.` depending on your preference
- Map faceted navigation URLs back to their parent category

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
curl -s http://localhost:8787/some-page?utm_source=test | grep canonical
# should return the canonical tag without the utm_source param
```

## Gotchas

- **Content-type check matters.** The Worker only rewrites HTML responses. JSON APIs, images, and other assets pass through untouched. Don't remove this check — running `HTMLRewriter` on non-HTML is wasted CPU.
- **Pages with multiple canonicals.** If the origin emits two canonical tags (it happens more often than you'd think), both get rewritten to the same value. That's almost always what you want, but check.
- **Dynamic canonicals based on request context.** If the canonical depends on things the URL alone doesn't tell you (language preference, user type, product availability), you'll need to fetch a lookup from KV or the origin inside `computeCanonical`.
- **The `onEndTag` pattern.** The injection-if-missing logic uses `element.onEndTag()`, which fires at `</head>`. This is how you coordinate between "did the canonical tag exist?" and "if not, inject one" in a streaming parser. Don't try to refactor it into a single handler — there's no way to know whether a canonical exists until you've seen the closing head tag.

## How to extend this

- **Multi-site canonicals:** if you serve multiple domains from the same Worker, read `url.hostname` and apply different rules per host.
- **Per-section policies:** blog posts, product pages, and category pages often have different canonical rules. Branch on `url.pathname` prefix inside `computeCanonical`.
- **Pagination canonicals:** for `?page=2` and similar, you can either point all paginated pages at page 1 (aggressive) or leave self-referential canonicals in place (safer default).
