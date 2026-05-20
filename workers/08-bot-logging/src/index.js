/**
 * 08 — Bot Logging (search + AI crawlers)
 *
 * Logs search and AI crawler requests without changing the response they
 * receive. Useful for crawl budget analysis, indexation debugging, and
 * tracking AI bot activity.
 *
 * IMPORTANT: this Worker does NOT modify the response served to bots. Serving
 * different content to crawlers vs users is cloaking:
 * https://developers.google.com/search/docs/essentials/spam-policies#cloaking
 *
 * Identification vs. verification — these are different things:
 *   - Identification is a User-Agent match. It's fast but spoofable, so on its
 *     own it's only good for rough analytics.
 *   - Verification confirms the request really came from the crawler it claims
 *     to be. Cloudflare exposes this as `cf.verifiedBotCategory` with no extra
 *     network call.
 *
 * Every logged entry records BOTH: the matched bot name and the Cloudflare
 * verification result, so you can filter spoofed traffic downstream. If you
 * only ever want verified bots in your logs, flip REQUIRE_VERIFICATION to true.
 *
 * For reverse-DNS verification (the technique Google publishes), you'd need
 * to call a DNS resolver — not recommended from the hot path. Do reverse-DNS
 * verification in your log pipeline instead.
 */

/**
 * When true, only log requests Cloudflare has independently verified as a real
 * bot (cf.verifiedBotCategory is set). When false (default), log every
 * User-Agent match and annotate it with the verification result so you can
 * filter later. Leave false for rough analytics, true for clean crawl logs.
 */
const REQUIRE_VERIFICATION = false;

/**
 * Known bot User-Agent patterns. Loose matching is fine for logging.
 *
 * Order matters: identifyBot() returns the FIRST match, so the most specific
 * patterns must come first. "Googlebot-Image/1.0" contains the substring
 * "Googlebot", so a generic /Googlebot/ pattern would shadow the specific
 * variants if it were listed ahead of them.
 *
 * See https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers
 */
const BOT_PATTERNS = [
  { name: 'Googlebot-Image', regex: /Googlebot-Image/i, category: 'search' },
  { name: 'Googlebot-News', regex: /Googlebot-News/i, category: 'search' },
  { name: 'Googlebot', regex: /Googlebot/i, category: 'search' },
  { name: 'Bingbot', regex: /bingbot/i, category: 'search' },
  { name: 'DuckDuckBot', regex: /DuckDuckBot/i, category: 'search' },
  { name: 'Baiduspider', regex: /Baiduspider/i, category: 'search' },
  { name: 'YandexBot', regex: /YandexBot/i, category: 'search' },
  { name: 'AhrefsBot', regex: /AhrefsBot/i, category: 'seo-tool' },
  { name: 'SemrushBot', regex: /SemrushBot/i, category: 'seo-tool' },
  { name: 'GPTBot', regex: /GPTBot/i, category: 'ai-training' },
  { name: 'ClaudeBot', regex: /ClaudeBot|anthropic-ai/i, category: 'ai-training' },
  { name: 'CCBot', regex: /CCBot/i, category: 'ai-training' },
  { name: 'PerplexityBot', regex: /PerplexityBot/i, category: 'ai-user-agent' },
];

function identifyBot(userAgent) {
  if (!userAgent) return null;
  for (const pattern of BOT_PATTERNS) {
    if (pattern.regex.test(userAgent)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Build a log entry from the request. Fire-and-forget.
 */
async function logBotRequest(request, bot) {
  const url = new URL(request.url);

  // Cloudflare provides request metadata at request.cf
  const cf = request.cf || {};

  const entry = {
    timestamp: new Date().toISOString(),
    bot_name: bot.name,
    bot_category: bot.category,
    verified_by_cloudflare: cf.verifiedBotCategory || null,
    method: request.method,
    url: request.url,
    path: url.pathname,
    query: url.search,
    user_agent: request.headers.get('user-agent'),
    client_ip: request.headers.get('cf-connecting-ip'),
    country: cf.country || null,
    asn: cf.asn || null,
    referer: request.headers.get('referer'),
    accept_language: request.headers.get('accept-language'),
  };

  // Replace this with your real logging endpoint. Options:
  //   - Workers Logs (automatic, no code): use console.log() and enable observability
  //   - Logpush to R2 / S3 / external SIEM
  //   - Direct POST to your analytics backend
  //   - Write to a Cloudflare Queue for batch processing

  // Default: emit to Workers Logs via console.log.
  // Workers Logs captures these in the Cloudflare dashboard automatically.
  console.log(JSON.stringify(entry));
}

export default {
  async fetch(request, env, ctx) {
    const userAgent = request.headers.get('user-agent');
    const bot = identifyBot(userAgent);

    if (bot) {
      const verified = Boolean(request.cf?.verifiedBotCategory);
      // When REQUIRE_VERIFICATION is on, skip spoofable UA-only matches.
      if (!REQUIRE_VERIFICATION || verified) {
        // waitUntil lets logging run without blocking the response.
        ctx.waitUntil(logBotRequest(request, bot));
      }
    }

    // Always pass the request through unchanged.
    return fetch(request);
  },
};
