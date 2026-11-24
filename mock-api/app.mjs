// A fake API for development, the tests and the CI. It implements the contract in docs/API-CONTRACT.md in memory, with
// no dependencies, so the template runs without any real service. It is a stand-in, not a model of your API: keep it
// only as long as it is useful, and replace `API_URL` with your API when you have one.
//
// It is not secure and must never face the internet: the demo user and the tokens exist only in this process.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const BASE_PATH = '/v1/api';
const MAX_BODY_BYTES = 64 * 1024;

export const DEMO_USER = { id: 'user-demo', name: 'Demo User', email: 'demo@example.com', password: 'demo-password' };

// @template:login-google:start
const AUTH_CODE_TTL_MS = 5 * 60_000;
// @template:login-google:end

function sha256(text) {
  return createHash('sha256').update(text).digest();
}

function safeEqual(a, b) {
  return timingSafeEqual(sha256(a), sha256(b));
}

function randomToken(bytes = 24) {
  return randomBytes(bytes).toString('base64url');
}

function json(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  response.end(JSON.stringify(body));
}

function empty(response, status, headers = {}) {
  response.writeHead(status, headers);
  response.end();
}

function error(response, status, code, message, headers) {
  json(response, status, { message, code }, headers);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return { ok: false };
    chunks.push(chunk);
  }

  if (size === 0) return { ok: true, value: {} };

  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  } catch {
    return { ok: false };
  }
}

// The same shape of error as the API template: a message, the list of invalid fields and a code per field.
function invalid(response, where, issues) {
  json(response, 400, {
    message : `Invalid ${where}`,
    errors  : Object.fromEntries(issues.map((issue) => [issue.path, [issue.message]])),
    issues,
  });
}

// @template:example:start
function checkExample(body, { partial }) {
  const issues = [];
  const allowed = new Set(['name', 'description']);

  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) issues.push({ path: key, message: 'Unrecognized key', code: 'unrecognized_keys' });
  }

  if (body.name !== undefined || !partial) {
    if (typeof body.name !== 'string') issues.push({ path: 'name', message: 'Required', code: 'invalid_type' });
    else if (body.name.length < 3) issues.push({ path: 'name', message: 'Name must have at least 3 characters', code: 'too_small' });
    else if (body.name.length > 100) issues.push({ path: 'name', message: 'Name must have at most 100 characters', code: 'too_big' });
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') issues.push({ path: 'description', message: 'Expected string', code: 'invalid_type' });
    else if (body.description.length > 255) issues.push({ path: 'description', message: 'Description must have at most 255 characters', code: 'too_big' });
  }

  if (partial && Object.keys(body).length === 0) issues.push({ path: '', message: 'At least one field must be provided', code: 'custom' });

  return issues;
}
// @template:example:end

// options: apiKey (required), accessTtlSeconds (default 900), refreshDelayMs (default 0: how long the answer of a refresh takes,
// after the token was already replaced, to make two refreshes at once overlap in a test), allowedRedirectHosts (default:
// localhost only).
export function createMockApi(options) {
  const accessTtlSeconds = options.accessTtlSeconds ?? 900;
  const refreshDelayMs = options.refreshDelayMs ?? 0;
  // @template:login-google:start
  const allowedRedirectHosts = options.allowedRedirectHosts ?? ['localhost', '127.0.0.1'];
  // @template:login-google:end

  const accessTokens = new Map(); // access token -> { userId, sessionId, expiresAt }
  const sessions = new Map(); // session id -> { userId, refreshSecret }
  // @template:login-password:start
  const failedLogins = new Map(); // email -> { count, firstAt }
  // @template:login-password:end
  // @template:login-google:start
  const authCodes = new Map(); // code -> { challenge, redirectUri, expiresAt }
  // @template:login-google:end
  // @template:example:start
  const examples = new Map();
  let counter = 0;

  function addExample(name, description) {
    counter += 1;
    const now = new Date().toISOString();
    const example = { id: `example-${counter}`, name, description, createdAt: now, updatedAt: now };
    examples.set(example.id, example);
    return example;
  }

  addExample('First example', 'A record used to show the pattern of a module');
  addExample('Second example', null);
  addExample('Third example', 'Delete it, edit it or create more');
  // @template:example:end

  function issueTokens(userId, sessionId) {
    const session = sessions.get(sessionId);
    session.refreshSecret = randomToken();

    const accessToken = `at_${randomToken()}`;
    accessTokens.set(accessToken, { userId, sessionId, expiresAt: Date.now() + accessTtlSeconds * 1000 });

    return { accessToken, tokenType: 'Bearer', expiresIn: accessTtlSeconds, refreshToken: `${sessionId}.${session.refreshSecret}` };
  }

  function startSession(userId) {
    const sessionId = `session-${randomToken(8)}`;
    sessions.set(sessionId, { userId, refreshSecret: '' });
    return issueTokens(userId, sessionId);
  }

  function revokeSession(sessionId) {
    sessions.delete(sessionId);
    for (const [token, access] of accessTokens) {
      if (access.sessionId === sessionId) accessTokens.delete(token);
    }
  }

  function readRefreshToken(value) {
    if (typeof value !== 'string') return null;
    const separator = value.indexOf('.');
    if (separator < 1) return null;

    return { sessionId: value.slice(0, separator), secret: value.slice(separator + 1) };
  }

  // The user of a Bearer token, or a response that was already sent.
  function authenticate(request, response) {
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const access = accessTokens.get(token);

    if (!access) {
      error(response, 401, 'AUTH_TOKEN_INVALID', 'Invalid token');
      return null;
    }

    if (access.expiresAt <= Date.now()) {
      accessTokens.delete(token);
      error(response, 401, 'AUTH_TOKEN_EXPIRED', 'Token expired');
      return null;
    }

    return access;
  }

  // @template:login-password:start
  async function login(request, response) {
    const body = await readJson(request);
    const email = typeof body.value?.email === 'string' ? body.value.email.toLowerCase() : '';
    const password = typeof body.value?.password === 'string' ? body.value.password : '';

    if (!body.ok || email === '' || password === '') return invalid(response, 'body', [{ path: 'email', message: 'Email and password are required', code: 'invalid_type' }]);

    // Five wrong passwords in a minute for the same email: wait. It shows how the app handles a 429.
    const failures = failedLogins.get(email);
    if (failures && Date.now() - failures.firstAt < 60_000 && failures.count >= 5) {
      return error(response, 429, 'RATE_LIMITED', 'Too many attempts', { 'Retry-After': '30' });
    }

    if (email !== DEMO_USER.email || !safeEqual(password, DEMO_USER.password)) {
      const current = failures && Date.now() - failures.firstAt < 60_000 ? failures : { count: 0, firstAt: Date.now() };
      failedLogins.set(email, { count: current.count + 1, firstAt: current.firstAt });
      return error(response, 401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password');
    }

    failedLogins.delete(email);
    json(response, 200, startSession(DEMO_USER.id));
  }
  // @template:login-password:end

  // @template:login-google:start
  // The page of the sign-in service. The real one sends the browser to Google; this one signs in the demo user at once
  // and goes back to the app with a code, like the real one does after Google.
  function startGoogle(url, response) {
    const params = url.searchParams;
    const redirectUri = params.get('redirect_uri') ?? '';
    const state = params.get('state') ?? '';
    const challenge = params.get('code_challenge') ?? '';

    let redirect;
    try {
      redirect = new URL(redirectUri);
    } catch {
      return error(response, 400, 'BAD_REQUEST', 'Invalid redirect_uri');
    }

    // Redirect URLs are exact: a real service compares them with the ones registered for the client.
    if (!allowedRedirectHosts.includes(redirect.hostname) || redirect.pathname !== '/auth/callback' || redirect.search !== '') {
      return error(response, 400, 'BAD_REQUEST', 'redirect_uri is not registered');
    }

    if (!params.get('client_id') || state === '' || challenge === '' || params.get('code_challenge_method') !== 'S256') {
      return error(response, 400, 'BAD_REQUEST', 'Missing client_id, state or PKCE challenge');
    }

    const code = `code_${randomToken()}`;
    authCodes.set(code, { challenge, redirectUri, expiresAt: Date.now() + AUTH_CODE_TTL_MS });

    redirect.searchParams.set('code', code);
    redirect.searchParams.set('state', state);
    empty(response, 302, { Location: redirect.toString() });
  }

  async function exchangeCode(request, response) {
    const body = await readJson(request);
    const { code, codeVerifier, redirectUri } = body.value ?? {};
    const entry = typeof code === 'string' ? authCodes.get(code) : undefined;

    // A code works once, whatever the outcome.
    if (typeof code === 'string') authCodes.delete(code);

    const challenge = typeof codeVerifier === 'string' ? createHash('sha256').update(codeVerifier).digest('base64url') : '';

    if (!body.ok || !entry || entry.expiresAt <= Date.now() || entry.redirectUri !== redirectUri || !safeEqual(challenge, entry.challenge)) {
      return error(response, 401, 'AUTH_CODE_INVALID', 'Invalid code');
    }

    json(response, 200, startSession(DEMO_USER.id));
  }
  // @template:login-google:end

  async function refresh(request, response) {
    const body = await readJson(request);
    if (!body.ok) return invalid(response, 'body', [{ path: '', message: 'Body must be a JSON object', code: 'invalid_type' }]);

    const token = readRefreshToken(body.value?.refreshToken);
    const session = token ? sessions.get(token.sessionId) : undefined;

    if (!token || !session) return error(response, 401, 'AUTH_TOKEN_INVALID', 'Invalid refresh token');

    // A replaced refresh token used again means it leaked: the whole session ends, as in a real API.
    if (!safeEqual(token.secret, session.refreshSecret)) {
      revokeSession(token.sessionId);
      return error(response, 401, 'AUTH_SESSION_REVOKED', 'Session revoked');
    }

    // The token is replaced now; only the answer is late, as it is when the network or the API is slow.
    const tokens = issueTokens(session.userId, token.sessionId);
    if (refreshDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, refreshDelayMs));

    json(response, 200, tokens);
  }

  async function logout(request, response) {
    const body = await readJson(request);
    const token = readRefreshToken(body.value?.refreshToken);
    if (token) revokeSession(token.sessionId);

    empty(response, 204);
  }

  async function logoutAll(request, response) {
    const body = await readJson(request);
    const token = readRefreshToken(body.value?.refreshToken);
    const session = token ? sessions.get(token.sessionId) : undefined;

    if (!token || !session || !safeEqual(token.secret, session.refreshSecret)) {
      return error(response, 401, 'AUTH_TOKEN_INVALID', 'Invalid refresh token');
    }

    for (const [id, other] of [...sessions]) {
      if (other.userId === session.userId) revokeSession(id);
    }

    empty(response, 204);
  }

  function me(request, response) {
    if (!authenticate(request, response)) return;

    const { id, name, email } = DEMO_USER;
    json(response, 200, { id, name, email });
  }

  // @template:example:start
  function listExamples(url, response) {
    const params = url.searchParams;
    const limit = Number(params.get('limit') ?? 100);
    const offset = Number(params.get('offset') ?? 0);
    const orderBy = params.get('orderBy') ?? 'createdAt';
    const direction = params.get('orderDirection') === 'desc' ? -1 : 1;

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return invalid(response, 'query', [{ path: 'limit', message: 'Must be between 1 and 100', code: 'too_big' }]);
    if (!Number.isInteger(offset) || offset < 0) return invalid(response, 'query', [{ path: 'offset', message: 'Must be 0 or more', code: 'too_small' }]);
    if (!['id', 'name', 'createdAt'].includes(orderBy)) return invalid(response, 'query', [{ path: 'orderBy', message: 'Invalid option', code: 'invalid_value' }]);

    const all = [...examples.values()].sort((a, b) => direction * (String(a[orderBy]).localeCompare(String(b[orderBy])) || a.id.localeCompare(b.id, 'en', { numeric: true })));

    json(response, 200, { items: all.slice(offset, offset + limit), total: all.length });
  }

  function hasName(name, exceptId) {
    return [...examples.values()].some((example) => example.id !== exceptId && example.name.toLowerCase() === name.toLowerCase());
  }

  async function writeExample(request, response, id) {
    const body = await readJson(request);
    const partial = id !== undefined;
    const issues = body.ok ? checkExample(body.value, { partial }) : [{ path: '', message: 'Body must be a JSON object', code: 'invalid_type' }];
    if (issues.length > 0) return invalid(response, 'body', issues);

    const { name, description } = body.value;
    if (name !== undefined && hasName(name, id)) return error(response, 409, 'CONFLICT', 'Example name already exists!');

    if (id === undefined) {
      return json(response, 201, addExample(name, description ?? null));
    }

    const example = examples.get(id);
    if (name !== undefined) example.name = name;
    if (description !== undefined) example.description = description;
    example.updatedAt = new Date().toISOString();

    json(response, 200, example);
  }
  // @template:example:end

  async function handle(request, response) {
    const url = new URL(request.url ?? '/', 'http://mock.local');

    if (!url.pathname.startsWith(`${BASE_PATH}/`)) return error(response, 404, 'NOT_FOUND', 'Not found');
    const path = url.pathname.slice(BASE_PATH.length);
    const method = request.method ?? 'GET';

    // Every route needs the API key, like the API template. The sign-in redirect is the one the browser visits itself.
    const isBrowserRedirect = path === '/auth/google';
    const key = request.headers['x-api-key'];
    if (!isBrowserRedirect && (typeof key !== 'string' || !safeEqual(key, options.apiKey))) {
      return error(response, 401, 'UNAUTHORIZED', 'Missing or invalid x-api-key');
    }

    // @template:login-password:start
    if (method === 'POST' && path === '/auth/login') return login(request, response);
    // @template:login-password:end
    // @template:login-google:start
    if (method === 'GET' && path === '/auth/google') return startGoogle(url, response);
    if (method === 'POST' && path === '/auth/exchange-code') return exchangeCode(request, response);
    // @template:login-google:end
    if (method === 'POST' && path === '/auth/refresh') return refresh(request, response);
    if (method === 'POST' && path === '/auth/logout') return logout(request, response);
    if (method === 'POST' && path === '/auth/logout-all') return logoutAll(request, response);
    if (method === 'GET' && path === '/auth/me') return me(request, response);

    // @template:example:start
    const match = /^\/examples(?:\/([^/]+))?$/.exec(path);
    if (match) {
      if (!authenticate(request, response)) return;

      const id = match[1];
      if (id === undefined && method === 'GET') return listExamples(url, response);
      if (id === undefined && method === 'POST') return writeExample(request, response);

      const example = id === undefined ? undefined : examples.get(id);
      if (id !== undefined && !example) return error(response, 404, 'NOT_FOUND', 'Resource not found');
      if (method === 'GET') return json(response, 200, example);
      if (method === 'PATCH') return writeExample(request, response, id);
      if (method === 'DELETE') {
        examples.delete(id);
        return empty(response, 204);
      }
    }
    // @template:example:end

    error(response, 404, 'NOT_FOUND', 'Not found');
  }

  return createServer((request, response) => {
    handle(request, response).catch(() => {
      if (!response.headersSent) error(response, 500, 'INTERNAL_ERROR', 'Internal server error');
    });
  });
}
