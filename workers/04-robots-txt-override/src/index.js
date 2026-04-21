/**
 * 04 — Robots.txt Override
 *
 * Intercepts /robots.txt requests and returns a custom response. Useful on
 * managed platforms (Shopify, certain enterprise CMS products) that don't
 * allow editing robots.txt directly.
 *
 * Can also be extended to override /sitemap.xml, /ads.txt, /security.txt,
 * and other well-known files the same way.
 */

const CUSTOM_ROBOTS_TXT = `# Custom robots.txt served via Cloudflare Worker
# Last updated: 2026-01-01

User-agent: *
Allow: /
Disallow: /internal/
Disallow: /admin/
Disallow: /*?sort=
Disallow: /*?filter=

# Sitemaps
Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap-news.xml

# Specific crawler rules
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# Block AI training crawlers (optional — remove if you want your content
# used for AI training). Uncomment to enable:
#
# User-agent: GPTBot
# Disallow: /
#
# User-agent: ClaudeBot
# Disallow: /
#
# User-agent: CCBot
# Disallow: /
`;

/**
 * Map of well-known files to their override content. Add more as needed.
 */
const OVERRIDES = {
  '/robots.txt': {
    body: CUSTOM_ROBOTS_TXT,
    contentType: 'text/plain; charset=utf-8',
  },
  // Example: override /ads.txt too
  // '/ads.txt': {
  //   body: 'google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0\n',
  //   contentType: 'text/plain; charset=utf-8',
  // },
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const override = OVERRIDES[url.pathname];

    if (!override) {
      return fetch(request);
    }

    return new Response(override.body, {
      status: 200,
      headers: {
        'content-type': override.contentType,
        // Allow CDN caching but let bots revalidate frequently
        'cache-control': 'public, max-age=3600, must-revalidate',
      },
    });
  },
};
