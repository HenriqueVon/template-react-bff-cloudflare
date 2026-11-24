import { test } from '@playwright/test';
import { signIn } from './support';

// Takes the pictures of the README (docs/images) from the real app, with the real fake-API data. Not part of the normal run:
//
//   SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts
//
// Template repository only: `npm run init` deletes this file and the pictures.
const DIRECTORY = 'docs/images';

test.describe('the pictures of the README', () => {
  test.skip(!process.env.SCREENSHOTS, 'Run with SCREENSHOTS=1');

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  async function settle(page: import('@playwright/test').Page) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
  }

  test('the login', async ({ page }) => {
    await page.goto('/login');
    await settle(page);
    await page.screenshot({ path: `${DIRECTORY}/login.png` });
  });

  test('the list of examples', async ({ page }) => {
    await signIn(page);
    await page.goto('/examples');
    await page.getByRole('table').waitFor();
    await settle(page);
    await page.screenshot({ path: `${DIRECTORY}/examples.png` });
  });

  test('the form of an example', async ({ page }) => {
    await signIn(page);
    await page.goto('/examples');
    await page.getByRole('button', { name: 'Edit First example' }).click();
    await page.getByRole('dialog', { name: 'Edit example' }).waitFor();
    await settle(page);
    await page.screenshot({ path: `${DIRECTORY}/form.png` });
  });

  test('the list on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await page.goto('/examples');
    await page.getByRole('list', { name: 'Examples' }).waitFor();
    await settle(page);
    await page.screenshot({ path: `${DIRECTORY}/phone.png` });
  });
});
