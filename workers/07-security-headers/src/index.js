/**
 * 07 — Security & Performance Headers
 *
 * Injects common security headers and performance hints into HTML responses.
 * Defaults are conservative — review every value before deploying to production,
 * especially Content-Security-Policy which can break pages if misconfigured.
 *
 * Headers are only applied to HTML responses by default (not images, JSON, etc.)
 * to avoid interfering with asset delivery.
 */

/**
 * Security headers that protect against common attacks and signal trust to
 * browsers, search engines, and security scanners.
 *
 * Values here are a sensible baseline. Tune to your site's needs.
 */
const SECURITY_HEADERS = {
  // Force HTTPS for 1 year, include subdomains, eligible for HSTS preload list.
  // Only enable includeSubDomains and preload if ALL subdomains support HTTPS.
  'strict-transport-security': 'max-age=31536000; includeSubDomains',

  // Prevent MIME-sniffing attacks.
  'x-content-type-options': 'nosniff',

  // Control how much Referer information is sent on outbound links.
  'referrer-policy': 'strict-origin-when-cross-origin',

  // Control which browser features the site can use.
  // Disable Topics API / FLoC by default.
  'permissions-policy': 'browsing-topics=(), interest-cohort=()',

  // Prevent clickjacking. Use 'SAMEORIGIN' if you embed your own site in iframes.
  'x-frame-options': 'SAMEORIGIN',

  // Legacy XSS filter — deprecated in modern browsers, but still useful for old ones.
  // Safe to leave in place.
  'x-xss-protection': '1; mode=block',
};

/**
 * Performance headers that help browsers and CDNs render pages faster.
 * Mainly targets Core Web Vitals (LCP, INP, CLS).
 */
const PERFORMANCE_HEADERS = {
  // Request early TCP/TLS connection to critical third-party origins.
  // Customize to match your site's actual critical resources.
  'link': [
    '<https://fonts.googleapis.com>; rel=preconnect',
    '<https://fonts.gstatic.com>; rel=preconnect; crossorigin',
  ].join(', '),
};

/**
 * Remove headers that leak information about the backend stack.
 * Information disclosure isn't a direct vulnerability but reduces attack surface
 * and cleans up SEO audits.
 */
const HEADERS_TO_REMOVE = [
  'x-powered-by',
  'server',
  'x-aspnet-version',
  'x-aspnetmvc-version',
  'x-generator',
];

export default {
  async fetch(request) {
    const response = await fetch(request);
    const contentType = response.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');

    const headers = new Headers(response.headers);

    // Security headers apply to everything.
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(key, value);
    }

    // Performance hints apply only to HTML documents (no point preconnecting
    // on image responses).
    if (isHtml) {
      for (const [key, value] of Object.entries(PERFORMANCE_HEADERS)) {
        // Append to existing Link headers rather than overwriting.
        if (key === 'link' && headers.has('link')) {
          headers.set('link', `${headers.get('link')}, ${value}`);
        } else {
          headers.set(key, value);
        }
      }
    }

    // Remove fingerprinting headers.
    for (const key of HEADERS_TO_REMOVE) {
      headers.delete(key);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
