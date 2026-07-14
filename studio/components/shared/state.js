
export const state = {
  panel: 'upload',
  width: 15,
  ribbon: '#f3eadc',
  print: '#171717',
  logo: null,
  logoType: null,
  logoScale: 1,
  logoOffsetX: 0,
  text: 'печатаетмаксим',
  font: 'Manrope',
  fontSize: 32,
  repeatMm: 100,
  bundle: 'bundle',
  stickerSize: 40,
  stickerBg: '#ffffff',
  meters: 100,
  stickerQty: 100
};

export function saveState() {
  const copy = {...state, logo: null};
  localStorage.setItem('ribbon-studio-v03', JSON.stringify(copy));
}

export function restoreState() {
  try {
    Object.assign(state, JSON.parse(localStorage.getItem('ribbon-studio-v03') || '{}'));
  } catch {}
}
