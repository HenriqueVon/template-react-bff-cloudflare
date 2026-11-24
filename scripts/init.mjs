#!/usr/bin/env node
// Turns a fresh copy of this template into a new project. Run it once, right after copying the folder:
//
//   npm run init -- --name orders-web --login password
//   npm run init -- --name orders-web --login google --title "Orders" --remove-example
//
// It has no dependencies, so it runs before `npm install`. It deletes itself when it finishes.

import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_NAME = 'my-web-app';
const DEFAULT_TITLE = 'My Web App';

// The name ends up in the package, the CSRF header, the keys of the browser storage and the names of the channels, so
// keep it short and plain.
const MAX_NAME_LENGTH = 50;
const NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const LOGINS = ['password', 'google'];

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', '.wrangler', 'dist', 'coverage']);
const SELF = join(ROOT, 'scripts', 'init.mjs');

const toPath = (path) => join(ROOT, ...path.split('/'));

// Files and folders that only make sense in the template repository (its guide, changelog, security policy, CodeQL setup,
// the workflow that tests this script, and the pictures of its README with the test that takes them). They are never transformed and are deleted at the end.
const TEMPLATE_ONLY = [
  'TEMPLATE.md',
  'CHANGELOG.md',
  'SECURITY.md',
  '.github/workflows/codeql.yml',
  '.github/workflows/template-init.yml',
  'docs/images',
  'e2e/screenshots.spec.ts',
].map(toPath);

// What belongs only to the reference example, to the password login and to the Google login. The lines that mention them
// in shared files are wrapped in `@template:example`, `@template:login-password` and `@template:login-google` markers.
const EXAMPLE_FILES = [
  'src/api/examples.ts',
  'src/pages/examples',
  'src/i18n/messages/examples.ts',
  'e2e/examples.spec.ts',
].map(toPath);

const PASSWORD_FILES = [
  'functions/api/auth/login.ts',
  'tests/bff/login.spec.ts',
  'e2e/login-password.spec.ts',
].map(toPath);

const GOOGLE_FILES = [
  'functions/api/auth/exchange.ts',
  'functions/api/auth/google',
  'server/pkce.ts',
  'server/login.ts',
  'src/auth/callback.ts',
  'src/auth/callback.spec.ts',
  'src/pages/CallbackPage.tsx',
  'tests/bff/google.spec.ts',
  'tests/bff/pkce.spec.ts',
  'e2e/login-google.spec.ts',
].map(toPath);

function usage() {
  return [
    'Usage: npm run init -- --name <project-name> --login <password|google> [--title "<Project Title>"] [--remove-example]',
    '',
    '  --name <name>      kebab-case project name, e.g. orders-web (max ' + MAX_NAME_LENGTH + ' characters).',
    '                     Used for the package, the CSRF header, the keys of the browser storage and the docs.',
    '  --login <kind>     How users sign in. "password": email and password. "google": Google, with PKCE.',
    '                     The code of the other one is removed.',
    '  --title "<title>"  Human title shown in the menu and on the login page. Default: derived from the name.',
    '  --remove-example   Delete the reference "examples" screen, its API module and its texts.',
    '',
  ].join('\n');
}

function fail(message) {
  console.error(`\nError: ${message}\n`);
  console.error(usage());
  process.exit(1);
}

function parseArguments(argv) {
  const options = { name: undefined, title: undefined, login: undefined, removeExample: false };

  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];

    if (argument === '--help' || argument === '-h') {
      console.info(usage());
      process.exit(0);
    } else if (argument === '--name') {
      options.name = argv[++i];
    } else if (argument === '--title') {
      options.title = argv[++i];
    } else if (argument === '--login') {
      options.login = argv[++i];
    } else if (argument === '--remove-example') {
      options.removeExample = true;
    } else {
      fail(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function titleFromName(name) {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function* walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (TEMPLATE_ONLY.includes(path)) continue;

    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) yield* walk(path);
    } else if (entry.isFile() && path !== SELF) {
      yield path;
    }
  }
}

// Removes the lines between `@template:<name>:start` and `@template:<name>:end`, markers included. Files with an
// unbalanced pair are reported and left untouched.
function removeBlocks(text, name, file) {
  const start = `@template:${name}:start`;
  const end = `@template:${name}:end`;
  const output = [];
  let inside = false;

  for (const line of text.split('\n')) {
    if (line.includes(start)) {
      inside = true;
    } else if (line.includes(end)) {
      inside = false;
    } else if (!inside) {
      output.push(line);
    }
  }

  if (inside) {
    console.warn(`Warning: unbalanced "${start}" marker in ${relative(ROOT, file)}; file left unchanged.`);
    return text;
  }

  return output.join('\n');
}

// Removes only the marker lines of `@template:<name>`, keeping what is between them.
function removeMarkerLines(text, name) {
  return text
    .split('\n')
    .filter((line) => !line.includes(`@template:${name}:start`) && !line.includes(`@template:${name}:end`))
    .join('\n');
}

// A marker of one line, `<!-- @template:<name>:line -->` at the end of it, for the places where a block marker would break the
// markdown (the row of a table). The line is dropped, or only the marker is.
function applyLineMarkers(text, name, keep) {
  const marker = new RegExp(`[ \\t]*<!--\\s*@template:${name}:line\\s*-->`);

  return text
    .split('\n')
    .filter((line) => keep || !marker.test(line))
    .map((line) => line.replace(marker, ''))
    .join('\n');
}

// Keeps or drops what belongs to one option, in this order: a block that is dropped may hold the markers of another one.
function applyOption(text, name, keep, file) {
  return applyLineMarkers(keep ? removeMarkerLines(text, name) : removeBlocks(text, name, file), name, keep);
}

function transformFile(file, options) {
  const buffer = readFileSync(file);
  if (buffer.includes(0)) return; // binary

  const original = buffer.toString('utf8');
  let text = original;

  text = text.replaceAll(DEFAULT_TITLE, options.title);
  text = text.replaceAll(DEFAULT_NAME, options.name);

  // Template-only blocks (usage notes of the template itself) never reach a project
  text = removeBlocks(text, 'only', file);

  text = applyOption(text, 'login-password', options.login === 'password', file);
  text = applyOption(text, 'login-google', options.login === 'google', file);
  text = applyOption(text, 'example', !options.removeExample, file);

  if (text !== original) writeFileSync(file, text);
}

function createDevVarsFile() {
  const devVars = join(ROOT, '.dev.vars');
  if (existsSync(devVars)) return false;

  const apiKey = randomBytes(32).toString('hex');
  const example = readFileSync(join(ROOT, '.dev.vars.example'), 'utf8');
  writeFileSync(devVars, example.replace(/^API_KEY=.*$/m, `API_KEY=${apiKey}`));
  return true;
}

function removeInitFromPackageJson() {
  const file = join(ROOT, 'package.json');
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  delete manifest.scripts.init;
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

function main() {
  const options = parseArguments(process.argv.slice(2));

  if (!options.name) fail('--name is required.');
  if (!NAME_PATTERN.test(options.name)) fail(`"${options.name}" is not a kebab-case name (lowercase letters, digits and single hyphens).`);
  if (options.name.length > MAX_NAME_LENGTH) fail(`"${options.name}" has more than ${MAX_NAME_LENGTH} characters.`);
  if (!options.login) fail('--login is required: "password" or "google".');
  if (!LOGINS.includes(options.login)) fail(`--login must be one of: ${LOGINS.join(', ')}.`);
  options.title ??= titleFromName(options.name);

  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  if (manifest.name !== DEFAULT_NAME) {
    fail(`This project was already initialized (package name is "${manifest.name}").`);
  }

  // Files go first, so the markers are only read in the files that stay.
  const removed = [
    ...(options.removeExample ? EXAMPLE_FILES : []),
    ...(options.login === 'password' ? GOOGLE_FILES : PASSWORD_FILES),
  ];
  for (const path of removed) rmSync(path, { recursive: true, force: true });

  for (const file of walk(ROOT)) {
    transformFile(file, options);
  }

  const devVarsCreated = createDevVarsFile();

  removeInitFromPackageJson();
  for (const path of TEMPLATE_ONLY) rmSync(path, { recursive: true, force: true });
  rmSync(SELF, { force: true });
  if (readdirSync(join(ROOT, 'scripts')).length === 0) rmSync(join(ROOT, 'scripts'), { recursive: true, force: true });

  console.info(`\nProject "${options.name}" (${options.title}) is ready.`);
  console.info(options.login === 'password' ? 'Login: email and password.' : 'Login: Google, with PKCE.');
  console.info(options.removeExample ? 'The example screen was removed.' : 'The example screen was kept: delete it when you no longer need it as a reference.');
  console.info(devVarsCreated ? '.dev.vars was created from .dev.vars.example with a generated API_KEY.' : '.dev.vars already existed and was not touched.');
  console.info([
    '',
    'Next steps:',
    '  1. npm install',
    '  2. npm run dev                 (the fake API, the Functions and Vite; open http://localhost:5173)',
    options.login === 'password'
      ? '     Sign in with demo@example.com / demo-password.'
      : '     The fake sign-in service signs in the demo user at once.',
    '  3. npm run lint && npm run check:ts && npm run test:run && npm run build',
    '',
    'Then point API_URL in .dev.vars (and in Cloudflare) to your API, and replace the fake one: docs/API-CONTRACT.md',
    'lists what the Functions expect from it.',
    '',
    'Before the first deploy: create the Pages project, set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_PAGES_PROJECT as variables',
    'and CLOUDFLARE_API_TOKEN as a secret in the dev and prd GitHub environments, and set the variables of the Functions in',
    'the Pages project (docs/DEVELOPMENT.md, "Deployment").',
    '',
  ].join('\n'));
}

main();
