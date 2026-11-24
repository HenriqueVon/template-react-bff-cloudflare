import { expect, type Page } from '@playwright/test';

// The demo user of the fake API (mock-api/app.mjs).
export const DEMO = { name: 'Demo User', email: 'demo@example.com', password: 'demo-password' };

// The time the fake API gives an access token in these tests (playwright.config.ts), and a little more.
export const TOKEN_LIFETIME_MS = 4_000;
export const AFTER_EXPIRY_MS = TOKEN_LIFETIME_MS + 1_500;

type Login = (page: Page) => Promise<void>;

// @template:login-password:start
export const signInWithPassword: Login = async (page) => {
  await page.getByLabel('Email').fill(DEMO.email);
  await page.getByLabel('Password').fill(DEMO.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
};
// @template:login-password:end

// @template:login-google:start
export const signInWithGoogle: Login = async (page) => {
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
};
// @template:login-google:end

// The logins this project has. A project has one; the template has both, and uses the first.
const logins: Login[] = [];
// @template:login-password:start
logins.push(signInWithPassword);
// @template:login-password:end
// @template:login-google:start
logins.push(signInWithGoogle);
// @template:login-google:end

// Signs in with the login of the project and waits for the home page.
export async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await logins[0](page);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
}

export async function openUserMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'User menu' }).click();
}
