/**
 * Tests for Worker 08 (Bot Logging).
 *
 * The key regression guarded here: the generic `Googlebot` User-Agent pattern
 * must not shadow the more specific `Googlebot-Image` / `Googlebot-News`
 * variants. Logging runs via ctx.waitUntil(), so tests use
 * waitOnExecutionContext() to let it finish before asserting.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { fetchMock, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';

import worker from '../workers/08-bot-logging/src/index.js';

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
  vi.restoreAllMocks();
});

/** The Worker always passes the request through to origin. */
function passthrough(path) {
  fetchMock.get('https://example.com').intercept({ path }).reply(200, 'ok');
}

async function run(path, userAgent) {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  passthrough(path);
  const ctx = createExecutionContext();
  const request = new Request(`https://example.com${path}`, {
    headers: userAgent ? { 'user-agent': userAgent } : {},
  });
  const response = await worker.fetch(request, {}, ctx);
  await waitOnExecutionContext(ctx);
  return { logSpy, response };
}

describe('Bot Logging Worker', () => {
  it('identifies Googlebot-Image specifically (not as generic Googlebot)', async () => {
    const { logSpy } = await run('/img.png', 'Googlebot-Image/1.0');

    expect(logSpy).toHaveBeenCalledOnce();
    const entry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(entry.bot_name).toBe('Googlebot-Image');
  });

  it('still identifies plain Googlebot', async () => {
    const { logSpy } = await run('/page', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');

    const entry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(entry.bot_name).toBe('Googlebot');
  });

  it('does not log ordinary browser traffic', async () => {
    const { logSpy } = await run('/page', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15');

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('passes the request through unchanged', async () => {
    const { response } = await run('/page', 'Googlebot/2.1');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });
});
