/**
 * Tests for Worker 01 (Redirect Map), running in the real Workers runtime via
 * @cloudflare/vitest-pool-workers.
 *
 * To run:
 *   npm install
 *   npm test
 *
 * Outbound fetch() (the pass-through-to-origin path) is mocked with MSW, which
 * vitest-pool-workers wires into the runtime's fetch. `onUnhandledRequest:
 * 'error'` makes any unexpected origin call fail the test (the old
 * `disableNetConnect()` behaviour).
 */

import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { createExecutionContext } from 'cloudflare:test';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Import the Worker handler. Adjust the path if you restructure the repo.
import worker from '../workers/01-redirect-map/src/index.js';

// Mock the bundled redirects.json. The '/loop' self-reference exercises the
// loop-prevention branch.
vi.mock('../workers/01-redirect-map/src/redirects.json', () => ({
  default: {
    '/old-page': '/new-page',
    '/another-old': '/another-new',
    '/loop': '/loop',
  },
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Redirect Map Worker', () => {
  it('redirects a mapped path with 301', async () => {
    const request = new Request('https://example.com/old-page');
    const response = await worker.fetch(request, {}, createExecutionContext());

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://example.com/new-page');
  });

  it('preserves query string on redirect', async () => {
    const request = new Request('https://example.com/old-page?utm_source=test');
    const response = await worker.fetch(request, {}, createExecutionContext());

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toContain('utm_source=test');
  });

  it('passes through unmapped paths to origin', async () => {
    server.use(
      http.get('https://example.com/some-other-page', () =>
        HttpResponse.text('origin response')
      )
    );

    const request = new Request('https://example.com/some-other-page');
    const response = await worker.fetch(request, {}, createExecutionContext());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('origin response');
  });

  it('does not redirect a self-referencing entry (loop prevention)', async () => {
    // '/loop' maps to '/loop' — the Worker must pass through to origin instead
    // of redirecting the URL to itself.
    server.use(
      http.get('https://example.com/loop', () => HttpResponse.text('origin'))
    );

    const request = new Request('https://example.com/loop');
    const response = await worker.fetch(request, {}, createExecutionContext());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('origin');
  });
});
