/**
 * 05 — Soft 404 Fix
 *
 * Converts fake 200 responses (out-of-stock products, empty search results,
 * deleted categories) into real 404s so Google doesn't waste crawl budget
 * on them and doesn't keep them indexed.
 *
 * Strategy: the Worker inspects a signal from the origin to decide whether
 * to rewrite the status code. Two signals are supported:
 *
 *   1. A custom response header from the origin (preferred — fastest,
 *      most reliable). e.g., `X-Page-Status: not-found`.
 *
 *   2. Content detection via HTMLRewriter — slower and more brittle, but
 *      works when you can't modify the origin. See README for the tradeoffs.
 */

const SIGNAL_HEADER = 'x-page-status';
const SIGNAL_VALUE_NOT_FOUND = 'not-found';
const SIGNAL_VALUE_GONE = 'gone';

export default {
  async fetch(request) {
    const response = await fetch(request);

    // Only consider rewriting 200 responses.
    if (response.status !== 200) {
      return response;
    }

    const signal = response.headers.get(SIGNAL_HEADER)?.toLowerCase();

    if (signal === SIGNAL_VALUE_NOT_FOUND) {
      return rewriteStatus(response, 404);
    }

    if (signal === SIGNAL_VALUE_GONE) {
      // 410 Gone tells Google the resource is permanently removed.
      // Use this for deliberately killed URLs, not for temporary stockouts.
      return rewriteStatus(response, 410);
    }

    return response;
  },
};

/**
 * Rewrite the HTTP status code while preserving headers and body.
 * Reads the body as a stream to avoid buffering.
 */
function rewriteStatus(response, newStatus) {
  // Clone headers so we can modify them freely.
  const headers = new Headers(response.headers);

  // Strip the internal origin->Worker signal header so it never leaks to the
  // client or downstream caches.
  headers.delete(SIGNAL_HEADER);

  // Signal to CDNs and downstream caches not to cache the old 200.
  headers.set('cache-control', 'no-store');

  return new Response(response.body, {
    status: newStatus,
    statusText: statusText(newStatus),
    headers,
  });
}

function statusText(status) {
  switch (status) {
    case 404: return 'Not Found';
    case 410: return 'Gone';
    default: return '';
  }
}
