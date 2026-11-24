import { expect, test } from '@playwright/test';
import { signIn } from './support';

const WIDTHS = [
  { name: 'a phone', width: 375, height: 812 },
  { name: 'a tablet', width: 768, height: 1024 },
  { name: 'a laptop', width: 1280, height: 800 },
];

test.describe('the layout', () => {
  for (const { name, width, height } of WIDTHS) {
    test(`does not scroll the page sideways on ${name} (${width} px)`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await signIn(page);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('puts the menu at the bottom on a phone and at the side on a laptop', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await signIn(page);

    const menu = page.getByRole('navigation', { name: 'Main' });
    await expect(menu).toBeVisible();
    const phone = await menu.boundingBox();
    expect(phone && phone.y > 400).toBe(true);

    await page.setViewportSize({ width: 1280, height: 800 });
    const laptop = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
    expect(laptop && laptop.x < 10).toBe(true);
  });
});
