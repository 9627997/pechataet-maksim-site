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

  function serializeProductionSvg(svg) {
    const clone = svg.cloneNode(true);
    clone.querySelectorAll('[data-preview-overlay]').forEach((node) => node.remove());
    return new XMLSerializer().serializeToString(clone);
  }

  window.RibbonStudioGeometry = Object.freeze({
    PRINT_MARGIN_MM,
    getRibbonPrintableGeometry,
    getStickerPrintableGeometry,
    fitRectToBounds,
    fitRectToCircle,
    areRectCornersInsideCircle,
    clampRectOffsetToBounds,
    serializeProductionSvg,
  });
})();
