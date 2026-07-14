
import { state } from '../shared/state.js';

export function calculatePrice() {
  const ribbonBase = {10: 390, 25: 590, 50: 790, 100: 1090, 200: 1590}[state.meters] || 1090;
  const widthExtra = state.width === 20 ? 180 : 0;
  const stickerBase = state.bundle === 'bundle'
    ? ({50: 450, 100: 700, 250: 1350, 500: 2200}[state.stickerQty] || 700)
    : 0;

  return ribbonBase + widthExtra + stickerBase;
}
