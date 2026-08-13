# Reg.ru production package: alternative homepage

## Current status

The alternative homepage is prepared as a production candidate, but it has not been copied over the repository `index.html`, pushed to GitHub, or published to Reg.ru.

The current production homepage remains the default. The candidate is selected only when the build command explicitly receives:

```bash
USE_ALTERNATIVE_HOMEPAGE=1 node scripts/build-deploy.mjs
```

Without this variable, the build keeps the current homepage.

## What the candidate includes

The candidate uses the existing Studio entry-context adapter and keeps all current crop, raster-to-logo, tracing, safe-area, local-storage, production SVG, order receiver, archive, Telegram and Google Apps Script behavior.

The production head includes the canonical Punycode URL, `index,follow,max-image-preview:large`, the confirmed commercial title and description, Open Graph, Twitter Card, and the existing Organization, WebSite, WebPage and Service JSON-LD graph. The preview route is not copied into `_site` and is not included in `sitemap.xml`.

## Build and inspect locally

From the repository root:

```bash
npm install
USE_ALTERNATIVE_HOMEPAGE=1 node scripts/build-deploy.mjs
cat _site/version.json
```

The artifact should report:

```json
{
  "homepage": "alternative"
}
```

Serve `_site` with the same static/PHP-capable server profile used for deployment. Before publication, check `/`, `/studio/`, `/robots.txt`, `/sitemap.xml`, `/version.json` and `/api/orders/` in the staging or preview environment.

## Reg.ru publication sequence

1. Preserve the GitHub backup branch and tag `backup/pre-ux-alternative-2026-08-13` until the observation period is complete.
2. Run `npm run check:fast` and `npm run check:pr` on the integration branch.
3. Build the candidate with `USE_ALTERNATIVE_HOMEPAGE=1`.
4. Inspect `_site/index.html` for title, description, robots, canonical, Open Graph, Twitter Card and JSON-LD.
5. Confirm that `_site` contains no `.git`, `docs`, `prototypes`, `tests`, `scripts`, `node_modules` or candidate source file.
6. Upload the contents of `_site`, not the `_site` directory itself, to the Reg.ru document root, or let the approved GitHub Actions deployment perform the upload.
7. Do not delete the existing Reg.ru backup or previous deployment artifact until the smoke checks pass.
8. Verify the production canonical URL, `/studio/`, `/robots.txt`, `/sitemap.xml`, canonical redirect matrix and a non-submitting order-flow smoke test.
9. In Yandex Webmaster and Google Search Console, inspect the canonical and request a recrawl only after the live HTML is confirmed.

## Rollback

If the candidate fails, rebuild without the flag:

```bash
node scripts/build-deploy.mjs
```

Then publish that default `_site` artifact. This restores the current homepage while retaining the integrated Studio adapter and server files. If a full source rollback is required, restore from the GitHub backup tag `backup/pre-ux-alternative-2026-08-13` or the verified Git bundle.

## Do not do during this release

Do not change the canonical domain, add new indexable query pages, alter `sitemap.xml` to include `?product=...`, change the order API contract, publish the preview directory, or send a real test order containing personal data.
