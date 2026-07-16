(() => {
  const panel = document.querySelector('.mobile-products-panel');

  if (!panel) return;

  const switches = [...panel.querySelectorAll('[data-mobile-product]')];
  const samples = [...panel.querySelectorAll('[data-mobile-product-sample]')];

  const syncSamples = () => {
    switches.forEach((productSwitch) => {
      const sample = samples.find(
        (item) =>
          item.dataset.mobileProductSample === productSwitch.dataset.mobileProduct,
      );

      if (sample) sample.hidden = !productSwitch.checked;
    });
  };

  switches.forEach((productSwitch) => {
    productSwitch.addEventListener('change', () => {
      if (!switches.some((item) => item.checked)) {
        const otherSwitch = switches.find((item) => item !== productSwitch);
        if (otherSwitch) otherSwitch.checked = true;
      }

      syncSamples();
    });
  });

  syncSamples();
})();
