# Edge SEO Workers

A collection of production-ready [Cloudflare Workers](https://developers.cloudflare.com/workers/) for solving common technical SEO problems at the edge — without touching the origin codebase.

Each Worker in this repo is self-contained, deployable on its own, and solves a specific class of SEO problem that would otherwise require a multi-week engineering cycle.

## What's included

| # | Worker | What it solves |
|---|--------|----------------|
| 01 | [Redirect Map](./workers/01-redirect-map/) | Deploy 301 redirects at scale from a JSON map or KV store |
| 02 | [Canonical Rewriter](./workers/02-canonical-rewriter/) | Rewrite or inject `<link rel="canonical">` tags dynamically |
| 03 | [Hreflang Injector](./workers/03-hreflang-injector/) | Inject `hreflang` alternates on internationalized sites |
| 04 | [Robots.txt Override](./workers/04-robots-txt-override/) | Serve a custom `robots.txt` on platforms that won't let you edit it |
| 05 | [Soft 404 Fix](./workers/05-soft-404-fix/) | Convert fake-200 pages (empty categories, OOS products) into real 404s |
| 06 | [Schema Injector](./workers/06-schema-injector/) | Inject JSON-LD structured data without CMS changes |
| 07 | [Security Headers](./workers/07-security-headers/) | Add security and performance headers for Core Web Vitals and E-E-A-T |
| 08 | [Bot Logging](./workers/08-bot-logging/) | Log verified Googlebot requests for crawl analysis |

## Prerequisites

- A domain behind [Cloudflare](https://www.cloudflare.com/)
- A [Workers Paid plan](https://developers.cloudflare.com/workers/platform/pricing/) (\$5/month minimum — you'll almost certainly stay within the included 10M requests)
- [Node.js](https://nodejs.org/) v18 or later
- Basic familiarity with the command line

## Quick start

Clone the repo and pick a Worker to deploy:

```bash
git clone https://github.com/YOUR-USERNAME/edge-seo-workers.git
cd edge-seo-workers/workers/01-redirect-map
npm install
npx wrangler login
npx wrangler deploy
```

Each Worker folder has its own `README.md` with specific configuration instructions — things like which URL patterns to route it to, what to edit before deploying, and what gotchas to watch for.

## Repository structure

```
edge-seo-workers/
├── workers/
│   ├── 01-redirect-map/
│   │   ├── README.md       # What it does, how to configure
│   │   ├── wrangler.toml   # Cloudflare deployment config
│   │   └── src/
│   │       └── index.js    # The Worker code
│   ├── 02-canonical-rewriter/
│   └── ...
├── tests/
│   └── redirect-map.test.js  # Example test using vitest-pool-workers
├── package.json
├── LICENSE
└── README.md
```

## How to use this repo

**If you're an SEO with basic JavaScript chops:** pick one Worker, read its README, edit the config variables at the top of `src/index.js`, and deploy. Each Worker is designed to be understood and modified without deep dev experience.

**If you're a developer whose SEO team sent you this:** the Workers are deliberately simple so you can harden, test, and compose them into whatever pipeline makes sense for your stack. Several of them are worth combining via [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/).

**If you're teaching Edge SEO:** the `workers/` folder is ordered from easiest (01) to most nuanced (08). Walking through them in order is a reasonable syllabus.

## Important caveats

- **These are starting points, not drop-in solutions.** Your canonical logic, hreflang map, schema generation, and URL patterns are specific to your site. The code here is the scaffolding; the business logic is yours to fill in.
- **Test before you deploy broadly.** Scope each Worker to a single URL pattern or subdomain first. Cloudflare makes rolling back trivial — use that.
- **Log before you transform.** The first version of any production Worker should be read-only. Capture traffic, verify assumptions, then turn on mutation.
- **Don't cloak.** Several of these patterns *could* be used to serve different content to crawlers vs users. Don't. Google's [cloaking policy](https://developers.google.com/search/docs/essentials/spam-policies#cloaking) applies to edge-served content exactly the same as it does to origin-served content.

## Limits you should know

From the [official Workers limits reference](https://developers.cloudflare.com/workers/platform/limits/):

- **CPU time:** 30s max on Paid, but aim to stay under 50ms
- **Memory:** 128MB per isolate
- **Subrequests:** 50 per invocation
- **Bundle size:** 10MB compressed
- **Startup time:** 400ms max for top-level code

## Further reading

- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- [HTMLRewriter API reference](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/) — the most important API in this repo
- [Workers examples gallery](https://developers.cloudflare.com/workers/examples/) — more patterns beyond SEO
- [Google Search Central JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)

## License

MIT. Use these in client work, fork them, modify them, teach from them. Attribution is appreciated but not required.

## Contributing

Pull requests welcome, especially:

- Additional SEO-focused Worker patterns
- Tests for existing Workers
- Better documentation of edge cases

Please keep each Worker self-contained and runnable in isolation — that's the design principle of this repo.
