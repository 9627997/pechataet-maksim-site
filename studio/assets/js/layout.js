(() => {
  const MIN_PRINT_FONT_SIZE = 10;

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
    logoOffsetX,
    preferredFontSize,
  }) {
    const geometry = window.RibbonStudioGeometry;
    const hasLogo = Boolean(logo);
    const hasText = Boolean(text);
    let logoBox = null;
    let textResult = {fits: true, bbox: null, fontSize: preferredFontSize};

    if (hasLogo && hasText) {
      const gap = bounds.width * 0.04;
      const logoWidth = bounds.width * 0.42;
      const textWidth = bounds.width - logoWidth - gap;
      const logoBounds = {...bounds, width: logoWidth};
      const source = logo.ratio >= 1
        ? {x: 0, y: 0, width: logo.ratio, height: 1}
        : {x: 0, y: 0, width: 1, height: 1 / logo.ratio};
      logoBox = geometry.fitRectToBounds(source, logoBounds, logoScale);
      const clamped = geometry.clampRectOffsetToBounds(
        logoBox,
        logoBounds,
        logoOffsetX,
        0,
      );
      logoBox = {...logoBox, x: clamped.x, y: clamped.y};
      textResult = fitTextToArea({
        text,
        metrics: textMetrics,
        preferredSize: preferredFontSize,
        maxWidth: textWidth * 0.94,
        maxHeight: bounds.height,
        centerX: bounds.x + logoWidth + gap + textWidth / 2,
        centerY,
        scaleToFitWidth: false,
      });
    } else if (hasLogo) {
      const source = logo.ratio >= 1
        ? {x: 0, y: 0, width: logo.ratio, height: 1}
        : {x: 0, y: 0, width: 1, height: 1 / logo.ratio};
      logoBox = geometry.fitRectToBounds(source, bounds, logoScale);
      const clamped = geometry.clampRectOffsetToBounds(
        logoBox,
        bounds,
        logoOffsetX,
        0,
      );
      logoBox = {...logoBox, x: clamped.x, y: clamped.y};
    } else if (hasText) {
      textResult = fitTextToArea({
        text,
        metrics: textMetrics,
        preferredSize: preferredFontSize,
        maxWidth: bounds.width,
        maxHeight: bounds.height,
        centerX: bounds.x + bounds.width / 2,
        centerY,
        scaleToFitWidth: false,
      });
    }

    return {
      valid: textResult.fits,
      reason: textResult.reason,
      bounds,
      logoBox,
      textBox: textResult.bbox,
      fontSize: textResult.fontSize,
    };
  }

  function getStickerContentLayout({
    circle,
    logo,
    text,
    textMetrics,
    logoScale,
    preferredFontSize,
  }) {
    const geometry = window.RibbonStudioGeometry;
    const hasLogo = Boolean(logo);
    const hasText = Boolean(text);
    let logoBox = null;
    let textResult = {fits: true, bbox: null, fontSize: preferredFontSize};

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
    };
  }

  window.RibbonStudioLayout = Object.freeze({
    MIN_PRINT_FONT_SIZE,
    fitTextToArea,
    getRibbonContentLayout,
    getStickerContentLayout,
  });
})();
