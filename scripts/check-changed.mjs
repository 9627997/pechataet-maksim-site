import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const baseRef = process.env.CHECK_BASE || 'origin/main';

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
}

function gitFiles(args) {
  try {
    return run('git', args, { capture: true })
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const changedFiles = new Set([
  ...gitFiles([
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    `${baseRef}...HEAD`,
  ]),
  ...gitFiles(['diff', '--name-only', '--diff-filter=ACMR']),
  ...gitFiles(['diff', '--cached', '--name-only', '--diff-filter=ACMR']),
  ...gitFiles(['ls-files', '--others', '--exclude-standard']),
]);

const existingFiles = [...changedFiles]
  .filter((file) => existsSync(resolve(repositoryRoot, file)))
  .sort();

const prettierFiles = existingFiles.filter(
  (file) =>
    [
      'package.json',
      'eslint.config.js',
      'prettier.config.js',
      'playwright.config.js',
    ].includes(file) ||
    /^\.github\/workflows\/.+\.ya?ml$/.test(file) ||
    /^scripts\/.+\.mjs$/.test(file) ||
    /^tests\/.+\.js$/.test(file),
);

const eslintFiles = existingFiles.filter(
  (file) =>
    !/^studio\/assets\/vendor\//.test(file) &&
    (/^studio\/.+\.js$/.test(file) ||
      /^scripts\/.+\.mjs$/.test(file) ||
      /^tests\/.+\.js$/.test(file) ||
      [
        'eslint.config.js',
        'prettier.config.js',
        'playwright.config.js',
      ].includes(file)),
);

run(process.execPath, ['scripts/check-project-docs.mjs']);

if (prettierFiles.length) {
  run('prettier', ['--check', ...prettierFiles]);
}

if (eslintFiles.length) {
  run('eslint', eslintFiles);
}

console.log(
  `Fast check passed: ${existingFiles.length} changed, ` +
    `${prettierFiles.length} formatted, ${eslintFiles.length} linted.`,
);
