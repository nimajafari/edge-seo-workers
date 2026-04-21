/**
 * 08 — Bot Logging (Verified Googlebot + AI crawlers)
 *
 * Logs verified search crawler requests without changing the response they receive.
 * Useful for crawl budget analysis, indexation debugging, and tracking AI bot
 * activity.
 *
 * IMPORTANT: this Worker does NOT modify the response served to bots. Serving
 * different content to crawlers vs users is cloaking:
 * https://developers.google.com/search/docs/essentials/spam-policies#cloaking
 *
 * Verification strategies supported:
 *   1. User-Agent match only (fast, but spoofable — fine for rough analytics).
 *   2. User-Agent + Cloudflare-verified bot flag (cf.verifiedBotCategory).
 *      This is the most reliable option and requires no network calls.
 *
 * For reverse-DNS verification (the technique Google publishes), you'd need
 * to call a DNS resolver — not recommended from the hot path. Do reverse-DNS
 * verification in your log pipeline instead.
 */

/**
 * Known bot User-Agent patterns. Loose matching is fine for logging.
 * See https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers
 */
const BOT_PATTERNS = [
  { name: 'Googlebot', regex: /Googlebot/i, category: 'search' },
  { name: 'Googlebot-Image', regex: /Googlebot-Image/i, category: 'search' },
  { name: 'Googlebot-News', regex: /Googlebot-News/i, category: 'search' },
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
      // waitUntil lets logging run without blocking the response.
      ctx.waitUntil(logBotRequest(request, bot));
    }

    // Always pass the request through unchanged.
    return fetch(request);
  },
};
