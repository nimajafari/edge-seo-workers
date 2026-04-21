/**
 * 03 — Hreflang Injector
 *
 * Injects <link rel="alternate" hreflang="..."> tags into the <head> based
 * on a locale map. Handles:
 *   - x-default fallback
 *   - Self-referencing hreflang (required by Google)
 *   - Removal of any existing hreflang tags to prevent duplicates
 *
 * Supply your own alternates via lookupAlternates() — either hardcoded,
 * from a JSON map, or from Workers KV for large sites.
 */

/**
 * Return the list of hreflang alternates for a given URL path.
 *
 * Each alternate is: { lang: string, url: string }
 *   - `lang` uses ISO format: 'en', 'en-US', 'fr-FR', 'x-default', etc.
 *   - `url` must be the absolute URL of the alternate.
 *
 * The returned list should include a self-referencing entry (the current
 * page's own hreflang) and an x-default.
 */
function lookupAlternates(pathname) {
  // Example hardcoded map. For production, load from KV or a JSON file.
  const map = {
    '/products/widget': [
      { lang: 'en', url: 'https://example.com/products/widget' },
      { lang: 'fr', url: 'https://example.com/fr/produits/widget' },
      { lang: 'de', url: 'https://example.com/de/produkte/widget' },
      { lang: 'es', url: 'https://example.com/es/productos/widget' },
      { lang: 'x-default', url: 'https://example.com/products/widget' },
    ],
    '/fr/produits/widget': [
      { lang: 'en', url: 'https://example.com/products/widget' },
      { lang: 'fr', url: 'https://example.com/fr/produits/widget' },
      { lang: 'de', url: 'https://example.com/de/produkte/widget' },
      { lang: 'es', url: 'https://example.com/es/productos/widget' },
      { lang: 'x-default', url: 'https://example.com/products/widget' },
    ],
    // ... add more entries
  };

  return map[pathname] || null;
}

/**
 * Removes any existing hreflang tags to prevent conflicts with the ones
 * we're about to inject.
 */
class ExistingHreflangRemover {
  element(el) {
    el.remove();
  }
}

/**
 * Injects the hreflang tags before </head>.
 */
class HreflangInjector {
  constructor(alternates) {
    this.alternates = alternates;
  }
  element(head) {
    head.onEndTag((endTag) => {
      for (const alt of this.alternates) {
        endTag.before(
          `<link rel="alternate" hreflang="${escapeAttr(alt.lang)}" href="${escapeAttr(alt.url)}">`,
          { html: true }
        );
      }
    });
  }
}

/**
 * Minimal HTML attribute escaper. Prevents injection if lookupAlternates
 * ever returns user-controlled data.
 */
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default {
  async fetch(request) {
    const response = await fetch(request);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return response;
    }

    const url = new URL(request.url);
    const alternates = lookupAlternates(url.pathname);

    if (!alternates || alternates.length === 0) {
      return response;
    }

    return new HTMLRewriter()
      .on('link[rel="alternate"][hreflang]', new ExistingHreflangRemover())
      .on('head', new HreflangInjector(alternates))
      .transform(response);
  },
};
