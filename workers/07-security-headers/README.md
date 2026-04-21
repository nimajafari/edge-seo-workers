# 07 — Security & Performance Headers

Inject security and performance headers that influence Core Web Vitals, E-E-A-T signals, and site trust scores — without origin changes.

## Use cases

- Sites that fail security scanner audits (securityheaders.com, Mozilla Observatory)
- Adding HSTS without waiting for a dev cycle
- Injecting `Link: rel=preconnect` hints for critical third-party resources
- Removing information-disclosure headers (`X-Powered-By`, `Server`) without touching infrastructure
- Enforcing `Permissions-Policy` to opt out of FLoC / Topics API across the site

## SEO relevance

Security headers don't directly rank sites, but they contribute in several indirect ways:

- **Core Web Vitals.** Preconnect / preload hints in the `Link` header can meaningfully improve LCP.
- **E-E-A-T and trust signals.** Security scanner scores are frequently cited in SEO audits and E-E-A-T assessments.
- **HTTPS consistency.** HSTS prevents protocol downgrade attacks and removes the edge case of a page being served over HTTP.
- **Crawl health.** Misconfigured headers (e.g., `X-Frame-Options: DENY` site-wide when you have legitimate embed scenarios) can cause fetch errors in tools like Google's URL Inspection.

## Configuration

Three constants at the top of `src/index.js`:

1. **`SECURITY_HEADERS`** — the core protection set. Applied to all responses.
2. **`PERFORMANCE_HEADERS`** — preconnect / preload hints. Only applied to HTML responses.
3. **`HEADERS_TO_REMOVE`** — fingerprinting headers stripped from the response.

## Deploy

```bash
npm install
npx wrangler login
npx wrangler deploy
```

## Testing

```bash
npx wrangler dev
# in another terminal:
curl -I http://localhost:8787/
```

After deploy, audit at:

- [Security Headers](https://securityheaders.com/) — targets an A+ rating
- [Mozilla Observatory](https://observatory.mozilla.org/) — broader security posture
- [PageSpeed Insights](https://pagespeed.web.dev/) — measures whether preconnect hints help LCP

## Critical warnings

- **HSTS is sticky.** Once a browser receives `Strict-Transport-Security` with a long `max-age`, it will *refuse* to connect over HTTP for that duration — even if you later roll back the Worker. Test with a short `max-age` (e.g., 300 seconds) first. Only enable `includeSubDomains` if every subdomain supports HTTPS.
- **HSTS `preload` is permanent.** Adding `preload` and submitting to the [HSTS preload list](https://hstspreload.org/) is effectively irreversible for months. Only do this on domains you're confident will stay HTTPS-only forever.
- **Content-Security-Policy can break everything.** This worker does *not* include a CSP by default because a misconfigured one blocks legitimate scripts, styles, and images and takes the site down visually. If you want CSP, roll it out in [report-only mode](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy-Report-Only) first, collect violation reports for a week, then enforce.
- **`X-Frame-Options: SAMEORIGIN` breaks legitimate embeds.** If partners embed your site (pricing widgets, booking tools, etc.), this header will break those. Use `frame-ancestors` in CSP for more granular control.
- **Don't duplicate origin headers.** If the origin already sets `Strict-Transport-Security` with a different value, the Worker's value wins (it runs on the way out). Align the two or remove from the origin.

## Extending this

- **Add CSP in report-only mode first:**
  ```javascript
  'content-security-policy-report-only': "default-src 'self'; script-src 'self' 'unsafe-inline'; report-uri /csp-report",
  ```
- **Per-path policies:** admin area gets stricter CSP than public marketing pages. Branch on `url.pathname`.
- **Early Hints (103):** for very high-traffic sites, use [103 Early Hints](https://developers.cloudflare.com/cache/advanced-configuration/early-hints/) instead of/in addition to Link headers for even faster resource hints.
- **Dynamic preload based on page type:** read origin hints (custom header, page class) and inject specific preload hints for that page's critical resources (hero image, above-the-fold font).
