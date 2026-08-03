/** Pure math helpers — no DOM, no state, no side-effects. */

/** Synthwave palette — night-drive colours (no lime/green). */
export const SW_RAINBOW = [
  [130, 70, 200],  // violet
  [255, 110, 168], // hot pink
  [255, 150, 115], // coral
  [240, 197, 106], // gold
  [69, 224, 255],  // cyan
  [95, 155, 255],  // electric blue
];

/**
 * Interpolate across the synthwave rainbow.
 * @param {number} t  0..1 position in the palette
 * @param {number} alpha  CSS alpha
 */
export function synthRainbow(t, alpha) {
  const n = SW_RAINBOW.length;
  const x = ((t % 1) + 1) % 1;
  const f = x * n;
  const i = Math.floor(f) % n;
  const j = (i + 1) % n;
  const u = f - Math.floor(f);
  const a = SW_RAINBOW[i];
  const b = SW_RAINBOW[j];
  const r = (a[0] + (b[0] - a[0]) * u) | 0;
  const g = (a[1] + (b[1] - a[1]) * u) | 0;
  const bl = (a[2] + (b[2] - a[2]) * u) | 0;
  return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
}

/**
 * Swap-remove: O(1) delete from unsorted array.
 * @param {any[]} arr
 * @param {number} i
 */
export function swapRemove(arr, i) {
  const last = arr.length - 1;
  if (i !== last) arr[i] = arr[last];
  arr.pop();
}

/**
 * Classic ECG waveform shape — PQRST Gaussian decomposition.
 * t ∈ [0, 1] spans one heartbeat.
 */
export function ecgShape(t) {
  const x = t * 14;
  const p = Math.exp(-Math.pow((x + 3.4) / 0.55, 2)) * 0.22;
  const q = -Math.exp(-Math.pow((x + 0.55) / 0.28, 2)) * 0.32;
  const r = Math.exp(-Math.pow(x / 0.2, 2));
  const s = -Math.exp(-Math.pow((x - 0.48) / 0.28, 2)) * 0.42;
  const tw = Math.exp(-Math.pow((x - 2.9) / 0.95, 2)) * 0.38;
  return p + q + r + s + tw;
}

/**
 * Average energy in a frequency band of a Uint8 FFT array, normalised 0..1.
 * @param {Uint8Array} data
 * @param {number} from  bin index (float ok)
 * @param {number} to    bin index (float ok)
 */
export function bandEnergy(data, from, to) {
  let sum = 0;
  const a = Math.max(0, Math.floor(from));
  const b = Math.min(data.length - 1, Math.ceil(to));
  if (b <= a) return 0;
  for (let i = a; i <= b; i++) sum += data[i];
  return sum / ((b - a + 1) * 255);
}

/**
 * Exponential move-toward — standard EMA one-pole filter.
 * @param {number} prev  current value
 * @param {number} next  target value
 * @param {number} amount  blend weight 0..1 (1 = snap)
 */
export function smooth(prev, next, amount) {
  return prev + (next - prev) * amount;
}

/**
 * Spectral centroid of the mid band (6 %–38 % of bins), normalised 0..1.
 * Returns 0.5 when there's no signal.
 * @param {Uint8Array} data  FFT frequency data
 */
export function midCentroid(data) {
  if (!data || !data.length) return 0.5;
  const n = data.length;
  const a = Math.max(1, Math.floor(n * 0.06));
  const b = Math.min(n - 1, Math.floor(n * 0.38));
  let sum = 0;
  let w = 0;
  for (let i = a; i <= b; i++) {
    const v = data[i];
    sum += i * v;
    w += v;
  }
  if (w < 8) return 0.5;
  return Math.min(1, Math.max(0, (sum / w - a) / (b - a)));
}
