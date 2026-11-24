import { copyFileSync, existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// The end-to-end tests run the app the way production does: the build served by the Functions, with the real headers of
// public/_headers, and the fake API behind them. A real browser drives it: the one installed on the machine (Chrome on
// the GitHub runners), so nothing is downloaded. Use another with E2E_CHANNEL=msedge, or `chromium` after
// `npx playwright install chromium`.
//
// The Functions read .dev.vars, and the fake API reads its API_KEY from the same file. A fresh checkout has only the
// example, which holds placeholders.
if (!existsSync('.dev.vars')) copyFileSync('.dev.vars.example', '.dev.vars');

const PORT = 8788;
const channel = process.env.E2E_CHANNEL ?? 'chrome';

export default defineConfig({
  testDir        : './e2e',
  // @template:only:start
  // The pictures of the README are taken only on request (e2e/screenshots.spec.ts).
  testIgnore     : process.env.SCREENSHOTS ? [] : ['**/screenshots.spec.ts'],
  // @template:only:end
  // The tests share the state of the fake API, so they run one at a time.
  fullyParallel  : false,
  workers        : 1,
  forbidOnly     : !!process.env.CI,
  retries        : process.env.CI ? 1 : 0,
  reporter       : process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout        : 30_000,
  expect         : { timeout: 7_000 },

  use: {
    baseURL    : `http://localhost:${PORT}`,
    trace      : 'retain-on-failure',
    screenshot : 'only-on-failure',
  },

  projects: [
    { name: channel, use: { ...devices['Desktop Chrome'], channel: channel === 'chromium' ? undefined : channel } },
    // The session leans on what browsers do differently: Web Locks, BroadcastChannel, cookies and the CSP. Firefox runs the
    // specs that exercise them. It has to be downloaded (`npx playwright install firefox`), so it is opt-in:
    // E2E_FIREFOX=1, which the CI sets. WebKit is not covered: Safari does not keep a Secure cookie on http://localhost
    // (pitfall 11 of docs/DEVELOPMENT.md), so the specs would fail for a reason that is not in the code.
    ...(process.env.E2E_FIREFOX
      ? [{ name: 'firefox', testMatch: /(session|security)\.spec\.ts$/, use: { ...devices['Desktop Firefox'] } }]
      : []),
  ],

  webServer: [
    {
      // A short access token, so the tests that wait for it to expire do not wait long. The rest of the tests are fast
      // enough not to notice, and the app renews the token by itself anyway.
      command             : 'node mock-api/server.mjs',
      port                : 4010,
      // The answer of a refresh is slow, so two tabs that refresh at the same time really overlap: without the lock between
      // tabs the second one would present the token the first one just replaced.
      env                 : { MOCK_ACCESS_TTL_SECONDS: '4', MOCK_REFRESH_DELAY_MS: '1200' },
      reuseExistingServer : !process.env.CI,
    },
    {
      command             : `npm run build && npx wrangler pages dev dist --port ${PORT}`,
      port                : PORT,
      timeout             : 180_000,
      reuseExistingServer : !process.env.CI,
    },
  ],
});
