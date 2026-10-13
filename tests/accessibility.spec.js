import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  { path: '/', name: 'главная страница' },
  { path: '/studio/', name: 'Studio' },
  { path: '/privacy.html', name: 'политика обработки данных' },
];

for (const { path, name } of pages) {
  test(`${name} не содержит нарушений accessibility по WCAG 2.1 A/AA @smoke`, async ({
    page,
  }) => {
    await page.goto(path, { waitUntil: 'networkidle' });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      // Цветовой контраст кастомных элементов Studio проверяется вручную:
      // canvas-предпросмотры не видны axe как текстовый контент.
      .disableRules(['color-contrast'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

test('Studio сохраняет доступность после старта макета ленты @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=ribbon', { waitUntil: 'networkidle' });
  await page
    .getByRole('textbox', { name: 'Надпись на ленте' })
    .fill('Макет для проверки доступности');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze();

  expect(results.violations).toEqual([]);
});
