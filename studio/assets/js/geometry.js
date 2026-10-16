(() => {
  const PRINT_MARGIN_MM = 2.5;
  const EPSILON = 1e-7;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function getRibbonPrintableGeometry({
    widthMm,
    repeatMm,
    x = 0,
    y = 0,
    width,
    height,
  }) {
    const unitsPerMmX = width / repeatMm;
    const unitsPerMmY = height / widthMm;
    // The ribbon is printed continuously along its length: the end of one
    // repeat and the start of the next are adjacent printable area, with no
    // unprintable seam between them (the roll is cut to the ordered meters,
    // not at every repeat). Only the ribbon width edges need the printer's
    // safety margin, so there is deliberately no length-wise margin here —
    // it used to fight the user-controlled repeat interval and made a 0 mm
    // gap physically impossible ("встык" repeats).
    const marginX = 0;
    const marginY = PRINT_MARGIN_MM * unitsPerMmY;
    return {
      widthMm,
      repeatMm,
      printableHeightMm: widthMm - 2 * PRINT_MARGIN_MM,
      bounds: {
        x: x + marginX,
        y: y + marginY,
        width: Math.max(0, width - 2 * marginX),
        height: Math.max(0, height - 2 * marginY),
      },
      unitsPerMmX,
      unitsPerMmY,
    };
  }

  function getStickerPrintableGeometry({
    diameterMm,
    cx = 0,
    cy = 0,
    radius,
  }) {
    const printableDiameterMm = diameterMm - 2 * PRINT_MARGIN_MM;
    const unitsPerMm = (radius * 2) / diameterMm;
    return {
      diameterMm,
      printableDiameterMm,
      printableRadiusMm: printableDiameterMm / 2,
      circle: {
        cx,
        cy,
        radius: (printableDiameterMm / 2) * unitsPerMm,
      },
      unitsPerMm,
    };
  }

  function getStickerGeometry({
    shape = 'circle',
    widthMm,
    heightMm,
    diameterMm,
    cornerRadiusMm = 0,
    x = 22,
    y = 22,
    width = 356,
    height = 356,
  }) {
    const isCircle = shape === 'circle';
    const physicalWidth = Number(widthMm || diameterMm || 40);
    const physicalHeight = Number(heightMm || diameterMm || physicalWidth);
    if (isCircle) {
      const radius = Math.min(width, height) / 2;
      const cx = x + width / 2;
      const cy = y + height / 2;
      const circle = getStickerPrintableGeometry({
        diameterMm: physicalWidth,
        cx,
        cy,
        radius,
      }).circle;
      return {
        shape: 'circle',
        widthMm: physicalWidth,
        heightMm: physicalHeight,
        outer: {x, y, width, height},
        bounds: null,
        circle,
        radius,
      };
    }

    const scale = Math.min(width / physicalWidth, height / physicalHeight);
    const shapeWidth = physicalWidth * scale;
    const shapeHeight = physicalHeight * scale;
    const shapeX = x + (width - shapeWidth) / 2;
    const shapeY = y + (height - shapeHeight) / 2;
    const unitsPerMmX = scale;
    const unitsPerMmY = scale;
    const marginX = PRINT_MARGIN_MM * unitsPerMmX;
    const marginY = PRINT_MARGIN_MM * unitsPerMmY;
    const printableWidth = Math.max(0, shapeWidth - 2 * marginX);
    const printableHeight = Math.max(0, shapeHeight - 2 * marginY);
    const outerRadius = Math.min(
      shapeWidth / 2,
      shapeHeight / 2,
      Number(cornerRadiusMm || 0) * Math.min(unitsPerMmX, unitsPerMmY),
    );
    const printableRadius = Math.max(
      0,
      Math.min(
        printableWidth / 2,
        printableHeight / 2,
        (Number(cornerRadiusMm || 0) - PRINT_MARGIN_MM) * Math.min(unitsPerMmX, unitsPerMmY),
      ),
    );
    return {
      shape: 'roundrect',
      widthMm: physicalWidth,
      heightMm: physicalHeight,
      cornerRadiusMm: Number(cornerRadiusMm || 0),
      outer: {
        x: shapeX,
        y: shapeY,
        width: shapeWidth,
        height: shapeHeight,
        radius: outerRadius,
      },
      bounds: {
        x: shapeX + marginX,
        y: shapeY + marginY,
        width: printableWidth,
        height: printableHeight,
        radius: printableRadius,
      },
      circle: null,
      radius: null,
    };
  }

  function fitRectToSticker(rect, sticker, requestedScale = 1) {
    if (sticker?.shape === 'circle') return fitRectToCircle(rect, sticker.circle, requestedScale, 0);
    return fitRectToBounds(rect, sticker.bounds, requestedScale);
  }

  function clampRectOffsetToSticker(rect, sticker, offsetX = 0, offsetY = 0) {
    if (sticker?.shape === 'circle') return clampRectOffsetToCircle(rect, sticker.circle, offsetX, offsetY);
    return clampRectOffsetToBounds(rect, sticker.bounds, offsetX, offsetY);
  }

  function areRectCornersInsideSticker(rect, sticker) {
    if (sticker?.shape === 'circle') return areRectCornersInsideCircle(rect, sticker.circle, 0);
    const bounds = sticker?.bounds;
    if (!bounds) return false;
    const corners = rectCorners(rect, 0);
    return corners.every((corner) =>
      corner.x >= bounds.x - EPSILON &&
      corner.x <= bounds.x + bounds.width + EPSILON &&
      corner.y >= bounds.y - EPSILON &&
      corner.y <= bounds.y + bounds.height + EPSILON,
    );
  }

  function rectCorners(rect, rotationDeg = 0) {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const radians = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return [
      [-rect.width / 2, -rect.height / 2],
      [rect.width / 2, -rect.height / 2],
      [rect.width / 2, rect.height / 2],
      [-rect.width / 2, rect.height / 2],
    ].map(([dx, dy]) => ({
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    }));
  }

  function areRectCornersInsideCircle(rect, circle, rotationDeg = 0) {
    const radiusSquared = circle.radius ** 2 + EPSILON;
    return rectCorners(rect, rotationDeg).every(
      (corner) =>
        (corner.x - circle.cx) ** 2 + (corner.y - circle.cy) ** 2 <=
        radiusSquared,
    );
  }

  function fitRectToBounds(rect, bounds, requestedScale = 1) {
    if (!rect.width || !rect.height) return { ...rect, scale: 0 };
    const maximumScale = Math.min(
      bounds.width / rect.width,
      bounds.height / rect.height,
    );
    const scale = Math.min(maximumScale, maximumScale * requestedScale);
    return {
      x: bounds.x + (bounds.width - rect.width * scale) / 2,
      y: bounds.y + (bounds.height - rect.height * scale) / 2,
      width: rect.width * scale,
      height: rect.height * scale,
      scale,
    };
  }

  function fitRectToCircle(
    rect,
    circle,
    requestedScale = 1,
    rotationDeg = 0,
  ) {
    if (!rect.width || !rect.height) return { ...rect, scale: 0 };
    const centered = {
      x: circle.cx - rect.width / 2,
      y: circle.cy - rect.height / 2,
      width: rect.width,
      height: rect.height,
    };
    const farthestCorner = Math.max(
      ...rectCorners(centered, rotationDeg).map((corner) =>
        Math.hypot(corner.x - circle.cx, corner.y - circle.cy),
      ),
    );
    const maximumScale = circle.radius / farthestCorner;
    const scale = Math.min(maximumScale, maximumScale * requestedScale);
    return {
      x: circle.cx - (rect.width * scale) / 2,
      y: circle.cy - (rect.height * scale) / 2,
      width: rect.width * scale,
      height: rect.height * scale,
      scale,
    };
  }

  function clampRectOffsetToBounds(rect, bounds, offsetX = 0, offsetY = 0) {
    return {
      x: clamp(rect.x + offsetX, bounds.x, bounds.x + bounds.width - rect.width),
      y: clamp(
        rect.y + offsetY,
        bounds.y,
        bounds.y + bounds.height - rect.height,
      ),
      offsetX: clamp(
        offsetX,
        bounds.x - rect.x,
        bounds.x + bounds.width - rect.width - rect.x,
      ),
      offsetY: clamp(
        offsetY,
        bounds.y - rect.y,
        bounds.y + bounds.height - rect.height - rect.y,
      ),
    };
  }

  function clampRectOffsetToCircle(rect, circle, offsetX = 0, offsetY = 0) {
    const shifted = (factor) => ({
      ...rect,
      x: rect.x + offsetX * factor,
      y: rect.y + offsetY * factor,
    });
    if (areRectCornersInsideCircle(shifted(1), circle, 0)) {
      return {...shifted(1), offsetX, offsetY};
    }

    let low = 0;
    let high = 1;
    for (let index = 0; index < 24; index += 1) {
      const middle = (low + high) / 2;
      if (areRectCornersInsideCircle(shifted(middle), circle, 0)) low = middle;
      else high = middle;
    }
    return {
      ...shifted(low),
      offsetX: offsetX * low,
      offsetY: offsetY * low,
    };
  }

  function serializeProductionSvg(svg) {
    const clone = svg.cloneNode(true);
    clone.querySelectorAll('[data-preview-overlay]').forEach((node) => node.remove());
    clone
      .querySelectorAll('image[href^="data:image/svg+xml;base64,"]')
      .forEach((image) => {
        try {
          const source = atob(image.getAttribute('href').split(',')[1]);
          const parsed = new DOMParser().parseFromString(
            source,
            'image/svg+xml',
          ).documentElement;
          const viewBox = (parsed.getAttribute('viewBox') || '')
            .trim()
            .split(/[\s,]+/)
            .map(Number);
          const x = Number(image.getAttribute('x') || 0);
          const y = Number(image.getAttribute('y') || 0);
          const width = Number(image.getAttribute('width') || 0);
          const height = Number(image.getAttribute('height') || 0);
          if (
            viewBox.length !== 4 ||
            !viewBox.every(Number.isFinite) ||
            !width ||
            !height
          ) {
            return;
          }
          const [viewX, viewY, viewWidth, viewHeight] = viewBox;
          const scale = Math.min(
            width / Math.max(viewWidth, 0.001),
            height / Math.max(viewHeight, 0.001),
          );
          const group = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'g',
          );
          group.setAttribute(
            'transform',
            [
              `translate(${x + (width - viewWidth * scale) / 2} ${
                y + (height - viewHeight * scale) / 2
              })`,
              `scale(${scale})`,
              `translate(${-viewX} ${-viewY})`,
            ].join(' '),
          );
          [...parsed.childNodes].forEach((node) =>
            group.appendChild(document.importNode(node, true)),
          );
          image.replaceWith(group);
        } catch {
          // Keep the embedded image if the uploaded SVG cannot be parsed safely.
        }
      });
    return new XMLSerializer().serializeToString(clone);
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function printEl(tag, attrs = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([name, value]) => {
      if (value !== undefined && value !== null) {
        element.setAttribute(name, String(value));
      }
    });
    return element;
  }

  function applyBlackOnly(root) {
    root.querySelectorAll('[stroke]').forEach((node) => {
      if (node.getAttribute('stroke') !== 'none') node.setAttribute('stroke', '#000000');
    });
    root.querySelectorAll('[fill]').forEach((node) => {
      if (node.getAttribute('fill') !== 'none') node.setAttribute('fill', '#000000');
    });
    root.querySelectorAll('*').forEach((node) => {
      node.removeAttribute('filter');
      if (node.style) node.style.removeProperty('filter');
      const style = node.getAttribute('style');
      if (style) {
        node.setAttribute('style', style.replace(/(fill|stroke)\s*:\s*(?!none)[^;]+/gi, '$1:#000000'));
      }
      if (node.getAttribute('fill') === 'currentColor') node.setAttribute('fill', '#000000');
      if (node.getAttribute('stroke') === 'currentColor') node.setAttribute('stroke', '#000000');
    });
  }

  // Собирает автономный печатный SVG-документ ровно из одного периода печати
  // (тайла): width/height = реальные миллиметры, без фона и направляющих, всё
  // содержимое чёрным, текст самодостаточен за счёт встроенных @font-face
  // (fonts: {familyName: dataUrl}).
  //
  // ВАЖНО: входной viewBox приходит в canvas-координатах студии (content
  // внутри уже смещён на свои абсолютные позиции). Корневой viewBox файла
  // должен быть тайл-локальным «0 0 w h»: иначе при одновременном
  // translate(-x -y) на inner-g контент уходит за пределы холста и файл
  // уходит в печать пустым (или со сдвигом на величину тайла) — баг границ
  // и интервалов из Drive/Telegram. Клип намеренно остаётся в canvas-
  // координатах: clipPath userSpaceOnUse живёт в локальном пространстве
  // inner-g, куда уже применён translate(-x -y), поэтому на холсте он
  // покрывает ровно тайл.
  function buildPrintTile({viewBox, widthMm, heightMm, fonts = {}, draw}) {
    const root = printEl('svg', {
      xmlns: SVG_NS,
      viewBox: `0 0 ${Number(viewBox[2].toFixed(4))} ${Number(viewBox[3].toFixed(4))}`,
    });
    if (Number.isFinite(Number(widthMm)) && Number(widthMm) > 0) {
      root.setAttribute('width', `${Number(widthMm)}mm`);
    }
    if (Number.isFinite(Number(heightMm)) && Number(heightMm) > 0) {
      root.setAttribute('height', `${Number(heightMm)}mm`);
    }
    root.setAttribute('data-file-purpose', 'print-black');
    root.setAttribute('data-target-dpi', '300');

    const defs = printEl('defs');
    const clipId = 'printTileClip';
    const clipPath = printEl('clipPath', {id: clipId});
    clipPath.appendChild(
      printEl('rect', {
        x: viewBox[0],
        y: viewBox[1],
        width: Number(viewBox[2].toFixed(4)),
        height: Number(viewBox[3].toFixed(4)),
      }),
    );
    defs.appendChild(clipPath);
    const fontFaces = buildFontFaceCss(fonts);
    if (fontFaces) {
      const style = printEl('style');
      style.textContent = fontFaces;
      defs.appendChild(style);
    }
    root.appendChild(defs);

    const inner = printEl('g', {
      transform: `translate(${-viewBox[0]} ${-viewBox[1]})`,
      'clip-path': `url(#${clipId})`,
    });
    root.appendChild(inner);
    draw(inner);
    applyBlackOnly(inner);
    return new XMLSerializer().serializeToString(root);
  }

  // CSS-правила @font-face для встраивания шрифтов в автономный SVG
  // (растровое превью и печатные файлы рендерятся вне страницы студии,
  // поэтому страничные стили и шрифты там недоступны).
  function buildFontFaceCss(fonts) {
    if (!fonts) return '';
    return Object.entries(fonts)
      .flatMap(([family, sources]) =>
        (Array.isArray(sources) ? sources : [sources])
          .filter(Boolean)
          .map((source) => {
            const src = typeof source === 'string' ? source : source.src;
            const unicodeRange =
              typeof source === 'string' ? '' : source.unicodeRange || '';
            return `@font-face { font-family: "${family}"; src: url("${src}") format("woff2"); font-weight: 200 800; font-style: normal;${unicodeRange ? ` unicode-range: ${unicodeRange};` : ''} }`;
          }),
      )
      .join('\n');
  }

  // Встраивает @font-face в сериализованный SVG, чтобы текст рендерился
  // тем же шрифтом, что видит пользователь в студии.
  function withEmbeddedFonts(markup, fonts) {
    const css = buildFontFaceCss(fonts);
    if (!css) return markup;
    const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
    const root = parsed.documentElement;
    if (!root || parsed.querySelector('parsererror')) return markup;
    const style = document.createElementNS(SVG_NS, 'style');
    style.textContent = css;
    const defs = root.querySelector('defs');
    if (defs) defs.appendChild(style);
    else root.insertBefore(style, root.firstChild);
    return new XMLSerializer().serializeToString(root);
  }

  // Растеризует SVG-элемент в PNG data URL (визуализация для заявки).
  // Сериализуется production-версия SVG (без preview-оверлеев и гайдов —
  // их стили живут на странице, и вне её они рисуются чёрными и закрывают
  // текст), с встроенными шрифтами (fonts: {family: src|[{src,unicodeRange}]}).
  function rasterizeSvgToPngDataUrl(svg, {maxWidthPx = 2600, fonts} = {}) {
    const markup = withEmbeddedFonts(serializeProductionSvg(svg), fonts);
    const source = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(markup)));
    const viewBox = (svg.getAttribute('viewBox') || '')
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const baseWidth = viewBox.length === 4 && viewBox.every(Number.isFinite)
      ? viewBox[2]
      : 0;
    const baseHeight = viewBox.length === 4 && viewBox.every(Number.isFinite)
      ? viewBox[3]
      : 0;
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const intrinsicWidth = baseWidth || image.naturalWidth || 1200;
        const intrinsicHeight = baseHeight || image.naturalHeight || 260;
        const scale = Math.min(2, maxWidthPx / intrinsicWidth);
        const width = Math.max(1, Math.round(intrinsicWidth * scale));
        const height = Math.max(1, Math.round(intrinsicHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.fillStyle = '#f6f1ea';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = () => resolve('');
      image.src = source;
    });
  }

  function serializePrintSvg(svg, {widthMm, heightMm, fonts} = {}) {
    const parsed = new DOMParser().parseFromString(
      serializeProductionSvg(svg),
      'image/svg+xml',
    );
    const source = parsed.documentElement;
    const isRibbon = Boolean(source.querySelector('#ribbonClip'));
    let viewBox = null;
    let draw = null;
    if (isRibbon) {
      // Тайл = клип первой ячейки с текстом (иначе первой ячейки) во весь
      // профиль ленты (#clipRect задаёт полную высоту, включая 2,5 мм поля).
      const cells = [...source.querySelectorAll('g[data-production-content]')];
      const cell = cells.find((node) => node.querySelector('text')) || cells[0];
      const clipId = (cell?.getAttribute('clip-path') || '').match(/#([^)]+)\)/)?.[1];
      const rect = clipId
        ? source.querySelector(`clipPath[id="${clipId}"] rect`)
        : null;
      const band = source.querySelector('#clipRect');
      if (cell && rect && band) {
        viewBox = [
          Number(rect.getAttribute('x')),
          Number(band.getAttribute('y')),
          Number(rect.getAttribute('width')),
          Number(band.getAttribute('height')),
        ];
        draw = (target) => {
          [...cell.childNodes].forEach((node) => {
            target.appendChild(target.ownerDocument.importNode(node, true));
          });
        };
      }
    } else {
      // Стикер: production-контент целиком, тайл = видимая форма стикера.
      const content =
        source.querySelector('#stickerContent [data-production-content]') ||
        source.querySelector('[data-production-content]');
      const bg = source.querySelector('#stickerBg');
      if (content && bg) {
        if (bg.tagName.toLowerCase() === 'circle') {
          const r = Number(bg.getAttribute('r'));
          const cx = Number(bg.getAttribute('cx'));
          const cy = Number(bg.getAttribute('cy'));
          viewBox = [cx - r, cy - r, r * 2, r * 2];
        } else {
          viewBox = [
            Number(bg.getAttribute('x')),
            Number(bg.getAttribute('y')),
            Number(bg.getAttribute('width')),
            Number(bg.getAttribute('height')),
          ];
        }
        draw = (target) => {
          [...content.childNodes].forEach((node) => {
            target.appendChild(target.ownerDocument.importNode(node, true));
          });
        };
      }
    }
    if (!viewBox || !draw || viewBox.some((value) => !Number.isFinite(value))) {
      // Запасной вариант: весь холст, как раньше.
      source.querySelectorAll('[data-preview-overlay]').forEach((node) => node.remove());
      source.querySelectorAll('#ribbonBase, #ribbonShine, #stickerBg').forEach((node) => node.remove());
      source.querySelectorAll('#ribbonPrintableGuide, #stickerPrintableGuide').forEach((node) => node.remove());
      applyBlackOnly(source);
      if (Number.isFinite(Number(widthMm)) && Number(widthMm) > 0) source.setAttribute('width', `${Number(widthMm)}mm`);
      if (Number.isFinite(Number(heightMm)) && Number(heightMm) > 0) source.setAttribute('height', `${Number(heightMm)}mm`);
      source.setAttribute('data-file-purpose', 'print-black');
      source.setAttribute('data-target-dpi', '300');
      return new XMLSerializer().serializeToString(source);
    }
    return buildPrintTile({viewBox, widthMm, heightMm, fonts, draw});
  }

  window.RibbonStudioGeometry = Object.freeze({
    PRINT_MARGIN_MM,
    getRibbonPrintableGeometry,
    getStickerPrintableGeometry,
    getStickerGeometry,
    fitRectToBounds,
    fitRectToCircle,
    areRectCornersInsideCircle,
    clampRectOffsetToBounds,
    clampRectOffsetToCircle,
    fitRectToSticker,
    clampRectOffsetToSticker,
    areRectCornersInsideSticker,
    serializeProductionSvg,
    serializePrintSvg,
    buildPrintTile,
    rasterizeSvgToPngDataUrl,
  });
})();
