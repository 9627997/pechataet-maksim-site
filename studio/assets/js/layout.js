(() => {
  const MIN_PRINT_FONT_SIZE = 10;
  const GOLDEN_RATIO = 1.618;

  function fitTextToArea({
    text,
    metrics,
    preferredSize,
    maxWidth,
    maxHeight,
    centerX,
    centerY,
    scaleToFitWidth = true,
  }) {
    if (!text) return {fits: true, fontSize: preferredSize, bbox: null};
    const widthAtPreferred = metrics.widthPerSize * preferredSize;
    const heightAtPreferred = metrics.heightPerSize * preferredSize;
    const scale = Math.min(
      1,
      scaleToFitWidth
        ? maxWidth / Math.max(widthAtPreferred, 1e-7)
        : 1,
      maxHeight / Math.max(heightAtPreferred, 1e-7),
    );
    const fontSize = Math.max(MIN_PRINT_FONT_SIZE, preferredSize * scale);
    const width = metrics.widthPerSize * fontSize;
    const height = metrics.heightPerSize * fontSize;
    const fits = width <= maxWidth + 1e-7 && height <= maxHeight + 1e-7;
    return {
      fits,
      fontSize,
      width,
      height,
      bbox: fits
        ? {
            x: centerX - width / 2,
            y: centerY - height / 2,
            width,
            height,
          }
        : null,
      reason: fits ? undefined : 'text-too-long',
    };
  }

  function getRibbonContentLayout({
    bounds,
    centerY,
    logo,
    text,
    textMetrics,
    logoScale,
    logoOffsetX = 0,
    logoOffsetY = 0,
    textOffsetX = 0,
    textOffsetY = 0,
    preferredFontSize,
  }) {
    const geometry = window.RibbonStudioGeometry;
    const hasLogo = Boolean(logo);
    const hasText = Boolean(text);
    let logoBox = null;
    let textResult = {fits: true, bbox: null, fontSize: preferredFontSize};
    const appliedOffsets = {logoX: 0, logoY: 0, textX: 0, textY: 0};

    if (hasLogo && hasText) {
      const source = logo.ratio >= 1
        ? {x: 0, y: 0, width: logo.ratio, height: 1}
        : {x: 0, y: 0, width: 1, height: 1 / logo.ratio};
      logoBox = geometry.fitRectToBounds(source, bounds, logoScale);
      logoBox = {
        ...logoBox,
        x: bounds.x,
        y: centerY - logoBox.height / 2,
      };
      const gap = logoBox.width / GOLDEN_RATIO;
      const targetTextHeight = logoBox.height / GOLDEN_RATIO;
      const preferredTextSize = textMetrics.heightPerSize
        ? targetTextHeight / textMetrics.heightPerSize
        : preferredFontSize;
      const expectedTextWidth = textMetrics.widthPerSize * preferredTextSize;
      const textStartX = logoBox.x + logoBox.width + gap;
      const textWidth = Math.max(
        0,
        bounds.x + bounds.width - textStartX,
      );
      textResult = fitTextToArea({
        text,
        metrics: textMetrics,
        preferredSize: preferredTextSize,
        maxWidth: textWidth,
        maxHeight: targetTextHeight,
        centerX: textStartX + expectedTextWidth / 2,
        centerY,
        scaleToFitWidth: false,
      });
    } else if (hasLogo) {
      const source = logo.ratio >= 1
        ? {x: 0, y: 0, width: logo.ratio, height: 1}
        : {x: 0, y: 0, width: 1, height: 1 / logo.ratio};
      logoBox = geometry.fitRectToBounds(source, bounds, logoScale);
    } else if (hasText) {
      const preferredTextSize = textMetrics.heightPerSize
        ? bounds.height / textMetrics.heightPerSize
        : preferredFontSize;
      textResult = fitTextToArea({
        text,
        metrics: textMetrics,
        preferredSize: preferredTextSize,
        maxWidth: bounds.width,
        maxHeight: bounds.height,
        centerX: bounds.x + bounds.width / 2,
        centerY,
        scaleToFitWidth: false,
      });
    }

    if (logoBox) {
      const clamped = geometry.clampRectOffsetToBounds(
        logoBox,
        bounds,
        logoOffsetX,
        logoOffsetY,
      );
      appliedOffsets.logoX = clamped.offsetX;
      appliedOffsets.logoY = clamped.offsetY;
      logoBox = {...logoBox, x: clamped.x, y: clamped.y};
    }
    if (textResult.bbox) {
      const clamped = geometry.clampRectOffsetToBounds(
        textResult.bbox,
        bounds,
        textOffsetX,
        textOffsetY,
      );
      appliedOffsets.textX = clamped.offsetX;
      appliedOffsets.textY = clamped.offsetY;
      textResult.bbox = {
        ...textResult.bbox,
        x: clamped.x,
        y: clamped.y,
      };
    }

    return {
      valid: textResult.fits,
      reason: textResult.reason,
      bounds,
      logoBox,
      textBox: textResult.bbox,
      fontSize: textResult.fontSize,
      appliedOffsets,
    };
  }

  function getStickerContentLayout({
    circle,
    logo,
    text,
    textMetrics,
    logoScale,
    logoOffsetX = 0,
    logoOffsetY = 0,
    textOffsetX = 0,
    textOffsetY = 0,
    preferredFontSize,
  }) {
    const geometry = window.RibbonStudioGeometry;
    const hasLogo = Boolean(logo);
    const hasText = Boolean(text);
    let logoBox = null;
    let textResult = {fits: true, bbox: null, fontSize: preferredFontSize};
    const appliedOffsets = {logoX: 0, logoY: 0, textX: 0, textY: 0};

    if (hasLogo && hasText) {
      const maxContentWidth = circle.radius * 1.72;
      const maxLogoHeight = circle.radius * 0.64;
      const maxTextHeight = circle.radius * 0.28;
      const gap = circle.radius * 0.06;
      const source = logo.ratio >= 1
        ? {x: 0, y: 0, width: logo.ratio, height: 1}
        : {x: 0, y: 0, width: 1, height: 1 / logo.ratio};
      logoBox = geometry.fitRectToBounds(
        source,
        {
          x: circle.cx - maxContentWidth / 2,
          y: circle.cy - maxLogoHeight / 2,
          width: maxContentWidth,
          height: maxLogoHeight,
        },
        logoScale,
      );
      textResult = fitTextToArea({
        text,
        metrics: textMetrics,
        preferredSize: preferredFontSize,
        maxWidth: maxContentWidth,
        maxHeight: maxTextHeight,
        centerX: circle.cx,
        centerY: circle.cy,
      });
      const textHeight = textResult.height || 0;
      const stackHeight = logoBox.height + gap + textHeight;
      const stackTop = circle.cy - stackHeight / 2;
      logoBox = {
        ...logoBox,
        x: circle.cx - logoBox.width / 2,
        y: stackTop,
      };
      if (textResult.bbox) {
        textResult.bbox = {
          ...textResult.bbox,
          x: circle.cx - textResult.bbox.width / 2,
          y: stackTop + logoBox.height + gap,
        };
      }
    } else if (hasLogo) {
      const source = logo.ratio >= 1
        ? {x: 0, y: 0, width: logo.ratio, height: 1}
        : {x: 0, y: 0, width: 1, height: 1 / logo.ratio};
      logoBox = geometry.fitRectToCircle(source, circle, logoScale, 0);
    } else if (hasText) {
      textResult = fitTextToArea({
        text,
        metrics: textMetrics,
        preferredSize: preferredFontSize,
        maxWidth: circle.radius * Math.SQRT2,
        maxHeight: circle.radius * Math.SQRT2,
        centerX: circle.cx,
        centerY: circle.cy,
      });
    }

    if (logoBox) {
      const clamped = geometry.clampRectOffsetToCircle(
        logoBox,
        circle,
        logoOffsetX,
        logoOffsetY,
      );
      appliedOffsets.logoX = clamped.offsetX;
      appliedOffsets.logoY = clamped.offsetY;
      logoBox = {...logoBox, x: clamped.x, y: clamped.y};
    }
    if (textResult.bbox) {
      const clamped = geometry.clampRectOffsetToCircle(
        textResult.bbox,
        circle,
        textOffsetX,
        textOffsetY,
      );
      appliedOffsets.textX = clamped.offsetX;
      appliedOffsets.textY = clamped.offsetY;
      textResult.bbox = {
        ...textResult.bbox,
        x: clamped.x,
        y: clamped.y,
      };
    }

    const logoFits =
      !logoBox || geometry.areRectCornersInsideCircle(logoBox, circle, 0);
    const textFits =
      !textResult.bbox ||
      geometry.areRectCornersInsideCircle(textResult.bbox, circle, 0);
    const valid = textResult.fits && logoFits && textFits;
    return {
      valid,
      reason:
        textResult.reason ||
        (!logoFits ? 'logo-outside-printable-area' : undefined) ||
        (!textFits ? 'text-outside-printable-area' : undefined),
      circle,
      logoBox: logoFits ? logoBox : null,
      textBox: textResult.fits && textFits ? textResult.bbox : null,
      fontSize: textResult.fontSize,
      appliedOffsets,
    };
  }

  window.RibbonStudioLayout = Object.freeze({
    MIN_PRINT_FONT_SIZE,
    fitTextToArea,
    getRibbonContentLayout,
    getStickerContentLayout,
  });
})();
