import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// Runs the test suite inside the real Workers runtime (workerd) via Miniflare.
// This is what gives tests access to HTMLRewriter, request.cf, the streaming
// Response body, and other runtime APIs that a plain Node/jsdom environment
// can't provide — several Workers in this repo can't be tested without it.
export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        // Keep in sync with the compatibility_date in each wrangler.toml.
        compatibilityDate: '2025-01-01',
        // vitest-pool-workers requires the nodejs_compat flag to run.
        compatibilityFlags: ['nodejs_compat'],
      },
    }),
  ],
  test: {},
});
