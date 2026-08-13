import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

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

  const studioHtml = await readFile('studio/index.html', 'utf8');
  const studioApp = await readFile('studio/assets/js/app.js');
  const expectedVersion = createHash('sha256')
    .update(studioApp)
    .digest('hex')
    .slice(0, 12);
  const appScriptSource = studioHtml.match(
    /<script src="assets\/js\/app\.js\?v=([a-f0-9]{12})"><\/script>/,
  );

  expect(appScriptSource?.[1]).toBe(expectedVersion);
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

test('landing page exposes the verified project phone @smoke', async ({page}) => {
  await page.goto('/', {waitUntil: 'networkidle'});
  const phoneLinks = page.locator('a[href="tel:+79129008011"]');
  await expect(phoneLinks).toHaveCount(3);
  await expect(phoneLinks.first()).toContainText('+7 912 900-80-11');

  const organizationPhone = await page.evaluate(() => {
    const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
    const nodes = scripts.flatMap((script) => {
      const value = JSON.parse(script.textContent || '{}');
      return Array.isArray(value['@graph']) ? value['@graph'] : [value];
    });
    return nodes.find((node) => node['@type'] === 'Organization')?.telephone;
  });
  expect(organizationPhone).toBe('+79129008011');
});

test('landing page is responsive and leads to Studio @smoke', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('#region')).toContainText('Нижневартовск');
  await expect(page.locator('#region')).toContainText('ХМАО');
  await expectNoHorizontalOverflow(page);

  const studioLinks = page.locator('a[href="/studio/"]');
  await expect(studioLinks).toHaveCount(5);
  await expect(
    page.getByRole('link', { name: 'Создать макет онлайн' }),
  ).toHaveAttribute('href', '/studio/');
  await expect(page.locator('#contact')).toContainText(
    'Заявка и макеты сохраняются в защищённом архиве.',
  );
  await expect(page.locator('#contact-form')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('Studio protects a created project from an accidental reset @smoke', async ({
  page,
}) => {
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  const textInput = page.getByRole('textbox', { name: 'Надпись на ленте' });
  await textInput.fill('Макет для проверки');

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Текущий макет будет удалён');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Новый проект' }).click();

  await expect(textInput).toHaveValue('Макет для проверки');
});
