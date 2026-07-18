import { expect, test } from '@playwright/test';

const watchRuntimeErrors = (page) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console.error: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
};

const expectNoHorizontalOverflow = async (page) => {
  const overflow = await page.evaluate(() => ({
    documentElement:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
    body: document.body.scrollWidth > document.body.clientWidth,
  }));
  expect(overflow).toEqual({ documentElement: false, body: false });
};

test('local styles and scripts use deployment cache versions', async ({
  page,
}) => {
  for (const path of ['/', '/studio/']) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const unversionedAssets = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          'link[rel="stylesheet"][href], script[src]',
        ),
      ]
        .map((element) => new URL(element.href || element.src, location.href))
        .filter(
          (url) =>
            url.origin === location.origin &&
            /\.(?:css|js)$/.test(url.pathname) &&
            !url.searchParams.has('v'),
        )
        .map((url) => url.pathname),
    );
    expect(unversionedAssets).toEqual([]);
  }
});

test('landing page is responsive and downloads an honest request', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page.locator('h1')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);

  const form = page.locator('#contact-form');
  await form.getByLabel('Имя').fill('Максим');
  await form.getByLabel('Телефон или Telegram').fill('@maxim');
  await form.getByLabel('Комментарий').fill('Нужна лента 20 мм');

  const downloadPromise = page.waitForEvent('download');
  await form.getByRole('button', { name: 'Скачать заявку' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('zayavka-pechataet-maksim.txt');
  await expect(form.locator('.form-status')).toContainText('Заявка скачана.');
  await expect(form.getByLabel('Имя')).toHaveValue('Максим');
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});
