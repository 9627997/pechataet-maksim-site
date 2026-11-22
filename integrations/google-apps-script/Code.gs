const PROPERTY_KEYS = Object.freeze({
  secret: 'PM_SHARED_SECRET',
  driveFolderId: 'PM_DRIVE_FOLDER_ID',
  spreadsheetId: 'PM_SPREADSHEET_ID',
});

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function doGet() {
  return jsonResponse({ ok: true, service: 'studio-drive-backup' });
}

function safeCell(value) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function orderSummary(order) {
  const ribbon = order.products?.ribbon;
  const sticker = order.products?.sticker;
  return [
    `Заявка — Печатает Максим`,
    `Номер: ${order.orderId}`,
    `Имя: ${order.customer?.name || ''}`,
    `Телефон: ${order.customer?.phone || 'не указан'}`,
    `Telegram: ${order.customer?.telegram || 'не указан'}`,
    `Предпочтительный способ связи: ${order.customer?.preferredContact || 'не указан'}`,
    `Комментарий: ${order.customer?.comment || 'не указан'}`,
    ribbon?.enabled
      ? `Лента: ${ribbon.widthMm} мм · ${ribbon.meters} м · шаг ${ribbon.repeatMm} мм`
      : 'Лента: не выбрана',
    sticker?.enabled
      ? `Стикеры: Ø${sticker.diameterMm} мм · ${sticker.quantity} шт.`
      : 'Стикеры: не выбраны',
  ].join('\n');
}

// The notification worker supplies SVG and base64 PNG bytes for every
// individually prepared quote line. Rebuild only generated server filenames;
// never derive Drive filenames from arbitrary client itemId strings.
function orderArtworkFiles(order) {
  const legacy = [
    ['ribbonSvg', 'ribbon.svg', 'image/svg+xml'],
    ['stickerSvg', 'sticker.svg', 'image/svg+xml'],
    ['ribbonPreviewSvg', 'ribbon-preview.svg', 'image/svg+xml'],
    ['ribbonPrintSvg', 'ribbon-print-black.svg', 'image/svg+xml'],
    ['stickerPreviewSvg', 'sticker-preview.svg', 'image/svg+xml'],
    ['stickerPrintSvg', 'sticker-print-black.svg', 'image/svg+xml'],
    ['ribbonPreviewPng', 'ribbon-preview.png', 'image/png'],
    ['stickerPreviewPng', 'sticker-preview.png', 'image/png'],
  ];
  const files = [];
  for (const [key, name, mime] of legacy) {
    const content = order.artifacts?.[key];
    if (typeof content === 'string' && content !== '') {
      files.push({ name, mime, content, isPng: mime === 'image/png' });
    }
  }

  const manifest = order.lineArtworkManifest || [];
  const linked = order.linkedBasket?.orderItems || [];
  const artwork = order.artifactsByItemId;
  if (!Array.isArray(manifest) || manifest.length > 6) {
    throw new Error('invalid_line_manifest');
  }
  if (manifest.length === 0) {
    if (artwork && Object.keys(artwork).length) {
      throw new Error('unexpected_line_artwork');
    }
    return files;
  }
  if (!Array.isArray(linked) || linked.length < 1 || linked.length > 6 ||
      !artwork || typeof artwork !== 'object' || Array.isArray(artwork) ||
      Object.keys(artwork).length !== manifest.length) {
    throw new Error('incomplete_line_artwork');
  }
  const ids = linked.map((item) => item.itemId);
  if (new Set(ids).size !== linked.length) {
    throw new Error('invalid_canonical_items');
  }
  const seen = new Set();
  for (let lineIndex = 0; lineIndex < manifest.length; lineIndex++) {
    const line = manifest[lineIndex];
    const id = line?.itemId;
    const index = ids.indexOf(id);
    if (typeof id !== 'string' || index < 0 || seen.has(id)) {
      throw new Error('line_item_mismatch');
    }
    seen.add(id);
    const data = artwork[id];
    if (!data || Object.keys(data).sort().join(',') !==
        'previewPng,previewSvg,printSvg') {
      throw new Error('missing_line_files');
    }
    const prefix = 'line-' + String(lineIndex + 1).padStart(2, '0');
    for (const [key, suffix, mime] of [
      ['previewSvg', '-preview.svg', 'image/svg+xml'],
      ['printSvg', '-print.svg', 'image/svg+xml'],
      ['previewPng', '-preview.png', 'image/png'],
    ]) {
      const name = prefix + suffix;
      const content = data[key];
      if (line[key] !== name || typeof content !== 'string' ||
          content.length < 8 || content.length > 11000000) {
        throw new Error('invalid_line_file');
      }
      files.push({ name, mime, content, isPng: key === 'previewPng' });
    }
  }
  return files;
}

function saveBackupFile(folder, file) {
  const existing = folder.getFilesByName(file.name);
  if (existing.hasNext()) {
    if (existing.next().getSize() <= 0) throw new Error('empty_backup_file');
    return;
  }
  if (file.isPng) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(file.content)) {
      throw new Error('invalid_png_base64');
    }
    const bytes = Utilities.base64Decode(file.content);
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length <= 8 || signature.some((value, i) =>
      (bytes[i] & 255) !== value)) {
      throw new Error('invalid_png_signature');
    }
    folder.createFile(Utilities.newBlob(bytes, 'image/png', file.name));
  } else {
    if (!file.content.includes('<svg')) {
      throw new Error('invalid_svg');
    }
    folder.createFile(file.name, file.content, 'image/svg+xml');
  }
}

function doPost(event) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const payload = JSON.parse(event.postData?.contents || '{}');
    const expectedSecret = properties.getProperty(PROPERTY_KEYS.secret);
    if (!expectedSecret || payload.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: 'unauthorized' });
    }

    const order = payload.order;
    if (!order?.orderId || !order?.customer?.name) {
      return jsonResponse({ ok: false, error: 'invalid_order' });
    }

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      return jsonResponse({ ok: false, error: 'busy' });
    }

    try {
      const root = DriveApp.getFolderById(
        properties.getProperty(PROPERTY_KEYS.driveFolderId),
      );
      const existing = root.getFoldersByName(order.orderId);
      const folder = existing.hasNext()
        ? existing.next()
        : root.createFolder(order.orderId);
      const summary = orderSummary(order);

      // Validate the entire six-line manifest BEFORE saving any files.
      // A partial or invalid Drive backup must never return ok:true.
      const artworkFiles = orderArtworkFiles(order);
      const savedOrder = {
        ...order,
        artifacts: undefined,
        artifactsByItemId: undefined,
      };
      const files = [
        {
          name: 'order.json',
          mime: 'text/plain',
          content: JSON.stringify(savedOrder, null, 2),
          isPng: false,
        },
        ...artworkFiles,
      ];
      for (const file of files) {
        if (file.name === 'order.json') {
          if (!folder.getFilesByName(file.name).hasNext()) {
            folder.createFile(file.name, file.content, MimeType.PLAIN_TEXT);
          }
        } else {
          saveBackupFile(folder, file);
        }
      }
      // Completion marker LAST. On webhook retry repair missing artifacts
      // even when an earlier attempt already wrote request.txt.
      if (!folder.getFilesByName('request.txt').hasNext()) {
        folder.createFile('request.txt', summary, MimeType.PLAIN_TEXT);
      }
      for (const file of files) {
        if (!folder.getFilesByName(file.name).hasNext()) {
          throw new Error('drive_file_missing');
        }
      }

      const sheet = SpreadsheetApp.openById(
        properties.getProperty(PROPERTY_KEYS.spreadsheetId),
      ).getSheets()[0];
      const orderIds = sheet
        .getRange(1, 1, Math.max(sheet.getLastRow(), 1), 1)
        .getDisplayValues()
        .flat();
      if (!orderIds.includes(order.orderId)) {
        sheet.appendRow([
          safeCell(order.orderId),
          safeCell(order.acceptedAt),
          safeCell(order.customer.name),
          safeCell(order.customer.phone),
          safeCell(order.customer.telegram),
          safeCell(order.customer.preferredContact),
          safeCell(order.customer.comment),
          safeCell(summary),
          folder.getUrl(),
        ]);
      }

      return jsonResponse({ ok: true, folderUrl: folder.getUrl() });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: 'internal_error' });
  }
}
