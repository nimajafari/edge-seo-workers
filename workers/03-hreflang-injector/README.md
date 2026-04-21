# 03 — Hreflang Injector

Inject `<link rel="alternate" hreflang="...">` tags at the edge. Handles:

- Self-referencing hreflang (required by Google)
- `x-default` fallback
- Removal of any existing hreflang tags to prevent duplicates

## Use cases

- International sites where the CMS doesn't emit hreflang correctly
- Managed platforms (Shopify, Wix, Squarespace) that have limited hreflang support
- Adding hreflang to a subset of pages as part of a phased internationalization rollout
- Fixing broken hreflang clusters where self-referencing tags are missing

## Configuration

The `lookupAlternates()` function at the top of `src/index.js` is where your locale map lives. The default example is a hardcoded object — that's fine for up to a few hundred URLs.

For larger sites, load the map from:

- A bundled `alternates.json` file (up to ~10MB)
- [Workers KV](https://developers.cloudflare.com/kv/) (no practical size limit)
- An origin API call (use with caution — adds latency)

Each page's entry must include:

1. A self-referencing hreflang (the page's own language).
2. All other language alternates.
3. An `x-default` entry (usually pointing to the English or primary-language version).

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
curl -s http://localhost:8787/products/widget | grep hreflang
# should return all the alternate link tags
```

## Validating hreflang output

Use Google's [International Targeting report](https://search.google.com/search-console) or a third-party tool like [hreflang.org](https://hreflang.org/) to check that:

- Every page in the cluster references every other page
- Self-referencing tags are present
- Return tags exist (page A references page B, and page B references page A)
- Language and region codes are valid ISO codes

## Gotchas

- **Hreflang is bidirectional.** If page A says "my French version is page B," then page B must also say "my English version is page A." If you only configure one side of the relationship, Google ignores the whole cluster. Your locale map must be complete.
- **x-default is required for good coverage.** It tells Google which version to show when none of your specified languages match. It's not literally required, but skipping it hurts.
- **Region codes are ISO 3166-1 Alpha 2, not country names.** Use `en-GB`, not `en-UK`. Use `en-US`, not `en-USA`.
- **Don't combine language and region where you don't have to.** `en` is fine if your content doesn't vary by region. Only use `en-US`, `en-GB` etc. when you actually have region-specific content.
- **Existing hreflang removal.** The Worker deletes any hreflang tags the origin emits before injecting its own, to prevent conflicts. If you want to *keep* the origin's tags and only *add* missing ones, remove the `ExistingHreflangRemover` handler.

## How to extend this

- **KV-backed lookup:** change `lookupAlternates` to `await env.HREFLANG_KV.get(pathname, 'json')`.
- **Auto-generated alternates:** derive alternates from URL patterns rather than a map. e.g., `/fr/*` → prepend `/` for English version, `/de/*` for German, etc.
- **Canonical + hreflang coordination:** combine with Worker 02 to rewrite canonicals and inject hreflang in a single Worker. Google requires canonical URLs in hreflang clusters to match self-referencing tags.
