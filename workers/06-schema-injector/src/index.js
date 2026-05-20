/**
 * 06 — JSON-LD Schema Injector
 *
 * Injects structured data (JSON-LD) before </body> based on URL patterns.
 * Handles:
 *   - Multiple schema types per page (Product + Breadcrumb, Article + Organization, etc.)
 *   - Avoiding duplicate injection if the page already has the same @type
 *   - HTML escaping inside the JSON-LD script block
 *
 * We inject at </body> rather than </head> on purpose: HTMLRewriter streams in
 * document order, so the dedupe tracker has only seen <head> scripts by the time
 * </head> closes. A lot of CMSs and SEO plugins emit JSON-LD at the end of <body>
 * (Yoast, RankMath, etc.). Deciding at </body> means the tracker has seen every
 * existing block first, so dedupe is reliable. Google reads JSON-LD anywhere in
 * the document, so placement at the end of <body> is fine.
 *
 * Customize buildSchemaFor() to return whatever schema your pages need.
 */

/**
 * Return an array of schema.org objects for a given request, or null if
 * no schema should be injected. Each object becomes its own JSON-LD block.
 *
 * Customize this to read from KV, call your API, or parse URL patterns.
 */
async function buildSchemaFor(request, env) {
  const url = new URL(request.url);

  // Example 1: inject Organization schema site-wide on the homepage.
  if (url.pathname === '/') {
    return [{
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Example Company',
      url: 'https://example.com',
      logo: 'https://example.com/logo.png',
      sameAs: [
        'https://twitter.com/example',
        'https://www.linkedin.com/company/example',
      ],
    }];
  }

  // Example 2: inject Breadcrumb + Article on blog posts.
  if (url.pathname.startsWith('/blog/')) {
    const slug = url.pathname.replace('/blog/', '');
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com/' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://example.com/blog' },
          { '@type': 'ListItem', position: 3, name: slug },
        ],
      },
      // You'd populate Article fields from KV or an origin API call.
      // { '@context': 'https://schema.org', '@type': 'Article', headline: ..., datePublished: ..., author: ... }
    ];
  }

  return null;
}

/**
 * Tracks which @type values are already on the page so we don't inject
 * duplicates.
 */
class ExistingSchemaTracker {
  constructor() {
    this.existingTypes = new Set();
    this.buffer = '';
  }
  element(el) {
    const type = el.getAttribute('type');
    if (type !== 'application/ld+json') {
      // Defensive: only track JSON-LD scripts.
      return;
    }
    this.buffer = '';
  }
  text(chunk) {
    this.buffer += chunk.text;
    if (chunk.lastInTextNode) {
      try {
        const parsed = JSON.parse(this.buffer);
        this.extractTypes(parsed);
      } catch {
        // Malformed JSON-LD on the page — ignore it for tracking purposes.
      }
      this.buffer = '';
    }
  }
  extractTypes(obj) {
    if (!obj) return;
    if (Array.isArray(obj)) {
      obj.forEach((o) => this.extractTypes(o));
      return;
    }
    if (obj['@graph'] && Array.isArray(obj['@graph'])) {
      obj['@graph'].forEach((o) => this.extractTypes(o));
    }
    if (obj['@type']) {
      if (Array.isArray(obj['@type'])) {
        obj['@type'].forEach((t) => this.existingTypes.add(t));
      } else {
        this.existingTypes.add(obj['@type']);
      }
    }
  }
}

/**
 * Appends new JSON-LD blocks before </body>, skipping any @types that are
 * already present anywhere on the page.
 */
class SchemaInjector {
  constructor(schemas, tracker) {
    this.schemas = schemas;
    this.tracker = tracker;
  }
  element(body) {
    body.onEndTag((endTag) => {
      for (const schema of this.schemas) {
        const type = schema['@type'];
        if (type && this.tracker.existingTypes.has(type)) {
          continue;
        }
        // Escape the `</script>` closing sequence to prevent breakout.
        const json = JSON.stringify(schema).replace(/<\/script/gi, '<\\/script');
        endTag.before(
          `<script type="application/ld+json">${json}</script>`,
          { html: true }
        );
      }
    });
  }
}

export default {
  async fetch(request, env) {
    const response = await fetch(request);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return response;
    }

    const schemas = await buildSchemaFor(request, env);
    if (!schemas || schemas.length === 0) {
      return response;
    }

    const tracker = new ExistingSchemaTracker();

    return new HTMLRewriter()
      .on('script[type="application/ld+json"]', tracker)
      .on('body', new SchemaInjector(schemas, tracker))
      .transform(response);
  },
};
