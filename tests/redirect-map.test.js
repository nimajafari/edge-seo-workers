/**
 * Example test for Worker 01 (Redirect Map) using @cloudflare/vitest-pool-workers.
 *
 * To run:
 *   npm install
 *   npx vitest
 *
 * This is a starting template. Each Worker in workers/ should have a matching
 * test file that covers the critical branches — redirect logic, content-type
 * guards, canonical rules, etc. Tests in CI catch 90% of the regressions that
 * would otherwise surface as a Google Search Console alert weeks later.
 */

import { describe, it, expect, vi } from 'vitest';

// Import the Worker handler. Adjust the path if you restructure the repo.
import worker from '../workers/01-redirect-map/src/index.js';

// Mock the bundled redirects.json.
vi.mock('../workers/01-redirect-map/src/redirects.json', () => ({
  default: {
    '/old-page': '/new-page',
    '/another-old': '/another-new',
  },
}));

describe('Redirect Map Worker', () => {
  it('redirects a mapped path with 301', async () => {
    const request = new Request('https://example.com/old-page');
    const response = await worker.fetch(request);

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://example.com/new-page');
  });

  it('preserves query string on redirect', async () => {
    const request = new Request('https://example.com/old-page?utm_source=test');
    const response = await worker.fetch(request);

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toContain('utm_source=test');
  });

  it('passes through unmapped paths to origin', async () => {
    // Mock global fetch to verify it gets called for unmapped paths.
    const originalFetch = global.fetch;
    global.fetch = vi.fn(() => new Response('origin response', { status: 200 }));

    const request = new Request('https://example.com/some-other-page');
    const response = await worker.fetch(request);

    expect(global.fetch).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);

    global.fetch = originalFetch;
  });

  it('does not redirect if target resolves to same path (loop prevention)', async () => {
    // Mock the redirects to create a self-referencing entry.
    vi.doMock('../workers/01-redirect-map/src/redirects.json', () => ({
      default: { '/loop': '/loop' },
    }));

    const originalFetch = global.fetch;
    global.fetch = vi.fn(() => new Response('origin', { status: 200 }));

    const request = new Request('https://example.com/loop');
    const response = await worker.fetch(request);

    // Should pass through instead of redirecting to itself.
    expect(response.status).toBe(200);

    global.fetch = originalFetch;
  });
});
