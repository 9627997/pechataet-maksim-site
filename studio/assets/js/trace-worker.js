/* global importScripts */

importScripts('../vendor/imagetracer/imagetracer_v1.2.6.js');

const TRACE_PRESETS = {
  faithful: {
    ltres: 1,
    qtres: 1,
    pathomit: 4,
    colorsampling: 0,
    colorquantcycles: 1,
    linefilter: true,
    roundcoords: 2,
    strokewidth: 0,
    pal: [
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 255, g: 255, b: 255, a: 0 },
    ],
  },
  clean: {
    ltres: 1.5,
    qtres: 1.5,
    pathomit: 12,
    colorsampling: 0,
    colorquantcycles: 1,
    linefilter: true,
    roundcoords: 2,
    strokewidth: 0,
    pal: [
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 255, g: 255, b: 255, a: 0 },
    ],
  },
};

self.addEventListener('message', (event) => {
  const { jobId, pixels, width, height, preset = 'faithful' } =
    event.data || {};

  try {
    const options = TRACE_PRESETS[preset] || TRACE_PRESETS.faithful;
    const startedAt = performance.now();
    const tracedSource = self.ImageTracer.imagedataToSVG(
      {
        data: new Uint8ClampedArray(pixels),
        width,
        height,
      },
      options,
    );
    const svgSource = tracedSource.includes('viewBox=')
      ? tracedSource
      : tracedSource.replace(
          '<svg ',
          `<svg viewBox="0 0 ${width} ${height}" `,
        );
    const durationMs = performance.now() - startedAt;

    self.postMessage({
      jobId,
      result: {
        svgSource,
        engine: 'imagetracerjs',
        engineVersion: '1.2.6',
        preset,
        durationMs,
      },
    });
  } catch (error) {
    self.postMessage({
      jobId,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка.',
    });
  }
});
