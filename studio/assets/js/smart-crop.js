(() => {
  const ANALYSIS_MAX_SIDE = 360;
  const MIN_COMPONENT_RATIO = 0.0003;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function percentile(values, ratio) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
  }

  function colorDistance(r, g, b, background) {
    return Math.hypot(
      r - background[0],
      g - background[1],
      b - background[2],
    );
  }

  function createAnalysisCanvas(image) {
    const scale = Math.min(
      1,
      ANALYSIS_MAX_SIDE / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height),
    );
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, width, height);
    return { canvas, context, width, height };
  }

  function getBorderStats(imageData, width, height) {
    const border = Math.max(1, Math.round(Math.min(width, height) * 0.04));
    const samples = [];
    const step = Math.max(1, Math.floor(Math.min(width, height) / 100));

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (
          x >= border &&
          x < width - border &&
          y >= border &&
          y < height - border
        ) {
          continue;
        }
        const index = (y * width + x) * 4;
        if (imageData[index + 3] < 32) continue;
        samples.push([
          imageData[index],
          imageData[index + 1],
          imageData[index + 2],
        ]);
      }
    }

    if (!samples.length) {
      return { color: [255, 255, 255], spread: 0, threshold: 36 };
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
    const spread = percentile(distances, 0.8);

    return {
      color,
      spread,
      threshold: clamp(spread + 22, 34, 108),
    };
  }

  function getComponents(mask, width, height) {
    const visited = new Uint8Array(mask.length);
    const queue = new Int32Array(mask.length);
    const components = [];

    for (let start = 0; start < mask.length; start += 1) {
      if (!mask[start] || visited[start]) continue;

      let head = 0;
      let tail = 1;
      queue[0] = start;
      visited[start] = 1;
      let area = 0;
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;

      while (head < tail) {
        const index = queue[head];
        head += 1;
        const x = index % width;
        const y = Math.floor(index / width);
        area += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        const neighbours = [index - 1, index + 1, index - width, index + width];
        for (const neighbour of neighbours) {
          if (neighbour < 0 || neighbour >= mask.length) continue;
          const neighbourX = neighbour % width;
          if (Math.abs(neighbourX - x) > 1) continue;
          if (!mask[neighbour] || visited[neighbour]) continue;
          visited[neighbour] = 1;
          queue[tail] = neighbour;
          tail += 1;
        }
      }

      components.push({ area, minX, minY, maxX, maxY });
    }

    return components.sort((a, b) => b.area - a.area);
  }

  function expandBounds(bounds, padding, width, height) {
    const padX = Math.max(3, bounds.width * padding);
    const padY = Math.max(3, bounds.height * padding);
    const left = clamp(bounds.x - padX, 0, width);
    const top = clamp(bounds.y - padY, 0, height);
    const right = clamp(bounds.x + bounds.width + padX, 0, width);
    const bottom = clamp(bounds.y + bounds.height + padY, 0, height);

    return {
      x: left / width,
      y: top / height,
      width: (right - left) / width,
      height: (bottom - top) / height,
    };
  }

  function suggestForeground(imageData, width, height) {
    const total = width * height;
    const stats = getBorderStats(imageData, width, height);
    const mask = new Uint8Array(total);
    let transparentPixels = 0;

    for (let index = 0; index < total; index += 1) {
      if (imageData[index * 4 + 3] < 245) transparentPixels += 1;
    }

    const hasTransparency = transparentPixels / total > 0.01;
    let foregroundPixels = 0;
    for (let index = 0; index < total; index += 1) {
      const dataIndex = index * 4;
      const alpha = imageData[dataIndex + 3];
      const foreground = hasTransparency
        ? alpha > 40
        : colorDistance(
            imageData[dataIndex],
            imageData[dataIndex + 1],
            imageData[dataIndex + 2],
            stats.color,
          ) > stats.threshold;
      if (!foreground) continue;
      mask[index] = 1;
      foregroundPixels += 1;
    }

    const coverage = foregroundPixels / total;
    if (coverage < 0.0015 || coverage > 0.78) return null;
    if (!hasTransparency && stats.spread > 62) return null;

    const components = getComponents(mask, width, height);
    if (!components.length) return null;
    const minimumArea = Math.max(
      2,
      total * MIN_COMPONENT_RATIO,
      components[0].area * 0.006,
    );
    const selected = components
      .filter((component) => component.area >= minimumArea)
      .slice(0, 80);
    if (!selected.length) return null;

    const minX = Math.min(...selected.map((component) => component.minX));
    const minY = Math.min(...selected.map((component) => component.minY));
    const maxX = Math.max(...selected.map((component) => component.maxX));
    const maxY = Math.max(...selected.map((component) => component.maxY));
    const boxArea = ((maxX - minX + 1) * (maxY - minY + 1)) / total;
    if (boxArea > 0.92) return null;

    const confidence = clamp(
      0.58 +
        (hasTransparency ? 0.2 : Math.max(0, 0.16 - stats.spread / 400)) +
        Math.min(0.12, coverage * 0.4) -
        Math.max(0, boxArea - 0.72),
      0,
      0.96,
    );

    return {
      bounds: expandBounds(
        { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
        0.1,
        width,
        height,
      ),
      confidence,
      method: hasTransparency ? 'transparency' : 'foreground',
    };
  }

  async function suggestFaces(canvas, width, height) {
    if (typeof globalThis.FaceDetector !== 'function') return null;

    try {
      const detector = new globalThis.FaceDetector({
        fastMode: true,
        maxDetectedFaces: 8,
      });
      const faces = await detector.detect(canvas);
      if (!faces.length) return null;
      const boxes = faces.map((face) => face.boundingBox).filter(Boolean);
      if (!boxes.length) return null;
      const minX = Math.min(...boxes.map((box) => box.x));
      const minY = Math.min(...boxes.map((box) => box.y));
      const maxX = Math.max(...boxes.map((box) => box.x + box.width));
      const maxY = Math.max(...boxes.map((box) => box.y + box.height));

      return {
        bounds: expandBounds(
          { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
          0.55,
          width,
          height,
        ),
        confidence: 0.94,
        method: faces.length > 1 ? 'faces' : 'face',
      };
    } catch {
      return null;
    }
  }

  function suggestSaliency(imageData, width, height) {
    const columns = 18;
    const rows = Math.max(10, Math.round((height / width) * columns));
    const scores = new Float32Array(columns * rows);
    const counts = new Uint16Array(columns * rows);
    const luminance = new Float32Array(width * height);

    for (let index = 0; index < width * height; index += 1) {
      const dataIndex = index * 4;
      luminance[index] =
        imageData[dataIndex] * 0.2126 +
        imageData[dataIndex + 1] * 0.7152 +
        imageData[dataIndex + 2] * 0.0722;
    }

    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const index = y * width + x;
        const dataIndex = index * 4;
        const gradient =
          Math.abs(luminance[index + 1] - luminance[index - 1]) +
          Math.abs(luminance[index + width] - luminance[index - width]);
        const maximum = Math.max(
          imageData[dataIndex],
          imageData[dataIndex + 1],
          imageData[dataIndex + 2],
        );
        const minimum = Math.min(
          imageData[dataIndex],
          imageData[dataIndex + 1],
          imageData[dataIndex + 2],
        );
        const saturation = maximum - minimum;
        const column = Math.min(columns - 1, Math.floor((x / width) * columns));
        const row = Math.min(rows - 1, Math.floor((y / height) * rows));
        const cell = row * columns + column;
        scores[cell] += gradient + saturation * 0.12;
        counts[cell] += 1;
      }
    }

    const averages = Array.from(scores, (score, index) =>
      counts[index] ? score / counts[index] : 0,
    );
    const threshold = percentile(averages, 0.72);
    if (threshold < 8) return null;
    const active = new Uint8Array(averages.length);
    averages.forEach((score, index) => {
      if (score >= threshold) active[index] = 1;
    });

    const components = getComponents(active, columns, rows);
    if (!components.length) return null;
    let best = null;
    let activeScore = 0;
    averages.forEach((score, index) => {
      if (active[index]) activeScore += score;
    });

    for (const component of components) {
      let componentScore = 0;
      for (let y = component.minY; y <= component.maxY; y += 1) {
        for (let x = component.minX; x <= component.maxX; x += 1) {
          const index = y * columns + x;
          if (active[index]) componentScore += averages[index];
        }
      }
      const centerX = (component.minX + component.maxX + 1) / 2 / columns;
      const centerY = (component.minY + component.maxY + 1) / 2 / rows;
      const centrality = 1 - Math.min(0.45, Math.hypot(centerX - 0.5, centerY - 0.5) * 0.55);
      const rank = componentScore * centrality;
      if (!best || rank > best.rank) best = { ...component, componentScore, rank };
    }

    if (!best || !activeScore) return null;
    const dominance = best.componentScore / activeScore;
    const boxRatio =
      ((best.maxX - best.minX + 1) * (best.maxY - best.minY + 1)) /
      (columns * rows);
    const confidence = clamp(0.34 + dominance * 0.6 + (1 - boxRatio) * 0.12, 0, 0.82);
    if (confidence < 0.5 || boxRatio > 0.86) return null;

    const cellWidth = width / columns;
    const cellHeight = height / rows;
    return {
      bounds: expandBounds(
        {
          x: best.minX * cellWidth,
          y: best.minY * cellHeight,
          width: (best.maxX - best.minX + 1) * cellWidth,
          height: (best.maxY - best.minY + 1) * cellHeight,
        },
        0.22,
        width,
        height,
      ),
      confidence,
      method: 'saliency',
    };
  }

  async function suggest(image) {
    if (!image?.width || !image?.height) {
      return { bounds: null, confidence: 0, method: 'manual' };
    }

    const { canvas, context, width, height } = createAnalysisCanvas(image);
    const imageData = context.getImageData(0, 0, width, height).data;
    const stats = getBorderStats(imageData, width, height);

    if (stats.spread > 42) {
      const faces = await suggestFaces(canvas, width, height);
      if (faces) return faces;
    }

    const foreground = suggestForeground(imageData, width, height);
    if (foreground?.confidence >= 0.56) return foreground;

    const faces = await suggestFaces(canvas, width, height);
    if (faces) return faces;

    const saliency = suggestSaliency(imageData, width, height);
    if (saliency) return saliency;

    return {
      bounds: foreground?.bounds || null,
      confidence: foreground?.confidence || 0,
      method: foreground?.method || 'manual',
    };
  }

  window.RibbonStudioSmartCrop = Object.freeze({ suggest });
})();
