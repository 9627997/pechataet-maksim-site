import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PROJECT_CONTEXT = 'docs/PROJECT_CONTEXT.md';
const CURRENT_STATUS = 'docs/CURRENT_STATUS.md';

const contextSensitivePaths = [
  /^AGENTS\.md$/,
  /^package(?:-lock)?\.json$/,
  /^playwright\.config\.js$/,
  /^\.github\/workflows\//,
  /^studio\/index\.html$/,
  /^studio\/assets\/js\//,
  /^studio\/data\//,
];

const statusSensitivePaths = [
  /^AGENTS\.md$/,
  /^README\.md$/,
  /^TODO\.md$/,
  /^docs\/(?:ARCHITECTURE|ROADMAP|UX_RULES|CHANGELOG)\.md$/,
  /^\.github\//,
  /^scripts\//,
  /^studio\//,
  /^tests\//,
];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function resolveBaseRef() {
  const explicit = process.argv
    .slice(2)
    .find((value) => !value.startsWith('--'));
  if (explicit) return explicit;

  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }

  if (process.env.GITHUB_EVENT_PATH) {
    try {
      const event = JSON.parse(
        readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'),
      );
      const eventBase = event.pull_request?.base?.sha || event.before;
      if (eventBase && !/^0+$/.test(eventBase)) return eventBase;
      if (eventBase) return 'origin/main';
    } catch (error) {
      warn(`Не удалось прочитать GitHub event: ${error.message}`);
    }
  }

  return null;
}

function getChangedFiles() {
  const baseRef = resolveBaseRef();
  if (baseRef) {
    return unique(
      git(['diff', '--name-only', `${baseRef}...HEAD`]).split('\n'),
    );
  }

  const tracked = git(['diff', '--name-only', 'HEAD']).split('\n');
  const untracked = git(['ls-files', '--others', '--exclude-standard']).split(
    '\n',
  );
  return unique([...tracked, ...untracked]);
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => pattern.test(file));
}

function warn(message) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log(`::warning title=Документация проекта::${message}`);
  } else {
    console.warn(`Предупреждение: ${message}`);
  }
}

const changedFiles = getChangedFiles();

if (!changedFiles.length) {
  console.log('Изменённых файлов для проверки документации нет.');
  process.exit(0);
}

const changedSet = new Set(changedFiles);
const contextRelevant = changedFiles.filter((file) =>
  matchesAny(file, contextSensitivePaths),
);
const statusRelevant = changedFiles.filter((file) =>
  matchesAny(file, statusSensitivePaths),
);

let warningCount = 0;

if (contextRelevant.length && !changedSet.has(PROJECT_CONTEXT)) {
  warningCount += 1;
  warn(
    `Изменены ключевые файлы (${contextRelevant.join(', ')}), но ${PROJECT_CONTEXT} не обновлён. Проверьте, изменилась ли карта проекта.`,
  );
}

if (statusRelevant.length && !changedSet.has(CURRENT_STATUS)) {
  warningCount += 1;
  warn(
    `Изменена текущая работа (${statusRelevant.join(', ')}), но ${CURRENT_STATUS} не обновлён. Проверьте статус перед передачей или публикацией.`,
  );
}

if (!warningCount) {
  console.log('Документация проекта присутствует в составе изменений.');
} else {
  console.log(
    `Проверка завершена с предупреждениями: ${warningCount}. Они не блокируют CI и требуют осмысленного решения.`,
  );
}
