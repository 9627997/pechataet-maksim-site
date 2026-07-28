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
  await page.evaluate(() => document.fonts?.ready);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        documentElement:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
        body: document.body.scrollWidth > document.body.clientWidth,
      })),
    )
    .toEqual({ documentElement: false, body: false });
};

test('local styles and scripts use deployment cache versions @smoke', async ({
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

test('public pages expose canonical SEO metadata and valid structured data @smoke', async ({
  page,
}) => {
  const expected = [
    {
      path: '/',
      canonical: 'https://xn--80aaarctnodv3agc9d.xn--p1ai/',
      title: 'Печать лент и наклеек с логотипом — Печатает Максим',
    },
    {
      path: '/studio/',
      canonical: 'https://xn--80aaarctnodv3agc9d.xn--p1ai/studio/',
      title: 'Конструктор лент и наклеек с логотипом — Печатает Максим',
    },
  ];

  for (const entry of expected) {
    await page.goto(entry.path, { waitUntil: 'networkidle' });

    await expect(page).toHaveTitle(entry.title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      entry.canonical,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /.+/,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /index,follow/,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      entry.canonical,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /^https:\/\/xn--80aaarctnodv3agc9d\.xn--p1ai\//,
    );

    const structuredData = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(structuredData.length).toBeGreaterThan(0);
    for (const item of structuredData) {
      expect(() => JSON.parse(item)).not.toThrow();
    }
  }

  const robots = await (await page.request.get('/robots.txt')).text();
  expect(robots).toContain(
    'Sitemap: https://xn--80aaarctnodv3agc9d.xn--p1ai/sitemap.xml',
  );

  const sitemap = await (await page.request.get('/sitemap.xml')).text();
  expect(sitemap).toContain(
    '<loc>https://xn--80aaarctnodv3agc9d.xn--p1ai/</loc>',
  );
  expect(sitemap).toContain(
    '<loc>https://xn--80aaarctnodv3agc9d.xn--p1ai/studio/</loc>',
  );
});

test('landing page is responsive and downloads an honest request @smoke', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('#region')).toContainText('Нижневартовск');
  await expect(page.locator('#region')).toContainText('ХМАО');
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
