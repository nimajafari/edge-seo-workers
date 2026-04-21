/**
 * 01 — Redirect Map
 *
 * Serves 301 redirects from a JSON map. Handles:
 *   - Exact path matches
 *   - Query-string preservation on redirect (configurable)
 *   - Redirect-chain avoidance (won't redirect if already on the target)
 *
 * For maps over ~5,000 entries, move the lookup to Workers KV instead of
 * bundling the JSON. See the README for the KV variant.
 */

import redirects from './redirects.json';

/**
 * Whether to carry the incoming query string through to the destination.
 * Set to false if your destinations already include canonical query strings.
 */
const PRESERVE_QUERY_STRING = true;

/**
 * The redirect status code. 301 is permanent, 302 is temporary, 308 is the
 * modern permanent-redirect with strict method preservation. For SEO migrations
 * you almost always want 301.
 */
const REDIRECT_STATUS = 301;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = redirects[url.pathname];

    if (!target) {
      return fetch(request);
    }

    const destination = new URL(target, url.origin);

    // Avoid a redirect loop if the target resolves to the same path.
    if (destination.pathname === url.pathname) {
      return fetch(request);
    }

    if (PRESERVE_QUERY_STRING && url.search && !destination.search) {
      destination.search = url.search;
    }

    return Response.redirect(destination.toString(), REDIRECT_STATUS);
  },
};
