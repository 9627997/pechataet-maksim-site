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

  function fitTextToCircle({
    text,
    metrics,
    circle,
    requestedScale = 1,
  }) {
    if (!text) return {fits: true, fontSize: 0, bbox: null};
    const geometry = window.RibbonStudioGeometry;
    const source = {
      x: 0,
      y: 0,
      width: Math.max(metrics.widthPerSize, 1e-7),
      height: Math.max(metrics.heightPerSize, 1e-7),
    };
    const bbox = geometry.fitRectToCircle(
      source,
      circle,
      Math.min(1, Math.max(0, requestedScale)),
      0,
    );
    const fontSize = bbox.scale;
    const fits =
      fontSize >= MIN_PRINT_FONT_SIZE &&
      geometry.areRectCornersInsideCircle(bbox, circle, 0);
    return {
      fits,
      fontSize,
      width: bbox.width,
      height: bbox.height,
      bbox: fits ? bbox : null,
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
    logoOffsetY = 0,
    textOffsetX = 0,
    textOffsetY = 0,
    manualLayout = false,
    preferredFontSize,
  }) {
    const geometry = window.RibbonStudioGeometry;
    const hasLogo = Boolean(logo);
    const hasText = Boolean(text);
    let logoBox = null;
    let textResult = {fits: true, bbox: null, fontSize: preferredFontSize};

    if (hasLogo && hasText) {
      const gap = bounds.width * 0.04;
      const logoWidth = Math.min(
        bounds.width * 0.72,
        logo.ratio * bounds.height,
      );
      const textWidth = bounds.width - logoWidth - gap;
      const logoBounds = {...bounds, width: logoWidth};
      const source = logo.ratio >= 1
        ? {x: 0, y: 0, width: logo.ratio, height: 1}
        : {x: 0, y: 0, width: 1, height: 1 / logo.ratio};
      logoBox = geometry.fitRectToBounds(source, logoBounds, logoScale);
      const clamped = geometry.clampRectOffsetToBounds(
        logoBox,
        manualLayout ? bounds : logoBounds,
        manualLayout ? logoOffsetX : 0,
        manualLayout ? logoOffsetY : 0,
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
        manualLayout ? logoOffsetX : 0,
        manualLayout ? logoOffsetY : 0,
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

    if (manualLayout && textResult.bbox) {
      const clamped = geometry.clampRectOffsetToBounds(
        textResult.bbox,
        bounds,
        textOffsetX,
        textOffsetY,
      );
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
    };
  }

  function getStickerContentLayout({
    stickerArea,
    circle,
    logo,
    text,
    textMetrics,
    logoScale,
    logoOffsetX = 0,
    logoOffsetY = 0,
    textOffsetX = 0,
    textOffsetY = 0,
    manualLayout = false,
    preferredFontSize,
    textScale = 1,
  }) {
    const geometry = window.RibbonStudioGeometry;
    const area = stickerArea || {
      shape: 'circle',
      circle,
      bounds: null,
    };
    const isCircle = area.shape === 'circle';
    const contentBounds = isCircle
      ? {
          x: area.circle.cx - area.circle.radius * 0.86,
          y: area.circle.cy - area.circle.radius * 0.86,
          width: area.circle.radius * 1.72,
          height: area.circle.radius * 1.72,
        }
      : area.bounds;
    const centerX = isCircle ? area.circle.cx : area.bounds.x + area.bounds.width / 2;
    const centerY = isCircle ? area.circle.cy : area.bounds.y + area.bounds.height / 2;
    const hasLogo = Boolean(logo);
    const hasText = Boolean(text);
    let logoBox = null;
    let textResult = {fits: true, bbox: null, fontSize: preferredFontSize};
    const source = logo?.ratio >= 1
      ? {x: 0, y: 0, width: logo.ratio, height: 1}
      : {x: 0, y: 0, width: 1, height: 1 / (logo?.ratio || 1)};
    const fitText = () => isCircle
      ? fitTextToCircle({text, metrics: textMetrics, circle: area.circle, requestedScale: textScale})
      : fitTextToArea({
          text,
          metrics: textMetrics,
          preferredSize: preferredFontSize,
          maxWidth: contentBounds.width,
          maxHeight: contentBounds.height,
          centerX,
          centerY,
        });

    if (hasLogo && hasText && manualLayout) {
      logoBox = geometry.fitRectToSticker(source, area, logoScale);
      textResult = fitText();
    } else if (hasLogo && hasText) {
      const maxContentWidth = isCircle
        ? area.circle.radius * 1.72
        : contentBounds.width * 0.88;
      const maxLogoHeight = isCircle
        ? area.circle.radius * 0.64
        : contentBounds.height * 0.58;
      const maxTextHeight = isCircle
        ? area.circle.radius * 0.28
        : contentBounds.height * 0.30;
      const gap = isCircle ? area.circle.radius * 0.06 : contentBounds.height * 0.08;
      logoBox = geometry.fitRectToBounds(
        source,
        {
          x: centerX - maxContentWidth / 2,
          y: centerY - maxLogoHeight / 2,
          width: maxContentWidth,
          height: maxLogoHeight,
        },
        logoScale,
      );
      textResult = isCircle
        ? fitTextToArea({
            text,
            metrics: textMetrics,
            preferredSize: preferredFontSize,
            maxWidth: maxContentWidth,
            maxHeight: maxTextHeight,
            centerX,
            centerY,
          })
        : fitTextToArea({
            text,
            metrics: textMetrics,
            preferredSize: preferredFontSize,
            maxWidth: maxContentWidth,
            maxHeight: maxTextHeight,
            centerX,
            centerY,
          });
      const textHeight = textResult.height || 0;
      const stackHeight = logoBox.height + gap + textHeight;
      const stackTop = centerY - stackHeight / 2;
      logoBox = {...logoBox, x: centerX - logoBox.width / 2, y: stackTop};
      if (textResult.bbox) {
        textResult.bbox = {
          ...textResult.bbox,
          x: centerX - textResult.bbox.width / 2,
          y: stackTop + logoBox.height + gap,
        };
      }
    } else if (hasLogo) {
      logoBox = geometry.fitRectToSticker(source, area, logoScale);
    } else if (hasText) {
      textResult = fitText();
    }

    if (manualLayout && logoBox) {
      logoBox = geometry.clampRectOffsetToSticker(logoBox, area, logoOffsetX, logoOffsetY);
    }
    if (manualLayout && textResult.bbox) {
      textResult.bbox = geometry.clampRectOffsetToSticker(textResult.bbox, area, textOffsetX, textOffsetY);
    }

    const logoFits = !logoBox || geometry.areRectCornersInsideSticker(logoBox, area);
    const textFits = !textResult.bbox || geometry.areRectCornersInsideSticker(textResult.bbox, area);
    const valid = textResult.fits && logoFits && textFits;
    return {
      valid,
      reason:
        textResult.reason ||
        (!logoFits ? 'logo-outside-printable-area' : undefined) ||
        (!textFits ? 'text-outside-printable-area' : undefined),
      circle: area.circle,
      stickerArea: area,
      logoBox: logoFits ? logoBox : null,
      textBox: textResult.fits && textFits ? textResult.bbox : null,
      fontSize: textResult.fontSize,
    };
  }

  window.RibbonStudioLayout = Object.freeze({
    MIN_PRINT_FONT_SIZE,
    fitTextToArea,
    fitTextToCircle,
    getRibbonContentLayout,
    getStickerContentLayout,
  });
})();
