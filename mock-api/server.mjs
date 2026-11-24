// Starts the fake API for `npm run dev`. It reads API_KEY from .dev.vars, so the key the Functions send is the one it
// expects; without that file it uses the placeholder of .dev.vars.example. See app.mjs and docs/API-CONTRACT.md.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockApi, DEMO_USER } from './app.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.MOCK_API_PORT ?? 4010);

function readDevVars() {
  const file = join(root, '.dev.vars');
  if (!existsSync(file)) return {};

  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }

  return values;
}

const apiKey = readDevVars().API_KEY || 'replace-with-the-api-key';
// A short access token makes the refresh visible while you develop: MOCK_ACCESS_TTL_SECONDS=20 npm run dev:api
const accessTtlSeconds = Number(process.env.MOCK_ACCESS_TTL_SECONDS ?? 900);

createMockApi({ apiKey, accessTtlSeconds }).listen(port, '127.0.0.1', () => {
  console.info(`Fake API on http://localhost:${port}/v1/api (access token lifetime: ${accessTtlSeconds} s)`);
  console.info(`Demo user: ${DEMO_USER.email} / ${DEMO_USER.password}`);
});
