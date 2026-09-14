import sharp from 'sharp';
import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';

const root = resolve(import.meta.dirname, '../images');

const jobs = [
  {
    src: 'homepage-hero-packaging.png',
    out: 'homepage-hero-packaging.webp',
    width: 1920,
    height: 1080,
  },
  {
    src: 'homepage-card-ribbon.png',
    out: 'homepage-card-ribbon.webp',
    width: 1600,
    height: 1200,
  },
  {
    src: 'homepage-card-sticker.png',
    out: 'homepage-card-sticker.webp',
    width: 1600,
    height: 1200,
  },
  {
    src: 'homepage-card-set.png',
    out: 'homepage-card-set.webp',
    width: 1600,
    height: 1200,
  },
];

for (const job of jobs) {
  const srcPath = resolve(root, job.src);
  const outPath = resolve(root, job.out);
  await sharp(srcPath)
    .resize(job.width, job.height, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88, effort: 6 })
    .toFile(outPath);
  const srcSize = (await stat(srcPath)).size;
  const outSize = (await stat(outPath)).size;
  console.log(
    `${job.out}: ${(srcSize / 1024 / 1024).toFixed(2)}MB -> ${(outSize / 1024).toFixed(0)}KB (${(100 - (outSize / srcSize) * 100).toFixed(1)}% smaller)`,
  );
}

// dedicated, universally-compatible OG/Twitter/JSON-LD image
const ogPath = resolve(root, 'homepage-hero-packaging-og.jpg');
await sharp(resolve(root, 'homepage-hero-packaging.png'))
  .resize(1200, 675, { fit: 'cover' })
  .jpeg({ quality: 85, mozjpeg: true })
  .toFile(ogPath);
const ogSize = (await stat(ogPath)).size;
console.log(`homepage-hero-packaging-og.jpg: ${(ogSize / 1024).toFixed(0)}KB`);
