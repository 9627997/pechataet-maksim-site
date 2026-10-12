(() => {
  const read = (key) => {
    try {
      return JSON.parse(window.localStorage.getItem(key) || '{}');
    } catch {
      return {};
    }
  };

  const write = (key, value) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };

  const remove = (key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // A blocked or full storage must not prevent a clean Studio reset.
    }
  };

  window.RibbonStudioStorage = Object.freeze({read, write, remove});
})();
