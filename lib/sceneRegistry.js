/** Late-bound scene map — avoids circular imports (app → scenes → runtime → scenes). */

/** @type {Record<string, import('./scenes/base.js').VizScene> | null} */
let scenes = null;

/** @param {Record<string, import('./scenes/base.js').VizScene>} map */
export function registerScenes(map) {
  scenes = map;
}

/** @param {string} mode */
export function getScene(mode) {
  if (!scenes) return null;
  return scenes[mode] || scenes.nightDrive || null;
}
