// Guardrails for a repository that may be public (docs/SECURITY.md). They check the repository itself: secrets stay out
// of git, examples hold placeholders, the headers and the workflow keep their protections. Do not edit a rule here to make
// a change pass; report it instead.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));

function read(path: string): string {
  return readFileSync(`${root}${path}`, 'utf8');
}

const NOT_COMMITTED = new Set(['node_modules', 'dist', '.wrangler', '.git', 'coverage']);
const LOCAL_SECRET_FILE = /(^|\/)(\.dev\.vars|\.env(\..*)?)$/;

// Without a git repository (a copy of the template that has not been through `git init` yet), every file that git would not
// ignore: the folders that are never committed and the local secret files are left out.
function walk(directory: string, prefix = ''): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${prefix}${entry.name}`;
    // node_modules may be a link (a shared install), which is not a directory for readdir.
    if (NOT_COMMITTED.has(entry.name)) return [];
    if (entry.isDirectory()) return walk(join(directory, entry.name), `${path}/`);

    return LOCAL_SECRET_FILE.test(path) && entry.name !== '.dev.vars.example' && entry.name !== '.env.example' ? [] : [path];
  });
}

// Tracked files plus new files that are not ignored: what the next commit could contain.
function repositoryFiles(): string[] {
  try {
    const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      cwd    : root,
      encoding : 'utf8',
      stdio  : ['ignore', 'pipe', 'ignore'],
    });

    return output.split('\n').filter((file) => file !== '');
  } catch {
    return walk('.');
  }
}

const SKIPPED_FILES = ['package-lock.json'];

function textFiles(): { path: string; content: string }[] {
  return repositoryFiles()
    // A file deleted from the disk but still in the index cannot be committed as it was: nothing to read.
    .filter((path) => existsSync(`${root}${path}`))
    .filter((path) => !SKIPPED_FILES.includes(path))
    .map((path) => ({ path, content: readFileSync(`${root}${path}`) }))
    .filter(({ content }) => content.length < 1_000_000 && !content.includes(0))
    .map(({ path, content }) => ({ path, content: content.toString('utf8') }));
}

const SECRET_PATTERNS: [string, RegExp][] = [
  ['a private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['an AWS access key id', /\bAKIA[0-9A-Z]{16}\b/],
  ['a JSON Web Token', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
  ['a GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['a Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['a Google OAuth client secret', /\bGOCSPX-[0-9A-Za-z_-]{20,}/],
  ['a Slack token', /\bxox[baprs]-[0-9A-Za-z-]{10,}/],
];

describe('repository guardrails', () => {
  describe('secrets stay out of git', () => {
    it('should ignore the local secret files', () => {
      const ignored = read('.gitignore').split(/\r?\n/);

      for (const entry of ['.dev.vars', '.env', '.env.*', '.wrangler/', 'dist', 'node_modules/']) {
        expect(ignored, entry).toContain(entry);
      }
    });

    it('should not track a local secret file', () => {
      expect(repositoryFiles().filter((path) => LOCAL_SECRET_FILE.test(path) && !path.endsWith('.example'))).toEqual([]);
    });

    it('should match no secret pattern in any file of the repository', () => {
      const findings: string[] = [];

      for (const { path, content } of textFiles()) {
        for (const [name, pattern] of SECRET_PATTERNS) {
          if (pattern.test(content)) findings.push(`${path}: looks like ${name}`);
        }
      }

      expect(findings).toEqual([]);
    });

    it('should hold only placeholders and local addresses in .dev.vars.example', () => {
      const values = read('.dev.vars.example')
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'))
        .map((line) => line.slice(line.indexOf('=') + 1));

      expect(values.length).toBeGreaterThan(0);
      for (const value of values) {
        expect(value, value).toMatch(/^(https?:\/\/)?(replace-with-|localhost[:/])/);
      }
    });

    it('should not put a secret in a VITE_ variable, which reaches the browser', () => {
      const secretName = /VITE_[A-Z0-9_]*(KEY|SECRET|TOKEN|PASSWORD)/;
      const offenders = textFiles()
        .filter(({ path }) => !path.endsWith('.md') && !path.startsWith('tests/repo/'))
        .filter(({ content }) => secretName.test(content))
        .map(({ path }) => path);

      expect(offenders).toEqual([]);
    });
  });

  describe('browser protections', () => {
    const headers = read('public/_headers');
    const csp = headers.match(/Content-Security-Policy:\s*(.+)/)?.[1] ?? '';

    it('should send a strict Content-Security-Policy', () => {
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).not.toContain('unsafe-eval');
      expect(csp.match(/script-src[^;]*/)?.[0]).not.toContain('unsafe-inline');
    });

    it('should send the security headers and ask crawlers to stay out', () => {
      for (const header of ['X-Frame-Options: DENY', 'X-Content-Type-Options: nosniff', 'Referrer-Policy: no-referrer', 'Strict-Transport-Security', 'X-Robots-Tag: noindex']) {
        expect(headers, header).toContain(header);
      }

      expect(read('index.html')).toContain('noindex');
      expect(read('public/robots.txt')).toContain('Disallow: /');
    });
  });

  describe('workflow', () => {
    const workflow = read('.github/workflows/deploy.yml');

    it('should keep the default token read-only', () => {
      expect(workflow).toMatch(/^permissions:\s*\n\s+contents: read/m);
    });

    it('should never run on pull_request_target', () => {
      expect(workflow).not.toContain('pull_request_target');
    });

    it('should deploy only from pushes, inside the dev and prd environments', () => {
      expect(workflow).toContain("github.event_name != 'pull_request'");
      expect(workflow).toContain('environment: dev');
      expect(workflow).toContain('environment: prd');
    });
  });
});
