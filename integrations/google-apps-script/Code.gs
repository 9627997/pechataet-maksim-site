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
    `Комментарий: ${order.customer?.comment || 'не указан'}`,
    ribbon?.enabled
      ? `Лента: ${ribbon.widthMm} мм · ${ribbon.meters} м · шаг ${ribbon.repeatMm} мм`
      : 'Лента: не выбрана',
    sticker?.enabled
      ? `Стикеры: Ø${sticker.diameterMm} мм · ${sticker.quantity} шт.`
      : 'Стикеры: не выбраны',
  ].join('\n');
}

function doPost(event) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const payload = JSON.parse(event.postData?.contents || '{}');
    const expectedSecret = properties.getProperty(PROPERTY_KEYS.secret);
    if (!expectedSecret || payload.secret !== expectedSecret) {
      return jsonResponse({ok: false, error: 'unauthorized'});
    }

    const order = payload.order;
    if (!order?.orderId || !order?.customer?.name) {
      return jsonResponse({ok: false, error: 'invalid_order'});
    }

    const root = DriveApp.getFolderById(
      properties.getProperty(PROPERTY_KEYS.driveFolderId),
    );
    const existing = root.getFoldersByName(order.orderId);
    const folder = existing.hasNext()
      ? existing.next()
      : root.createFolder(order.orderId);
    const summary = orderSummary(order);

    if (!folder.getFilesByName('request.txt').hasNext()) {
      folder.createFile('request.txt', summary, MimeType.PLAIN_TEXT);
      folder.createFile(
        'order.json',
        JSON.stringify({...order, artifacts: undefined}, null, 2),
        MimeType.PLAIN_TEXT,
      );
      if (order.artifacts?.ribbonSvg) {
        folder.createFile('ribbon.svg', order.artifacts.ribbonSvg, 'image/svg+xml');
      }
      if (order.artifacts?.stickerSvg) {
        folder.createFile('sticker.svg', order.artifacts.stickerSvg, 'image/svg+xml');
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
        safeCell(order.customer.comment),
        safeCell(summary),
        folder.getUrl(),
      ]);
    }

    return jsonResponse({ok: true, folderUrl: folder.getUrl()});
  } catch (error) {
    console.error(error);
    return jsonResponse({ok: false, error: 'internal_error'});
  }
}
