# 06 — JSON-LD Schema Injector

Inject structured data into pages at the edge, without CMS changes. Avoids duplicate injection by detecting schema types already on the page.

## Use cases

- Adding Organization schema site-wide on a CMS that doesn't support custom head tags
- Adding BreadcrumbList schema that the CMS can't generate from URL structure
- Adding FAQ schema to help-center articles where the content exists but isn't marked up
- Progressive schema rollout across a site too large to edit template-by-template
- Adding missing Article schema fields (publisher, dateModified, etc.) that the CMS omits

## Configuration

The `buildSchemaFor()` function at the top of `src/index.js` is where you decide what schema to inject for each URL. It returns an array of schema.org objects — each becomes its own `<script type="application/ld+json">` block.

The default implementation shows two patterns:

1. **Homepage Organization schema** — a static object keyed on `url.pathname === '/'`.
2. **Blog post Breadcrumb schema** — derived from the URL structure.

For real-world use, you'll likely want to:

- Load schema data from [Workers KV](https://developers.cloudflare.com/kv/) keyed by URL
- Fetch schema from an internal API on first request and cache it
- Combine URL-derived fields with origin-provided data (read a header like `X-Product-Price`)

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
curl -s http://localhost:8787/blog/my-post | grep -A 20 'application/ld+json'
```

After deploying, validate with Google's [Rich Results Test](https://search.google.com/test/rich-results) and the [Schema Markup Validator](https://validator.schema.org/).

## Gotchas

- **Match visible content.** Schema must describe what's actually on the page. Injecting Product schema with a price that doesn't match the displayed price is a manual-action offense. See Google's [structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).
- **Duplicate schema.** Google picks one and often warns in Search Console if multiple Product schemas conflict. The tracker in this Worker avoids injecting an `@type` that's already present — but it only detects exact matches. If the origin emits a poorly-formed Product schema and you inject a correct one, you'll end up with both. Decide whether to strip the origin's version (add a handler that calls `el.remove()` on matching `@type` scripts) or trust the origin's.
- **`</script>` inside strings.** Any string value in your schema that literally contains `</script>` will break the page. The Worker escapes this, but if you generate schema dynamically from user content, sanitize first.
- **Keep schema under the size limit.** Individual JSON-LD blocks over ~100KB start causing issues with validators and crawlers. Break large graphs into smaller focused schemas.
- **`@graph` vs multiple scripts.** You can either emit multiple `<script>` blocks (what this Worker does) or use a single `<script>` with an `@graph` array. Both are valid; multiple blocks are simpler to reason about and easier to add/remove individually.

## Schema types worth injecting

In rough order of SEO value, from highest:

- **Product** — for ecommerce, unlocks rich product snippets in search.
- **Article / NewsArticle** — for publishers, unlocks headlines, dates, authors in SERPs.
- **Organization** — logo, social profiles, knowledge panel data.
- **LocalBusiness** — for local SEO, populates map pack data.
- **BreadcrumbList** — replaces URL in SERP with structured breadcrumbs.
- **FAQPage** / **HowTo** — reduced visibility since 2023, but still useful in some verticals.
- **VideoObject** — required for video rich results.
- **Recipe** — for food sites, enables the rich recipe cards.

## Extending this

- **KV-backed schema map:** store per-URL schema as JSON in KV. Lookup becomes `await env.SCHEMA_KV.get(url.pathname, 'json')`.
- **Schema from origin headers:** have the origin emit structured data as a JSON response header (base64-encoded for safety), and decode it in the Worker. Keeps schema logic in the CMS while avoiding template changes.
- **Merge with existing schema:** instead of just skipping duplicates, parse the existing schema, merge fields, and emit the combined version.
