# 05 — Soft 404 Fix

Convert fake-200 responses into real 404 or 410 status codes before they reach the crawler. Prevents Google from wasting crawl budget on pages that should have been dead.

## Use cases

- Out-of-stock product pages that the platform leaves live as 200s
- Empty search results pages (`/search?q=nonsensequery`)
- Deleted category or tag pages that the CMS still renders
- Expired listings, old events, sold properties
- User-generated content that was deleted but still returns a "this post was removed" page with status 200

## How it works

The Worker inspects a signal from the origin to decide whether to rewrite the status. Two approaches:

### Approach A: custom response header (recommended)

Modify the origin to emit a response header like `X-Page-Status: not-found` on soft-404 pages. The Worker reads that header and rewrites the status code. This is:

- **Fast** — just a header check, no HTML parsing.
- **Reliable** — origin knows best whether a page is a real hit or a soft-404.
- **Cheap** — adds no meaningful CPU time.

Most developers can add a one-line header in their controller/template logic. Push for this approach.

### Approach B: content detection (fallback)

If you truly can't modify the origin, use HTMLRewriter to look for tell-tale content patterns ("No products found," "This listing has expired," empty cart selectors, etc.) and flip the status based on what you see. This is slower, brittle, and easy to misfire on. Only use it as a last resort. See "Extending this" below for a sketch.

## Configuration

Edit the constants at the top of `src/index.js`:

- `SIGNAL_HEADER` — the name of the header the origin emits (default: `x-page-status`)
- `SIGNAL_VALUE_NOT_FOUND` — value that maps to a 404 (default: `not-found`)
- `SIGNAL_VALUE_GONE` — value that maps to a 410 (default: `gone`)

## 404 vs 410 — which should you use?

| Status | Meaning | When to use |
|--------|---------|-------------|
| **404 Not Found** | "This resource isn't here right now." | Temporary conditions: out of stock, seasonal pages, user searching for something that doesn't exist. |
| **410 Gone** | "This resource was here and is permanently removed." | Deliberate deletions: killed products you'll never sell again, discontinued services, deleted content you don't want reindexed. |

Google removes 410 URLs from the index faster than 404s. Use 410 when you're sure.

## Deploy

```bash
npm install
npx wrangler login
npx wrangler deploy
```

## Testing

Simulate an origin that sends the signal header:

```bash
# Start a local test origin
npx wrangler dev
# In another terminal, curl a URL and inspect the status
curl -I http://localhost:8787/products/discontinued-widget
```

## Gotchas

- **Cache invalidation.** The Worker sets `Cache-Control: no-store` on rewritten responses so stale 200s don't sit in any downstream cache. If you had the page cached as a 200 somewhere, you'll need to purge it.
- **Don't over-aggressively rewrite.** A page with no products today might have products tomorrow. For temporary conditions, 404 is fine; reserve 410 for deliberate, permanent removals.
- **Soft 404s vs noindex.** If you want the page to remain accessible to users but not be indexed, adding `<meta name="robots" content="noindex">` is a different solution. Use the status-code fix when the URL shouldn't exist at all.
- **Be careful on product pages with alternatives.** If an out-of-stock product has a clear "see similar products" flow or the stock is returning soon, the right move is often to keep the 200 and add schema / UX that helps the user, not to 404 it. 404ing a product URL throws away its backlinks and rankings.

## Extending this

### Content-based detection (Approach B)

Uncomment the pattern below if you can't get the origin to emit a signal header. This approach parses the response body and looks for known soft-404 indicators.

```javascript
class SoftFourOhFourDetector {
  constructor() {
    this.isSoft404 = false;
  }
  element(el) {
    const markerClasses = ['no-results', 'empty-category', 'out-of-stock-no-alt'];
    const className = el.getAttribute('class') || '';
    if (markerClasses.some(c => className.includes(c))) {
      this.isSoft404 = true;
    }
  }
}

// In your fetch handler:
// const detector = new SoftFourOhFourDetector();
// const transformed = new HTMLRewriter()
//   .on('body', detector)
//   .transform(response);
// const body = await transformed.text();  // forces full parse
// if (detector.isSoft404) { /* rewrite status */ }
```

The tradeoff: `.text()` buffers the full body, which defeats HTMLRewriter's streaming benefit and uses more CPU. Use sparingly.

### Auto-redirect on permanent removal

Instead of returning 410, you could return 301 to a related page. Combine this Worker with Worker 01 (redirect map) to handle the "this product is discontinued, here's a similar one" flow at the edge.
