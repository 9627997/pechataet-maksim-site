import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import {
  mkdtemp,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = await mkdtemp(join(tmpdir(), 'pm-linked-order-ci-'));
const web = join(root, 'web');
const storage = join(root, 'orders-private');
const php = process.env.PHP_BINARY || 'php';
const png =
  'data:image/png;base64,' +
  Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    Buffer.from('PM-TEST'),
  ]).toString('base64');
let server;
let hook;
const payloads = [];

const port = async () => {
  const probe = createTcpServer();
  await new Promise((done) => probe.listen(0, '127.0.0.1', done));
  const value = probe.address().port;
  await new Promise((done) => probe.close(done));
  return value;
};

const waitFor = async (fn, label) => {
  for (let i = 0; i < 80; i++) {
    const result = await fn();
    if (result) return result;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error('Timed out: ' + label);
};

const spawnDone = async (cmd, args, options = {}) => {
  const child = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  const status = await new Promise((done, reject) => {
    child.on('error', reject);
    child.on('close', done);
  });
  assert.equal(status, 0, stderr.slice(-2000));
};

try {
  await mkdir(web);
  await cp(resolve('api'), join(web, 'api'), { recursive: true });
  await mkdir(storage);
  const init = spawnSync(
    php,
    ['tests/php/setup-linked-order-fixture.php', root],
    {
      encoding: 'utf8',
    },
  );
  assert.equal(init.status, 0, init.stderr);
  const { items, quoteId } = JSON.parse(init.stdout);
  assert.equal(items.length, 6);

  hook = createHttpServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk.toString();
    payloads.push(JSON.parse(body));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
  const hookPort = await port();
  await new Promise((done) => hook.listen(hookPort, '127.0.0.1', done));
  const config = [
    '<?php return [',
    "'storage_dir' => '" + storage.replaceAll("'", "\\'") + "',",
    "'telegram' => ['bot_token'=>'','chat_id'=>''],",
    "'max' => ['access_token'=>'','chat_id'=>''],",
    "'google' => ['webhook_url'=>'http://127.0.0.1:" +
      hookPort +
      "/hook','shared_secret'=>'local-fixture'],",
    "'notifications' => ['max_attempts'=>1,'retry_delay_seconds'=>0],",
    '];',
  ].join('\n');
  await writeFile(join(root, 'private/pechataet-maksim-orders.php'), config);
  const serverPort = await port();
  server = spawn(php, ['-S', '127.0.0.1:' + serverPort, '-t', web], {
    stdio: 'ignore',
  });
  const base = 'http://127.0.0.1:' + serverPort;
  await waitFor(async () => {
    try {
      const response = await fetch(base + '/api/orders/');
      return response.status === 405;
    } catch {
      return false;
    }
  }, 'PHP order receiver readiness');

  const artifactsByItemId = Object.fromEntries(
    items.map((item) => {
      const width =
        item.productType === 'ribbon' ? 100 : item.configuration.widthMm;
      const height =
        item.productType === 'ribbon' ? 15 : item.configuration.heightMm;
      const text = item.itemId;
      return [
        text,
        {
          previewSvg:
            '<svg xmlns="http://www.w3.org/2000/svg"><text>preview-' +
            text +
            '</text></svg>',
          printSvg:
            '<svg xmlns="http://www.w3.org/2000/svg" width="' +
            width +
            'mm" height="' +
            height +
            'mm"><text>print-' +
            text +
            '</text></svg>',
          previewPng: png,
        },
      ];
    }),
  );
  const generic = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
  const request = {
    requestId: 'pm-e2e-' + 'a'.repeat(24),
    customer: {
      name: 'CI TEST — НЕ ВЫПОЛНЯТЬ',
      preferredContact: 'telegram',
      telegram: '@ci_dummy',
      comment: 'Изолированный E2E тест, без реальной отправки',
    },
    products: {
      ribbon: {
        enabled: true,
        widthMm: 15,
        meters: 25,
        repeatMm: 100,
        materialColor: '#f3eadc',
        printColor: '#171717',
      },
      sticker: {
        enabled: true,
        variantId: 'circle-25',
        shape: 'circle',
        diameterMm: 25,
        widthMm: 25,
        heightMm: 25,
        cornerRadiusMm: 0,
        quantity: 250,
        backgroundColor: '#ffffff',
        printColor: '#171717',
      },
    },
    artifacts: {
      ribbonSvg: generic,
      stickerSvg: generic,
      ribbonPreviewSvg: generic,
      stickerPreviewSvg: generic,
      ribbonPrintSvg: generic,
      stickerPrintSvg: generic,
      ribbonPreviewPng: png,
      stickerPreviewPng: png,
    },
    pricing: { preliminary: true, amount: null },
    quoteId,
    orderItems: items,
    artifactsByItemId,
  };
  const post = async (value) => {
    const response = await fetch(base + '/api/orders/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    return { status: response.status, json: await response.json() };
  };
  const accepted = await post(request);
  assert.equal(accepted.status, 201, JSON.stringify(accepted.json));
  assert.equal(accepted.json.status, 'accepted');
  assert.equal(accepted.json.duplicate, false);
  const duplicate = await post(request);
  assert.equal(duplicate.status, 200, JSON.stringify(duplicate.json));
  assert.equal(duplicate.json.orderId, accepted.json.orderId);
  assert.equal(duplicate.json.duplicate, true);

  const replay = await post({
    ...request,
    requestId: 'pm-e2e-' + 'b'.repeat(24),
  });
  assert.equal(replay.status, 409, JSON.stringify(replay.json));
  assert.equal(replay.json.code, 'quote_replay');

  const directory = join(
    storage,
    'orders',
    new Date().toISOString().slice(0, 7).replace('-', '/'),
    accepted.json.orderId,
  );
  const order = JSON.parse(
    await readFile(join(directory, 'order.json'), 'utf8'),
  );
  assert.equal(order.lineArtworkManifest.length, 6);
  assert.deepEqual(order.linkedBasket.orderItems, items);
  assert.equal(order.pricing.amount, null);
  assert.equal(order.linkedBasket.verifiedPreliminaryAmount, '4990.00');
  assert.equal(
    await readdir(join(storage, 'idempotency')).then((x) => x.length),
    1,
  );
  for (let i = 0; i < 6; i++) {
    const line = order.lineArtworkManifest[i];
    assert.equal(line.itemId, items[i].itemId);
    assert.equal(line.status, 'requires_manual_artwork_review');
    const bytes = await readFile(join(directory, line.printSvg), 'utf8');
    assert.ok(bytes.includes('print-' + line.itemId));
    assert.ok((await readFile(join(directory, line.previewPng))).length > 8);
  }
  const archive = JSON.parse(
    await readFile(join(directory, 'archive.json'), 'utf8'),
  );
  assert.equal(
    archive.status,
    'ready',
    'Production requires PHP ZipArchive to form the order ZIP.',
  );
  const zipped = spawnSync(
    'unzip',
    ['-Z1', join(directory, 'order-package.zip')],
    {
      encoding: 'utf8',
    },
  );
  assert.equal(zipped.status, 0, zipped.stderr);
  const filenames = zipped.stdout.trim().split('\n');
  assert.equal(
    filenames.filter((name) =>
      /^line-\d{2}-(?:preview\.svg|print\.svg|preview\.png)$/.test(name),
    ).length,
    18,
  );
  assert.ok(filenames.includes('order.json'));
  for (let i = 0; i < 6; i++) {
    const name = 'line-' + String(i + 1).padStart(2, '0') + '-print.svg';
    const printed = spawnSync(
      'unzip',
      ['-p', join(directory, 'order-package.zip'), name],
      {
        encoding: 'utf8',
      },
    );
    assert.equal(printed.status, 0, printed.stderr);
    assert.ok(printed.stdout.includes('print-' + items[i].itemId));
  }
  const queue = JSON.parse(
    await readFile(join(directory, 'notification-queue.json'), 'utf8'),
  );
  assert.equal(queue.status, 'pending');
  await spawnDone(php, [join(web, 'api/orders/notification-worker.php')], {
    env: { ...process.env, PM_ORDER_STORAGE_DIR: storage },
  });
  const delivered = await waitFor(
    () => (payloads.length ? payloads[0] : null),
    'local Google webhook',
  );
  assert.equal(delivered.secret, 'local-fixture');
  assert.equal(Object.keys(delivered.order.artifactsByItemId).length, 6);
  for (const item of items) {
    assert.ok(
      delivered.order.artifactsByItemId[item.itemId].printSvg.includes(
        'print-' + item.itemId,
      ),
    );
  }
  const notifications = JSON.parse(
    await readFile(join(directory, 'notifications.json'), 'utf8'),
  );
  assert.equal(notifications.google.status, 'sent');
  assert.equal(
    JSON.parse(
      await readFile(join(directory, 'notification-queue.json'), 'utf8'),
    ).status,
    'sent',
  );
  assert.equal(payloads.length, 1);
  console.log(
    'PASS: real PHP 3+3 order, 18 independent ZIP assets, replay/idempotency and mocked Google delivery',
  );
} finally {
  if (server) server.kill('SIGTERM');
  if (hook) await new Promise((done) => hook.close(done));
  await rm(root, { recursive: true, force: true });
}
