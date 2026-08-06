(() => {
  const scriptUrl = document.currentScript?.src || window.location.href;
  const workerUrl = new URL('./trace-worker.js', scriptUrl);
  const pendingJobs = new Map();
  let worker = null;
  let nextJobId = 1;

  function rejectPendingJobs(error) {
    pendingJobs.forEach(({ reject, timeoutId }) => {
      window.clearTimeout(timeoutId);
      reject(error);
    });
    pendingJobs.clear();
  }

  function createWorker() {
    if (worker) return worker;

    worker = new Worker(workerUrl);
    worker.addEventListener('message', (event) => {
      const { jobId, result, error } = event.data || {};
      const pending = pendingJobs.get(jobId);
      if (!pending) return;

      window.clearTimeout(pending.timeoutId);
      pendingJobs.delete(jobId);
      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
    });
    worker.addEventListener('error', () => {
      rejectPendingJobs(new Error('Модуль трассировки остановлен.'));
      worker?.terminate();
      worker = null;
    });

    return worker;
  }

  function traceBinaryImage(
    imageData,
    { preset = 'faithful', timeoutMs = 20000 } = {},
  ) {
    if (!(imageData?.data instanceof Uint8ClampedArray)) {
      return Promise.reject(new TypeError('Ожидался RGBA-массив изображения.'));
    }
    if (!imageData.width || !imageData.height) {
      return Promise.reject(new TypeError('Не указан размер изображения.'));
    }

    const jobId = nextJobId;
    nextJobId += 1;
    const pixels = imageData.data.slice().buffer;

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        pendingJobs.delete(jobId);
        reject(new Error('Трассировка заняла слишком много времени.'));
      }, timeoutMs);
      pendingJobs.set(jobId, { resolve, reject, timeoutId });

      try {
        createWorker().postMessage(
          {
            jobId,
            pixels,
            width: imageData.width,
            height: imageData.height,
            preset,
          },
          [pixels],
        );
      } catch (error) {
        window.clearTimeout(timeoutId);
        pendingJobs.delete(jobId);
        reject(error);
      }
    });
  }

  window.RibbonStudioTrace = Object.freeze({
    engine: 'imagetracerjs',
    engineVersion: '1.2.6',
    traceBinaryImage,
  });
})();
