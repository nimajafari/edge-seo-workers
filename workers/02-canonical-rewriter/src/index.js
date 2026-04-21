/**
 * 02 — Canonical Rewriter
 *
 * Rewrites existing <link rel="canonical"> tags, or injects one if missing.
 * Uses HTMLRewriter for streaming parse — does not buffer the full response.
 *
 * Customize computeCanonical() to implement your site's canonical policy.
 */

/**
 * Compute the canonical URL for the given request URL.
 * Default policy: strip common tracking params, enforce HTTPS, no trailing slash.
 */
function computeCanonical(url) {
  const canonical = new URL(url.toString());

  canonical.protocol = 'https:';

  // Strip tracking parameters that should never be canonicalized.
  const TRACKING_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign',
    'utm_content', 'utm_term',
    'gclid', 'fbclid', 'msclkid',
    'mc_cid', 'mc_eid',
    'ref', 'source',
  ];
  for (const param of TRACKING_PARAMS) {
    canonical.searchParams.delete(param);
  }

  // Enforce no-trailing-slash policy (except on root).
  if (canonical.pathname !== '/' && canonical.pathname.endsWith('/')) {
    canonical.pathname = canonical.pathname.replace(/\/+$/, '');
  }

  return canonical.toString();
}

/**
 * Shared state between the two handlers. The head handler needs to know
 * whether the canonical handler fired before the </head> closing tag.
 */
class CanonicalState {
  constructor() {
    this.found = false;
  }
}

class CanonicalHandler {
  constructor(correctUrl, state) {
    this.correctUrl = correctUrl;
    this.state = state;
  }
  element(el) {
    el.setAttribute('href', this.correctUrl);
    this.state.found = true;
  }
}

class HeadHandler {
  constructor(correctUrl, state) {
    this.correctUrl = correctUrl;
    this.state = state;
  }
  element(head) {
    // onEndTag fires at </head>, by which time we've seen any existing canonical.
    head.onEndTag((endTag) => {
      if (!this.state.found) {
        endTag.before(
          `<link rel="canonical" href="${this.correctUrl}">`,
          { html: true }
        );
      }
    });
  }
}

export default {
  async fetch(request) {
    const response = await fetch(request);

    // Only rewrite HTML responses.
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return response;
    }

    const canonical = computeCanonical(new URL(request.url));
    const state = new CanonicalState();

    return new HTMLRewriter()
      .on('link[rel="canonical"]', new CanonicalHandler(canonical, state))
      .on('head', new HeadHandler(canonical, state))
      .transform(response);
  },
};
