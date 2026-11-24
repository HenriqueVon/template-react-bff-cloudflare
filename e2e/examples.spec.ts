import { expect, test } from '@playwright/test';
import { signIn } from './support';

// The reference screen, in a real browser: the whole flow, with the real Functions and the fake API behind them.
test.describe('the examples screen', () => {
  test('lists, creates, edits and deletes a record', async ({ page }) => {
    const name = `E2E example ${Date.now()}`;
    await signIn(page);
    await page.getByRole('link', { name: 'Examples' }).first().click();
    await expect(page.getByRole('heading', { name: 'Examples' })).toBeVisible();
    // The table is what a wide screen shows.
    await expect(page.getByRole('table')).toBeVisible();

    // Create
    await page.getByRole('button', { name: 'New example' }).click();
    const form = page.getByRole('dialog', { name: 'New example' });
    await form.getByLabel('Name').fill(name);
    await form.getByLabel('Description').fill('Made by the end-to-end test');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Example created.')).toBeVisible();
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();

    // Edit
    await page.getByRole('button', { name: `Edit ${name}` }).click();
    const edit = page.getByRole('dialog', { name: 'Edit example' });
    await edit.getByLabel('Description').fill('Changed by the test');
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Example updated.')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Changed by the test', exact: true })).toBeVisible();

    // Delete, after the confirmation that says what is going to happen
    await page.getByRole('button', { name: `Delete ${name}` }).click();
    const confirm = page.getByRole('dialog', { name: 'Delete example' });
    await expect(confirm.getByText(name)).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Example deleted.')).toBeVisible();
    await expect(page.getByRole('cell', { name, exact: true })).toHaveCount(0);
  });

  test('checks the fields before sending, and explains a name that already exists', async ({ page }) => {
    await signIn(page);
    await page.goto('/examples');

    await page.getByRole('button', { name: 'New example' }).click();
    const form = page.getByRole('dialog', { name: 'New example' });
    await form.getByLabel('Name').fill('ab');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByText('The name must have at least 3 characters.')).toBeVisible();
    await expect(form.getByLabel('Name')).toBeFocused();

    // "First example" is one of the three records the fake API starts with.
    await form.getByLabel('Name').fill('first example');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByRole('alert')).toHaveText('An example with this name already exists.');
  });

  test('says when the list cannot be loaded, and loads it when the user tries again', async ({ page }) => {
    await signIn(page);

    await page.route('**/api/examples?*', (route) => route.fulfill({ status: 503, json: { message: 'The service cannot be reached', code: 'API_UNAVAILABLE' } }));
    await page.goto('/examples');
    await expect(page.getByText('The data could not be loaded')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);

    await page.unroute('**/api/examples?*');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('shows the records as cards on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await signIn(page);
    await page.goto('/examples');

    await expect(page.getByRole('list', { name: 'Examples' })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });
});
