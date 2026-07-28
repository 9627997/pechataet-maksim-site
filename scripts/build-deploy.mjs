import { execFileSync } from 'node:child_process';
import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const outputRoot = resolve(repositoryRoot, '_site');

const publicEntries = [
  'index.html',
  'robots.txt',
  'sitemap.xml',
  'css',
  'images',
  'js',
  'svg',
  'studio/index.html',
  'studio/assets',
  'studio/data',
];

const requiredOutput = [
  'constructor.html',
  'index.html',
  'robots.txt',
  'ribbon-studio-design-system-v1.html',
  'sitemap.xml',
  'version.json',
  'css/style.css',
  'js/app.js',
  'studio/index.html',
  'studio/assets/css/app.css',
  'studio/assets/js/app.js',
  'studio/assets/js/mobile-products.js',
  'studio/data/product.json',
];

const forbiddenTopLevelEntries = new Set([
  '.git',
  '.github',
  'docs',
  'node_modules',
  'scripts',
  'tests',
  'AGENTS.md',
  'README.md',
  'SPEC.md',
  'TODO.md',
  'package.json',
  'package-lock.json',
  'playwright.config.js',
]);

const legacyRedirects = [
  'constructor.html',
  'ribbon-studio-design-system-v1.html',
];

function getCommitSha() {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA;
  }

  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim();
}

async function copyPublicEntry(entry) {
  const source = resolve(repositoryRoot, entry);
  const target = resolve(outputRoot, entry);

  await mkdir(resolve(target, '..'), { recursive: true });
  await cp(source, target, { recursive: true });
}

async function createLegacyRedirect(entry) {
  const target = resolve(outputRoot, entry);
  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="0;url=/studio/">
  <link rel="canonical" href="https://xn--80aaarctnodv3agc9d.xn--p1ai/studio/">
  <title>Переходим в Studio — Печатает Максим</title>
</head>
<body>
  <p>Актуальный конструктор находится в <a href="/studio/">Studio лент и стикеров</a>.</p>
</body>
</html>
`;

  await writeFile(target, html, 'utf8');
}

async function assertArtifact() {
  await Promise.all(
    requiredOutput.map((entry) => access(resolve(outputRoot, entry))),
  );

  const topLevelEntries = await readdir(outputRoot);
  const forbiddenEntries = topLevelEntries.filter((entry) =>
    forbiddenTopLevelEntries.has(entry),
  );

  if (forbiddenEntries.length) {
    throw new Error(
      `В deployment artifact попали служебные файлы: ${forbiddenEntries.join(', ')}`,
    );
  }

  const [indexHtml, studioHtml, robots, sitemap] = await Promise.all([
    readFile(resolve(outputRoot, 'index.html'), 'utf8'),
    readFile(resolve(outputRoot, 'studio/index.html'), 'utf8'),
    readFile(resolve(outputRoot, 'robots.txt'), 'utf8'),
    readFile(resolve(outputRoot, 'sitemap.xml'), 'utf8'),
  ]);

  const canonicalHost = 'https://печатаетмаксим.рф';
  const seoRequirements = [
    [indexHtml, `<link rel="canonical" href="${canonicalHost}/">`],
    [studioHtml, `<link rel="canonical" href="${canonicalHost}/studio/">`],
    [robots, `Sitemap: ${canonicalHost}/sitemap.xml`],
    [sitemap, `<loc>${canonicalHost}/</loc>`],
    [sitemap, `<loc>${canonicalHost}/studio/</loc>`],
  ];

  for (const [content, requiredText] of seoRequirements) {
    if (!content.includes(requiredText)) {
      throw new Error(
        `Deployment artifact не содержит обязательное SEO-значение: ${requiredText}`,
      );
    }
  }
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await Promise.all(publicEntries.map(copyPublicEntry));
await Promise.all(legacyRedirects.map(createLegacyRedirect));

const version = {
  commit: getCommitSha(),
  builtAt: new Date().toISOString(),
};

await writeFile(
  resolve(outputRoot, 'version.json'),
  `${JSON.stringify(version, null, 2)}\n`,
  'utf8',
);

await assertArtifact();

console.log(
  `Deployment artifact prepared: ${outputRoot} (${version.commit.slice(0, 12)})`,
);
