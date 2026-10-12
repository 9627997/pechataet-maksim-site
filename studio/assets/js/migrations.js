(() => {
  const validProducts = new Set(['ribbon', 'sticker']);
  const validModes = new Set(['auto', 'manual']);

  const normalizePersistedState = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    const restored = {...value};
    restored.activeContentProduct = validProducts.has(restored.activeContentProduct)
      ? restored.activeContentProduct
      : 'ribbon';
    restored.activeSettingsProduct = validProducts.has(restored.activeSettingsProduct)
      ? restored.activeSettingsProduct
      : 'ribbon';
    restored.repeatMode = validModes.has(restored.repeatMode)
      ? restored.repeatMode
      : 'auto';
    restored.productFirstMode = restored.productFirstMode === true;

    return restored;
  };

  window.RibbonStudioMigrations = Object.freeze({normalizePersistedState});
})();
