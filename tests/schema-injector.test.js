/**
 * Tests for Worker 06 (Schema Injector).
 *
 * The key regression guarded here: duplicate-@type detection must work even
 * when the page's existing JSON-LD lives at the end of <body> (where Yoast,
 * RankMath, and many CMSs put it). The injector decides at </body> precisely
 * so the dedupe tracker has already seen those blocks.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { createExecutionContext } from 'cloudflare:test';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

import worker from '../workers/06-schema-injector/src/index.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockHtmlOrigin(path, html) {
  server.use(
    http.get(`https://example.com${path}`, () =>
      HttpResponse.text(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    )
  );
}

async function fetchBody(path) {
  const response = await worker.fetch(
    new Request(`https://example.com${path}`),
    {},
    createExecutionContext()
  );
  return response.text();
}

describe('Schema Injector Worker', () => {
  it('injects Organization JSON-LD on the homepage when none exists', async () => {
    mockHtmlOrigin('/', '<html><head></head><body><h1>Home</h1></body></html>');

    const body = await fetchBody('/');
    expect(body).toContain('application/ld+json');
    expect(body).toMatch(/"@type":\s*"Organization"/);
  });

  it('skips a duplicate @type even when the existing schema is at the end of <body>', async () => {
    mockHtmlOrigin(
      '/',
      '<html><head></head><body><h1>Home</h1>' +
        '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Existing"}</script>' +
        '</body></html>'
    );

    const body = await fetchBody('/');
    const matches = body.match(/"@type":\s*"Organization"/g) || [];
    // Only the page's own Organization block should remain — no second one injected.
    expect(matches).toHaveLength(1);
    expect(body).toContain('"name":"Existing"');
  });

  it('passes non-HTML responses through untouched', async () => {
    server.use(
      http.get('https://example.com/feed.xml', () =>
        HttpResponse.text('<rss></rss>', { headers: { 'content-type': 'application/xml' } })
      )
    );

    const body = await fetchBody('/feed.xml');
    expect(body).toBe('<rss></rss>');
  });
});
