import { expect, test } from '@playwright/test';
import { DEMO } from './support';

test.describe('the login with an email and a password', () => {
  test('refuses a wrong password with a message, and keeps the form', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(DEMO.email);
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByRole('alert')).toHaveText('The email or the password is wrong.');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('Email')).toHaveValue(DEMO.email);
  });

  test('asks for the two fields before calling the API', async ({ page }) => {
    await page.goto('/login');
    let calls = 0;
    await page.route('**/api/auth/login', (route) => {
      calls += 1;
      return route.continue();
    });

    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByRole('alert')).toHaveText('Enter your email and your password.');
    expect(calls).toBe(0);
  });

  test('says how long to wait after too many wrong passwords', async ({ page }) => {
    await page.goto('/login');
    const email = `someone-${Date.now()}@example.com`;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill('wrong-password');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page.getByRole('alert')).toBeVisible();
    }

    await expect(page.getByRole('alert')).toHaveText('Too many attempts. Try again in 30 seconds.');
  });

  test('sends the user back to the page they wanted', async ({ page }) => {
    await page.goto('/not-a-page-yet');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email').fill(DEMO.email);
    await page.getByLabel('Password').fill(DEMO.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page).toHaveURL(/\/not-a-page-yet$/);
  });
});
