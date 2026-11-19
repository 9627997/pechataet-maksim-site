import { test, expect } from '@playwright/test';

test('silicone ribbon is clearly a separate pending category, not a priced satin offer', async ({ page }) => {
  await page.goto('/calc/');
  const pane = page.locator('.material-announcement');
  await expect(pane).toContainText('Силиконовые ленты');
  await expect(pane).toContainText('Отдельная ценовая категория');
  await expect(pane).toContainText('Цена силиконовой ленты рассчитывается отдельно');
  await expect(pane.locator('a')).toHaveAttribute('href','/studio/?product=ribbon');
  await expect(page.locator('button#silicone')).toHaveCount(0);
});
