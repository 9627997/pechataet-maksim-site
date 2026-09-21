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
    scaleUpToFill = true,
    minFontSize = MIN_PRINT_FONT_SIZE,
  }) {
    if (!text) return {fits: true, fontSize: preferredSize, bbox: null};
    // Layout math (how much horizontal room this text needs) must use the
    // normal typographic advance width, not the tight ink width getBBox()
    // gives: real rendering always includes ordinary inter-letter spacing,
    // so sizing off the narrower ink width let text visually overflow
    // whatever box was allocated for it. Height keeps using the ink metric
    // — untouched here, only width was ever the source of the overflow.
    const widthAtPreferred = metrics.layoutWidthPerSize * preferredSize;
    const heightAtPreferred = metrics.heightPerSize * preferredSize;
    const scale = Math.min(
      scaleToFitWidth
        ? maxWidth / Math.max(widthAtPreferred, 1e-7)
        : scaleUpToFill
          ? 1
          : Infinity,
      maxHeight / Math.max(heightAtPreferred, 1e-7),
      scaleUpToFill ? Infinity : 1,
    );
    const fontSize = Math.max(minFontSize, preferredSize * scale);
    const width = metrics.layoutWidthPerSize * fontSize;
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
      width: Math.max(metrics.layoutWidthPerSize, 1e-7),
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
    scaleTextToFitWidth = false,
    minFontSize = MIN_PRINT_FONT_SIZE,
    axisScale = 1,
  }) {
    const geometry = window.RibbonStudioGeometry;
    const hasLogo = Boolean(logo);
    const hasText = Boolean(text);
    let logoBox = null;
    let textResult = {fits: true, bbox: null, fontSize: preferredFontSize};

    // Ribbon length (x) and ribbon width/height (y) can use different
    // real-world px-per-mm scales (see calculateRibbonLayout's axisScale) —
    // bounds.width and bounds.height are then not directly comparable, but
    // logoWidth (logo.ratio * bounds.height) and text metrics (which pair
    // with fontSize, itself fit against bounds.height) both naturally live
    // in bounds.height's own scale. So every horizontal fitting computation
    // below works in that one scale (bounds.width converted once, via
    // widthUnits/boundsX), and only the final logoBox/textBox — the values
    // handed back to callers that expect bounds.width's own scale — get
    // converted back through toWidthScale. axisScale defaults to 1 (a
    // no-op) for callers whose bounds are already uniformly scaled, e.g.
    // sticker roundrect layout, which reuses this same function.
    const widthUnits = bounds.width / axisScale;
    const boundsX = {...bounds, x: bounds.x / axisScale, width: widthUnits};
    const toWidthScale = (box) =>
      box && {...box, x: box.x * axisScale, width: box.width * axisScale};

    if (hasLogo && hasText) {
      const minimumTextWidth = Math.max(
        1,
        textMetrics.layoutWidthPerSize * minFontSize,
      );
      // The gap is defined as logoWidth / GOLDEN_RATIO, so logoWidth and gap
      // grow together; cap logoWidth so a minimum-width text still fits.
      const maximumLogoWidth = Math.max(
        1,
        (widthUnits - minimumTextWidth) / (1 + 1 / GOLDEN_RATIO),
      );
      const logoWidth = Math.min(
        maximumLogoWidth,
        logo.ratio * bounds.height,
      );
      const gap = Math.max(1, logoWidth / GOLDEN_RATIO);
      const textWidth = Math.max(1, widthUnits - logoWidth - gap);
      const logoBounds = {...boundsX, width: logoWidth};
      const source = logo.ratio >= 1
        ? {x: 0, y: 0, width: logo.ratio, height: 1}
        : {x: 0, y: 0, width: 1, height: 1 / logo.ratio};
      logoBox = geometry.fitRectToBounds(source, logoBounds, logoScale);
      const clamped = geometry.clampRectOffsetToBounds(
        logoBox,
        manualLayout ? boundsX : logoBounds,
        manualLayout ? logoOffsetX / axisScale : 0,
        manualLayout ? logoOffsetY : 0,
      );
      logoBox = {...logoBox, x: clamped.x, y: clamped.y};
      textResult = fitTextToArea({
        text,
        metrics: textMetrics,
        preferredSize: preferredFontSize,
        maxWidth: textWidth,
        maxHeight: bounds.height,
        centerX: boundsX.x + logoWidth + gap + textWidth / 2,
        centerY,
        scaleToFitWidth: scaleTextToFitWidth,
        scaleUpToFill: !manualLayout,
        minFontSize,
      });
      // fitTextToArea centers whatever width it actually fits within the
      // textWidth slot. A short word capped by height (not width) ends up
      // narrower than the slot, and centering it there pushes the visible
      // logo<->text gap wider than `gap` — by up to half the unused slot
      // width. Re-anchor flush after the gap so the gap the shopper sees
      // always equals the golden-ratio value exactly, regardless of how
      // much of the slot the fitted text actually uses.
      if (textResult.bbox) {
        textResult.bbox = {
          ...textResult.bbox,
          x: boundsX.x + logoWidth + gap,
        };
      }
    } else if (hasLogo) {
      const source = logo.ratio >= 1
        ? {x: 0, y: 0, width: logo.ratio, height: 1}
        : {x: 0, y: 0, width: 1, height: 1 / logo.ratio};
      logoBox = geometry.fitRectToBounds(source, boundsX, logoScale);
      const clamped = geometry.clampRectOffsetToBounds(
        logoBox,
        boundsX,
        manualLayout ? logoOffsetX / axisScale : 0,
        manualLayout ? logoOffsetY : 0,
      );
      logoBox = {...logoBox, x: clamped.x, y: clamped.y};
    } else if (hasText) {
      textResult = fitTextToArea({
        text,
        metrics: textMetrics,
        preferredSize: preferredFontSize,
        maxWidth: widthUnits,
        maxHeight: bounds.height,
        centerX: boundsX.x + widthUnits / 2,
        centerY,
        scaleToFitWidth: scaleTextToFitWidth,
        scaleUpToFill: !manualLayout,
        minFontSize,
      });
    }

    if (manualLayout && textResult.bbox) {
      const clamped = geometry.clampRectOffsetToBounds(
        textResult.bbox,
        boundsX,
        textOffsetX / axisScale,
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
      logoBox: toWidthScale(logoBox),
      textBox: toWidthScale(textResult.bbox),
      fontSize: textResult.fontSize,
      textScaleY: 1,
      manualLayout,
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
      ? fitTextToCircle({text, metrics: textMetrics, circle: area.circle, requestedScale: Math.max(0.1, textScale || 1)})
      : fitTextToArea({
          text,
          metrics: textMetrics,
          preferredSize: preferredFontSize,
          maxWidth: contentBounds.width,
          maxHeight: contentBounds.height,
          centerX,
          centerY,
        });

    if (hasLogo && hasText) {
      const maxContentWidth = isCircle
        ? area.circle.radius * 1.72
        : contentBounds.width * 0.88;
      const isWideRoundrect = !isCircle && area.widthMm / area.heightMm >= 3;
      if (isWideRoundrect) {
        const gap = contentBounds.width * 0.06;
        const logoSlotWidth = contentBounds.width * 0.27;
        const textSlotWidth = contentBounds.width * 0.57;
        const logoSlot = {
          x: centerX - (logoSlotWidth + gap + textSlotWidth) / 2,
          y: centerY - contentBounds.height * 0.40,
          width: logoSlotWidth,
          height: contentBounds.height * 0.80,
        };
        const textCenterX = logoSlot.x + logoSlot.width + gap + textSlotWidth / 2;
        logoBox = geometry.fitRectToBounds(source, logoSlot, logoScale);
        textResult = fitTextToArea({
          text,
          metrics: textMetrics,
          preferredSize: preferredFontSize,
          maxWidth: textSlotWidth,
          maxHeight: contentBounds.height * 0.68,
          centerX: textCenterX,
          centerY,
          scaleUpToFill: !manualLayout,
        });
      } else {
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
        textResult = fitTextToArea({
          text,
          metrics: textMetrics,
          preferredSize: preferredFontSize,
          maxWidth: maxContentWidth,
          maxHeight: maxTextHeight,
          centerX,
          centerY,
          scaleUpToFill: !manualLayout,
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
      textScaleY: 1,
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
