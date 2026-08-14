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
    const marginX = PRINT_MARGIN_MM * unitsPerMmX;
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
    const printableRadius = Math.min(
      printableWidth / 2,
      printableHeight / 2,
      Number(cornerRadiusMm || 0) * Math.min(unitsPerMmX, unitsPerMmY),
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
    return new XMLSerializer().serializeToString(clone);
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
  });
})();
