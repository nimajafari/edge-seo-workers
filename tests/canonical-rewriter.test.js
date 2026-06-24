/**
 * Tests for Worker 02 (Canonical Rewriter).
 *
 * This Worker uses HTMLRewriter, which only exists in the Workers runtime —
 * these tests can't run under a plain Node/jsdom environment, which is the
 * whole reason the suite runs through @cloudflare/vitest-pool-workers.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { createExecutionContext } from 'cloudflare:test';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

import worker from '../workers/02-canonical-rewriter/src/index.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Reply to the origin fetch for `path` with an HTML document. */
function mockHtmlOrigin(path, html) {
  server.use(
    http.get(`https://example.com${path}`, () =>
      HttpResponse.text(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    )
  );
}

describe('Canonical Rewriter Worker', () => {
  it('rewrites an existing canonical: HTTPS + strips tracking params + no trailing slash', async () => {
    mockHtmlOrigin(
      '/page/',
      '<html><head><link rel="canonical" href="http://example.com/page/?utm_source=newsletter"></head><body>hi</body></html>'
    );

    const request = new Request('https://example.com/page/?utm_source=newsletter');
    const response = await worker.fetch(request, {}, createExecutionContext());
    const body = await response.text();

    expect(body).toContain('href="https://example.com/page"');
    expect(body).not.toContain('utm_source');
  });

  it('injects a canonical when the page has none', async () => {
    mockHtmlOrigin(
      '/no-canonical',
      '<html><head><title>No canonical here</title></head><body>hi</body></html>'
    );

    const request = new Request('https://example.com/no-canonical');
    const response = await worker.fetch(request, {}, createExecutionContext());
    const body = await response.text();

    expect(body).toContain('<link rel="canonical" href="https://example.com/no-canonical">');
  });

  it('does not inject a second canonical when one already exists', async () => {
    mockHtmlOrigin(
      '/has-canonical',
      '<html><head><link rel="canonical" href="https://example.com/has-canonical"></head><body>hi</body></html>'
    );

    const request = new Request('https://example.com/has-canonical');
    const response = await worker.fetch(request, {}, createExecutionContext());
    const body = await response.text();

    expect(body.match(/rel="canonical"/g)).toHaveLength(1);
  });

  it('passes non-HTML responses through untouched', async () => {
    server.use(
      http.get('https://example.com/data.json', () =>
        HttpResponse.text('{"a":1}', { headers: { 'content-type': 'application/json' } })
      )
    );

    const request = new Request('https://example.com/data.json');
    const response = await worker.fetch(request, {}, createExecutionContext());

    expect(await response.text()).toBe('{"a":1}');
  });
});
