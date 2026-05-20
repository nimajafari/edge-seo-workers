/**
 * Tests for Worker 02 (Canonical Rewriter).
 *
 * This Worker uses HTMLRewriter, which only exists in the Workers runtime —
 * these tests can't run under a plain Node/jsdom environment, which is the
 * whole reason the suite runs through @cloudflare/vitest-pool-workers.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { fetchMock, createExecutionContext } from 'cloudflare:test';

import worker from '../workers/02-canonical-rewriter/src/index.js';

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => fetchMock.assertNoPendingInterceptors());

/** Reply to the origin fetch with an HTML document. */
function mockHtmlOrigin(intercept, html) {
  fetchMock
    .get('https://example.com')
    .intercept(intercept)
    .reply(200, html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

describe('Canonical Rewriter Worker', () => {
  it('rewrites an existing canonical: HTTPS + strips tracking params + no trailing slash', async () => {
    mockHtmlOrigin(
      { path: '/page/', query: { utm_source: 'newsletter' } },
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
      { path: '/no-canonical' },
      '<html><head><title>No canonical here</title></head><body>hi</body></html>'
    );

    const request = new Request('https://example.com/no-canonical');
    const response = await worker.fetch(request, {}, createExecutionContext());
    const body = await response.text();

    expect(body).toContain('<link rel="canonical" href="https://example.com/no-canonical">');
  });

  it('does not inject a second canonical when one already exists', async () => {
    mockHtmlOrigin(
      { path: '/has-canonical' },
      '<html><head><link rel="canonical" href="https://example.com/has-canonical"></head><body>hi</body></html>'
    );

    const request = new Request('https://example.com/has-canonical');
    const response = await worker.fetch(request, {}, createExecutionContext());
    const body = await response.text();

    expect(body.match(/rel="canonical"/g)).toHaveLength(1);
  });

  it('passes non-HTML responses through untouched', async () => {
    fetchMock
      .get('https://example.com')
      .intercept({ path: '/data.json' })
      .reply(200, '{"a":1}', { headers: { 'content-type': 'application/json' } });

    const request = new Request('https://example.com/data.json');
    const response = await worker.fetch(request, {}, createExecutionContext());

    expect(await response.text()).toBe('{"a":1}');
  });
});
