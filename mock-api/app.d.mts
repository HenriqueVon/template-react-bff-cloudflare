import type { Server } from 'node:http';

export const DEMO_USER: { id: string; name: string; email: string; password: string };

export type MockApiOptions = {
  // The x-api-key the fake API requires.
  apiKey: string;
  // The lifetime of an access token, in seconds. Default 900.
  accessTtlSeconds?: number;
  // How long the answer of a refresh takes, in milliseconds, after the token was replaced. Default 0.
  refreshDelayMs?: number;
  // The hosts a redirect_uri may have. Default: localhost and 127.0.0.1.
  allowedRedirectHosts?: string[];
};

export function createMockApi(options: MockApiOptions): Server;
