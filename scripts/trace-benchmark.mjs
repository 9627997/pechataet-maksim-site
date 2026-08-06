import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const require = createRequire(import.meta.url);
const vtracer = require('@visioncortex/vtracer');
const ImageTracer = require('imagetracerjs');

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = path.join(rootDir, 'test-results', 'trace-benchmark');

const candidateOptions = {
  vtracer: {
    clustering: 'bw',
    mode: 'spline',
    filterSpeckle: 4,
    simplify: 1,
    pathPrecision: 2,
    optimize: 2,
  },
  imageTracer: {
    ltres: 1,
    qtres: 1,
    pathomit: 4,
    colorsampling: 0,
    colorquantcycles: 1,
    linefilter: true,
    roundcoords: 2,
    strokewidth: 0,
    pal: [
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 255, g: 255, b: 255, a: 0 },
    ],
  },
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const measure = (operation, attempts = 3) => {
  const durations = [];
  let value;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const startedAt = performance.now();
    value = operation();
    durations.push(performance.now() - startedAt);
  }

  return { value, durationMs: median(durations) };
};

const hasTransparency = ({ data }) => {
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 250) return true;
  }
  return false;
};

const estimateBackground = ({ data, width, height }) => {
  const points = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
  ];

  return points.reduce(
    (background, [x, y]) => {
      const index = (y * width + x) * 4;
      background[0] += data[index] / points.length;
      background[1] += data[index + 1] / points.length;
      background[2] += data[index + 2] / points.length;
      return background;
    },
    [0, 0, 0],
  );
};

const normalizeToBinaryMask = (imageData) => {
  const { data, width, height } = imageData;
  const transparent = hasTransparency(imageData);
  const background = estimateBackground(imageData);
  const backgroundLuminance =
    0.2126 * background[0] + 0.7152 * background[1] + 0.0722 * background[2];
  const rgba = new Uint8ClampedArray(width * height * 4);
  const mask = new Uint8Array(width * height);
  let foregroundPixels = 0;

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const index = pixel * 4;
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const alpha = data[index + 3];
    const distance = Math.hypot(
      red - background[0],
      green - background[1],
      blue - background[2],
    );
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const foreground = transparent
      ? alpha > 40
      : distance > 58 && Math.abs(luminance - backgroundLuminance) > 20;
    const value = foreground ? 0 : 255;

    mask[pixel] = foreground ? 1 : 0;
    foregroundPixels += mask[pixel];
    rgba[index] = value;
    rgba[index + 1] = value;
    rgba[index + 2] = value;
    rgba[index + 3] = 255;
  }

  return {
    data: rgba,
    width,
    height,
    mask,
    transparent,
    coverage: foregroundPixels / (width * height),
  };
};

const legacyScanlineTrace = ({ mask, width, height }) => {
  const runs = [];

  for (let y = 0; y < height; y += 1) {
    let runStart = -1;

    for (let x = 0; x < width; x += 1) {
      const foreground = mask[y * width + x] === 1;
      if (foreground && runStart < 0) runStart = x;

      if ((!foreground || x === width - 1) && runStart >= 0) {
        const endX = foreground && x === width - 1 ? x + 1 : x;
        runs.push([runStart, y, endX - runStart]);
        runStart = -1;
      }
    }
  }

  const rectangles = runs
    .map(
      ([x, y, widthValue]) =>
        `<rect x="${x}" y="${y}" width="${widthValue}" height="1"/>`,
    )
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}">` +
    `<g fill="#000" stroke="none">${rectangles}</g></svg>`
  );
};

const traceWithImageTracer = ({ data, width, height }) =>
  ImageTracer.imagedataToSVG(
    { data: new Uint8ClampedArray(data), width, height },
    candidateOptions.imageTracer,
  );

const countSvgComplexity = (svgSource) => {
  const paths = svgSource.match(/<path\b[^>]*>/g) || [];
  const visiblePaths = paths.filter(
    (pathSource) => !/opacity=["']0(?:\.0+)?["']/.test(pathSource),
  );
  const pathCommands = visiblePaths.reduce((total, pathSource) => {
    const pathData = pathSource.match(/\bd=["']([^"']*)["']/)?.[1] || '';
    return total + (pathData.match(/[a-z]/gi)?.length || 0);
  }, 0);

  return {
    bytes: Buffer.byteLength(svgSource),
    paths: visiblePaths.length,
    rectangles: (svgSource.match(/<rect\b/g) || []).length,
    pathCommands,
  };
};

const svgDocument = (width, height, body, { transparent = false } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
  `${transparent ? '' : `<rect width="${width}" height="${height}" fill="#fff"/>`}` +
  `${body}</svg>`;

const decodeFixture = async (name, source, { width, height } = {}) => {
  let pipeline = sharp(source, { density: 144 });
  if (width || height) {
    pipeline = pipeline.resize({ width, height, fit: 'inside' });
  }
  const { data, info } = await pipeline
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const preview = await sharp(data, { raw: info }).png().toBuffer();

  return {
    name,
    width: info.width,
    height: info.height,
    data: Array.from(data),
    sourceDataUrl: `data:image/png;base64,${preview.toString('base64')}`,
  };
};

const createFixtureInputs = async () => {
  const speckles = [];
  let seed = 86;
  for (let index = 0; index < 180; index += 1) {
    seed = (seed * 16807) % 2147483647;
    const x = seed % 360;
    seed = (seed * 16807) % 2147483647;
    const y = seed % 150;
    const size = 1 + (index % 2);
    speckles.push(
      `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#111"/>`,
    );
  }

  const synthetic = [
    [
      'cyrillic-word',
      svgDocument(
        420,
        140,
        '<text x="210" y="92" fill="#111" font-family="DejaVu Sans, sans-serif" font-size="70" font-weight="700" text-anchor="middle">МАКСИМ</text>',
      ),
    ],
    [
      'letter-counters',
      svgDocument(
        420,
        150,
        '<text x="210" y="105" fill="#111" font-family="DejaVu Sans, sans-serif" font-size="82" font-weight="700" text-anchor="middle">ОАР86</text>',
      ),
    ],
    [
      'round-badge',
      svgDocument(
        220,
        220,
        '<circle cx="110" cy="110" r="82" fill="none" stroke="#111" stroke-width="12"/><text x="110" y="143" fill="#111" font-family="DejaVu Sans, sans-serif" font-size="92" font-weight="700" text-anchor="middle">M</text>',
      ),
    ],
    [
      'thin-lines',
      svgDocument(
        360,
        160,
        '<path d="M25 105C90 25 120 145 180 70C230 8 260 130 335 48" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"/><text x="180" y="143" fill="#111" font-family="DejaVu Sans, sans-serif" font-size="28" text-anchor="middle">тонкая линия</text>',
      ),
    ],
    [
      'transparent-mark',
      svgDocument(
        260,
        180,
        '<path d="M108 40A44 44 0 0 0 108 120M152 120A44 44 0 0 0 152 40" fill="none" stroke="#111" stroke-width="9" stroke-linecap="round"/><rect x="122" y="62" width="16" height="64" fill="#111"/>',
        { transparent: true },
      ),
    ],
    [
      'white-on-dark',
      svgDocument(
        380,
        140,
        '<rect width="380" height="140" fill="#151515"/><text x="190" y="93" fill="#fff" font-family="DejaVu Sans, sans-serif" font-size="62" font-weight="700" text-anchor="middle">БЕЛЫЙ</text>',
        { transparent: true },
      ),
    ],
    [
      'uneven-light',
      svgDocument(
        420,
        160,
        '<defs><linearGradient id="light"><stop stop-color="#fff"/><stop offset="1" stop-color="#bbb"/></linearGradient></defs><rect width="420" height="160" fill="url(#light)"/><text x="210" y="108" fill="#252525" font-family="DejaVu Sans, sans-serif" font-size="58" font-weight="700" text-anchor="middle">СКАН</text>',
        { transparent: true },
      ),
    ],
    [
      'speckled-scan',
      svgDocument(
        360,
        150,
        `<text x="180" y="103" fill="#111" font-family="DejaVu Sans, sans-serif" font-size="58" font-weight="700" text-anchor="middle">ШУМ</text>${speckles.join('')}`,
      ),
    ],
    [
      'low-resolution',
      svgDocument(
        72,
        72,
        '<text x="36" y="55" fill="#111" font-family="DejaVu Sans, sans-serif" font-size="52" font-weight="700" text-anchor="middle">M</text>',
      ),
    ],
  ];

  const generated = await Promise.all(
    synthetic.map(([name, svgSource]) =>
      decodeFixture(name, Buffer.from(svgSource)),
    ),
  );
  const existing = await Promise.all([
    decodeFixture(
      'existing-transparent-png',
      await fs.readFile(
        path.join(rootDir, 'tests/fixtures/transparent-logo.png'),
      ),
    ),
    decodeFixture(
      'existing-opaque-png',
      await fs.readFile(path.join(rootDir, 'tests/fixtures/opaque-logo.png')),
    ),
    decodeFixture(
      'official-logo-rasterized',
      await fs.readFile(
        path.join(rootDir, 'studio/assets/images/печатаетмаксим.svg'),
      ),
      { width: 900 },
    ),
  ]);

  return [...generated, ...existing];
};

const measureRenderedFidelity = async (svgSource, normalized) => {
  const rendered = await sharp(Buffer.from(svgSource), { density: 72 })
    .resize(normalized.width, normalized.height, { fit: 'fill' })
    .flatten({ background: '#fff' })
    .removeAlpha()
    .raw()
    .toBuffer();
  let intersection = 0;
  let union = 0;
  let renderedForeground = 0;

  for (
    let pixel = 0;
    pixel < normalized.width * normalized.height;
    pixel += 1
  ) {
    const index = pixel * 3;
    const luminance =
      0.2126 * rendered[index] +
      0.7152 * rendered[index + 1] +
      0.0722 * rendered[index + 2];
    const actual = luminance < 128;
    const expected = normalized.mask[pixel] === 1;
    if (actual && expected) intersection += 1;
    if (actual || expected) union += 1;
    if (actual) renderedForeground += 1;
  }

  return {
    iou: union ? intersection / union : 1,
    renderedCoverage:
      renderedForeground / (normalized.width * normalized.height),
  };
};

const formatNumber = (value, digits = 2) => Number(value.toFixed(digits));

const buildReportMarkdown = (report) => {
  const rows = report.fixtures.flatMap((fixture) =>
    fixture.engines.map((engine) =>
      [
        fixture.name,
        engine.name,
        engine.durationMs.toFixed(2),
        engine.bytes,
        engine.paths,
        engine.rectangles,
        engine.pathCommands,
        engine.iou.toFixed(3),
      ].join(' | '),
    ),
  );

  return (
    `# Trace benchmark\n\n` +
    `Generated: ${report.generatedAt}\n\n` +
    `This is an isolated engineering benchmark. It is not connected to Studio or the deployment artifact.\n\n` +
    `Fixture | Engine | Median ms | SVG bytes | Visible paths | Rectangles | Path commands | IoU\n` +
    `--- | --- | ---: | ---: | ---: | ---: | ---: | ---:\n` +
    `${rows.join('\n')}\n`
  );
};

const buildGallery = (report) => {
  const cards = report.fixtures
    .map((fixture) => {
      const outputs = fixture.engines
        .map(
          (engine) => `
            <figure>
              <img src="${escapeHtml(engine.file)}" alt="${escapeHtml(`${fixture.name}: ${engine.name}`)}">
              <figcaption>
                <strong>${escapeHtml(engine.name)}</strong><br>
                ${engine.durationMs.toFixed(2)} ms · ${engine.bytes} B ·
                paths ${engine.paths} · rect ${engine.rectangles} · IoU ${engine.iou.toFixed(3)}
              </figcaption>
            </figure>`,
        )
        .join('');

      return `
        <section>
          <h2>${escapeHtml(fixture.name)}</h2>
          <div class="grid">
            <figure>
              <img src="${fixture.sourceDataUrl}" alt="${escapeHtml(`${fixture.name}: source`)}">
              <figcaption><strong>Source</strong><br>${fixture.width} × ${fixture.height}</figcaption>
            </figure>
            ${outputs}
          </div>
        </section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Trace benchmark</title>
    <style>
      :root { color-scheme: light; font-family: system-ui, sans-serif; }
      body { margin: 0; padding: 32px; background: #f4f1eb; color: #171717; }
      main { max-width: 1440px; margin: 0 auto; }
      section { margin: 28px 0; padding: 22px; background: white; border-radius: 18px; }
      .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
      figure { margin: 0; min-width: 0; }
      img { width: 100%; height: 190px; object-fit: contain; background: #eee; border-radius: 10px; }
      figcaption { padding-top: 10px; font-size: 13px; line-height: 1.5; }
      @media (max-width: 800px) { body { padding: 12px; } .grid { grid-template-columns: 1fr 1fr; } }
    </style>
  </head>
  <body>
    <main>
      <h1>Trace engine benchmark</h1>
      <p>Isolated comparison. Nothing on this page is used by Studio.</p>
      ${cards}
    </main>
  </body>
</html>`;
};

const buildContactSheet = async (report) => {
  const tileWidth = 300;
  const tileHeight = 210;
  const columns = 4;
  const tiles = [];

  for (const [row, fixture] of report.fixtures.entries()) {
    const items = [
      {
        name: 'Source',
        input: Buffer.from(fixture.sourceDataUrl.split(',')[1], 'base64'),
        details: `${fixture.width} × ${fixture.height}`,
      },
    ];
    for (const engine of fixture.engines) {
      items.push({
        name: engine.name,
        input: await fs.readFile(path.join(outputDir, engine.file)),
        details: `${engine.bytes} B · IoU ${engine.iou.toFixed(3)}`,
      });
    }

    for (const [column, item] of items.entries()) {
      const visual = await sharp(item.input, { density: 144 })
        .resize({
          width: 280,
          height: 160,
          fit: 'contain',
          background: '#fff',
        })
        .flatten({ background: '#fff' })
        .png()
        .toBuffer();
      const label = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}">` +
          `<rect width="${tileWidth}" height="${tileHeight}" rx="12" fill="#f2f0eb"/>` +
          `<text x="14" y="187" font-family="DejaVu Sans, sans-serif" font-size="12" fill="#111">${escapeHtml(fixture.name)} · ${escapeHtml(item.name)}</text>` +
          `<text x="14" y="203" font-family="DejaVu Sans, sans-serif" font-size="10" fill="#555">${escapeHtml(item.details)}</text>` +
          `</svg>`,
      );
      const tile = await sharp(label)
        .composite([{ input: visual, left: 10, top: 10 }])
        .png()
        .toBuffer();
      tiles.push({
        input: tile,
        left: column * tileWidth,
        top: row * tileHeight,
      });
    }
  }

  await sharp({
    create: {
      width: tileWidth * columns,
      height: tileHeight * report.fixtures.length,
      channels: 3,
      background: '#d8d4cc',
    },
  })
    .composite(tiles)
    .jpeg({ quality: 92 })
    .toFile(path.join(outputDir, 'comparison.jpg'));
};

const run = async () => {
  await fs.mkdir(outputDir, { recursive: true });
  const fixtures = await createFixtureInputs();
  const report = {
    generatedAt: new Date().toISOString(),
    candidates: {
      legacy: 'current scanline rectangles',
      vtracer: '@visioncortex/vtracer 1.0.0-alpha.3 (evaluation only)',
      imageTracer: 'imagetracerjs 1.2.6',
    },
    fixtures: [],
  };

  for (const fixture of fixtures) {
    const original = {
      data: new Uint8ClampedArray(fixture.data),
      width: fixture.width,
      height: fixture.height,
    };
    const normalized = normalizeToBinaryMask(original);
    const engines = [
      {
        key: 'legacy',
        name: 'Current scanline',
        operation: () => legacyScanlineTrace(normalized),
      },
      {
        key: 'vtracer',
        name: 'VTracer spline',
        operation: () =>
          vtracer.convertPixels(
            normalized.data,
            normalized.width,
            normalized.height,
            candidateOptions.vtracer,
          ),
      },
      {
        key: 'imagetracer',
        name: 'ImageTracerJS',
        operation: () => traceWithImageTracer(normalized),
      },
    ];
    const engineResults = [];

    for (const engine of engines) {
      const measured = measure(engine.operation);
      const complexity = countSvgComplexity(measured.value);
      const fidelity = await measureRenderedFidelity(
        measured.value,
        normalized,
      );
      const file = `${fixture.name}-${engine.key}.svg`;
      await fs.writeFile(path.join(outputDir, file), measured.value);
      engineResults.push({
        key: engine.key,
        name: engine.name,
        file,
        durationMs: formatNumber(measured.durationMs, 3),
        ...complexity,
        iou: formatNumber(fidelity.iou, 5),
        renderedCoverage: formatNumber(fidelity.renderedCoverage, 5),
      });
    }

    report.fixtures.push({
      name: fixture.name,
      width: fixture.width,
      height: fixture.height,
      transparent: normalized.transparent,
      sourceCoverage: formatNumber(normalized.coverage, 5),
      sourceDataUrl: fixture.sourceDataUrl,
      engines: engineResults,
    });
  }

  await fs.writeFile(
    path.join(outputDir, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(outputDir, 'report.md'),
    buildReportMarkdown(report),
  );
  await fs.writeFile(path.join(outputDir, 'index.html'), buildGallery(report));
  await buildContactSheet(report);

  const summary = report.fixtures.flatMap((fixture) => fixture.engines);
  const engineNames = [...new Set(summary.map((engine) => engine.key))];
  for (const engineName of engineNames) {
    const results = summary.filter((engine) => engine.key === engineName);
    const averageBytes = Math.round(
      results.reduce((total, result) => total + result.bytes, 0) /
        results.length,
    );
    const averageDuration =
      results.reduce((total, result) => total + result.durationMs, 0) /
      results.length;
    const averageIou =
      results.reduce((total, result) => total + result.iou, 0) / results.length;
    console.log(
      `${engineName}: ${averageDuration.toFixed(2)} ms, ${averageBytes} B, IoU ${averageIou.toFixed(3)}`,
    );
  }
  console.log(`Gallery: ${path.join(outputDir, 'index.html')}`);
  console.log(`Contact sheet: ${path.join(outputDir, 'comparison.jpg')}`);
};

await run();
