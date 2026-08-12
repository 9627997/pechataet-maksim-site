(() => {
  const ALPHA_THRESHOLD = 40;
  const MIN_SIGN_RATIO = 0.0015;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function percentile(values, ratio) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
  }

  function colorDistance(red, green, blue, background) {
    return Math.hypot(
      red - background[0],
      green - background[1],
      blue - background[2],
    );
  }

  function getMaskBounds(mask, width, height) {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let count = 0;

    for (let index = 0; index < mask.length; index += 1) {
      if (!mask[index]) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      count += 1;
    }

    if (!count) return null;
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      count,
    };
  }

  function getPerimeterIndices(bounds, width) {
    const indices = [];
    const right = bounds.x + bounds.width - 1;
    const bottom = bounds.y + bounds.height - 1;

    for (let x = bounds.x; x <= right; x += 1) {
      indices.push(bounds.y * width + x);
      if (bottom !== bounds.y) indices.push(bottom * width + x);
    }
    for (let y = bounds.y + 1; y < bottom; y += 1) {
      indices.push(y * width + bounds.x);
      if (right !== bounds.x) indices.push(y * width + right);
    }
    return indices;
  }

  function getMaskMetrics(mask, domainMask, bounds, width) {
    let count = 0;
    let domainCount = 0;
    for (let index = 0; index < mask.length; index += 1) {
      count += mask[index];
      domainCount += domainMask[index];
    }

    const perimeter = getPerimeterIndices(bounds, width).filter(
      (index) => domainMask[index],
    );
    const perimeterCount = perimeter.reduce(
      (sum, index) => sum + mask[index],
      0,
    );
    const coverage = domainCount ? count / domainCount : 0;
    const perimeterCoverage = perimeter.length
      ? perimeterCount / perimeter.length
      : 0;

    return {
      count,
      coverage,
      perimeterCoverage,
      frameRisk: coverage > 0.68 && perimeterCoverage > 0.7,
    };
  }

  function estimateBackground(data, visibleMask, bounds, width) {
    const perimeter = getPerimeterIndices(bounds, width).filter(
      (index) => visibleMask[index],
    );
    const samples = perimeter.map((index) => {
      const dataIndex = index * 4;
      return [data[dataIndex], data[dataIndex + 1], data[dataIndex + 2]];
    });

    if (!samples.length) {
      return {color: [255, 255, 255], spread: 0, threshold: 42};
    }

    const color = [0, 1, 2].map((channel) =>
      percentile(
        samples.map((sample) => sample[channel]),
        0.5,
      ),
    );
    const distances = samples.map((sample) =>
      colorDistance(sample[0], sample[1], sample[2], color),
    );
    const spread = percentile(distances, 0.82);

    return {
      color,
      spread,
      threshold: clamp(spread + 22, 34, 108),
    };
  }

  function otsuThreshold(data, visibleMask) {
    const histogram = new Uint32Array(256);
    let total = 0;
    let sum = 0;

    for (let pixel = 0; pixel < visibleMask.length; pixel += 1) {
      if (!visibleMask[pixel]) continue;
      const index = pixel * 4;
      const luminance = Math.round(
        data[index] * 0.2126 +
          data[index + 1] * 0.7152 +
          data[index + 2] * 0.0722,
      );
      histogram[luminance] += 1;
      total += 1;
      sum += luminance;
    }

    let backgroundWeight = 0;
    let backgroundSum = 0;
    let maximumVariance = -1;
    let threshold = 127;

    for (let value = 0; value < histogram.length; value += 1) {
      backgroundWeight += histogram[value];
      if (!backgroundWeight) continue;
      const foregroundWeight = total - backgroundWeight;
      if (!foregroundWeight) break;
      backgroundSum += value * histogram[value];
      const backgroundMean = backgroundSum / backgroundWeight;
      const foregroundMean = (sum - backgroundSum) / foregroundWeight;
      const variance =
        backgroundWeight *
        foregroundWeight *
        (backgroundMean - foregroundMean) ** 2;
      if (variance > maximumVariance) {
        maximumVariance = variance;
        threshold = value;
      }
    }

    return threshold;
  }

  function chooseColorMask(data, visibleMask, background, width, height) {
    const contrastMask = new Uint8Array(width * height);
    const darkMask = new Uint8Array(width * height);
    const lightMask = new Uint8Array(width * height);
    const threshold = otsuThreshold(data, visibleMask);
    const backgroundLuminance =
      background.color[0] * 0.2126 +
      background.color[1] * 0.7152 +
      background.color[2] * 0.0722;

    for (let pixel = 0; pixel < visibleMask.length; pixel += 1) {
      if (!visibleMask[pixel]) continue;
      const index = pixel * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      if (
        colorDistance(red, green, blue, background.color) >
        background.threshold
      ) {
        contrastMask[pixel] = 1;
      }
      if (luminance <= threshold) darkMask[pixel] = 1;
      else lightMask[pixel] = 1;
    }

    const backgroundIsLight = backgroundLuminance > threshold;
    const polarityMask = backgroundIsLight ? darkMask : lightMask;
    const contrastCount = contrastMask.reduce((sum, value) => sum + value, 0);
    const polarityCount = polarityMask.reduce((sum, value) => sum + value, 0);
    const domainCount = visibleMask.reduce((sum, value) => sum + value, 0);
    const contrastRatio = domainCount ? contrastCount / domainCount : 0;
    const polarityRatio = domainCount ? polarityCount / domainCount : 0;

    if (
      contrastRatio >= MIN_SIGN_RATIO &&
      contrastRatio <= 0.64 &&
      (background.spread <= 48 || contrastRatio <= polarityRatio)
    ) {
      return {mask: contrastMask, method: 'edge-background'};
    }

    if (polarityRatio >= MIN_SIGN_RATIO && polarityRatio <= 0.64) {
      return {
        mask: polarityMask,
        method: backgroundIsLight ? 'dark-on-light' : 'light-on-dark',
      };
    }

    return {mask: contrastMask, method: 'edge-background'};
  }

  function analyze(imageData) {
    const {data, width, height} = imageData || {};
    if (!(data instanceof Uint8ClampedArray) || !width || !height) {
      throw new TypeError('Ожидалось RGBA-изображение с размерами.');
    }

    const visibleMask = new Uint8Array(width * height);
    let hasTransparency = false;
    for (let pixel = 0; pixel < visibleMask.length; pixel += 1) {
      const alpha = data[pixel * 4 + 3];
      if (alpha < 250) hasTransparency = true;
      if (alpha > ALPHA_THRESHOLD) visibleMask[pixel] = 1;
    }

    const bounds = getMaskBounds(visibleMask, width, height);
    if (!bounds) {
      return {
        signMask: visibleMask,
        backgroundMask: new Uint8Array(width * height),
        method: 'empty',
        confidence: 0,
        warning: true,
        alternativesAvailable: false,
        signMetrics: {
          count: 0,
          coverage: 0,
          perimeterCoverage: 0,
          frameRisk: false,
        },
      };
    }

    const boundsArea = bounds.width * bounds.height;
    const alphaBoundsCoverage = bounds.count / boundsArea;
    const alphaPerimeter = getPerimeterIndices(bounds, width);
    const alphaPerimeterCoverage =
      alphaPerimeter.reduce((sum, index) => sum + visibleMask[index], 0) /
      Math.max(1, alphaPerimeter.length);
    const alphaIsStandaloneSign =
      hasTransparency &&
      (alphaBoundsCoverage < 0.72 || alphaPerimeterCoverage < 0.7);
    const background = estimateBackground(data, visibleMask, bounds, width);

    let signMask;
    let method;
    if (alphaIsStandaloneSign) {
      signMask = visibleMask.slice();
      method = 'alpha';
    } else {
      const colorChoice = chooseColorMask(
        data,
        visibleMask,
        background,
        width,
        height,
      );
      signMask = colorChoice.mask;
      method = colorChoice.method;
    }

    let signMetrics = getMaskMetrics(
      signMask,
      visibleMask,
      bounds,
      width,
    );
    const inverseMask = new Uint8Array(width * height);
    for (let index = 0; index < inverseMask.length; index += 1) {
      if (visibleMask[index] && !signMask[index]) inverseMask[index] = 1;
    }
    let backgroundMetrics = getMaskMetrics(
      inverseMask,
      visibleMask,
      bounds,
      width,
    );

    if (
      !alphaIsStandaloneSign &&
      signMetrics.frameRisk &&
      !backgroundMetrics.frameRisk
    ) {
      const previousSign = signMask;
      signMask = inverseMask;
      for (let index = 0; index < inverseMask.length; index += 1) {
        inverseMask[index] = previousSign[index];
      }
      const previousMetrics = signMetrics;
      signMetrics = backgroundMetrics;
      backgroundMetrics = previousMetrics;
      method = `${method}-inverted`;
    }

    if (alphaIsStandaloneSign) signMetrics.frameRisk = false;

    const alternativesAvailable =
      signMetrics.count > 0 && backgroundMetrics.count > 0;
    let confidence = alphaIsStandaloneSign
      ? 0.96
      : clamp(
          0.9 - background.spread / 180 - signMetrics.perimeterCoverage * 0.2,
          0.45,
          0.94,
        );
    const warning =
      signMetrics.count === 0 ||
      signMetrics.coverage < MIN_SIGN_RATIO ||
      signMetrics.frameRisk ||
      confidence < 0.62;
    if (warning) confidence = Math.min(confidence, 0.6);

    return {
      signMask,
      backgroundMask: inverseMask,
      method,
      confidence,
      warning,
      alternativesAvailable,
      backgroundColor: background.color,
      backgroundSpread: background.spread,
      signMetrics,
      backgroundMetrics,
    };
  }

  function toBinaryImageData(mask, width, height) {
    if (!(mask instanceof Uint8Array) || mask.length !== width * height) {
      throw new TypeError('Размер маски не совпадает с изображением.');
    }
    const data = new Uint8ClampedArray(width * height * 4);
    for (let pixel = 0; pixel < mask.length; pixel += 1) {
      const value = mask[pixel] ? 0 : 255;
      const index = pixel * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
    return {data, width, height};
  }

  window.RibbonStudioTraceMask = Object.freeze({analyze, toBinaryImageData});
})();
