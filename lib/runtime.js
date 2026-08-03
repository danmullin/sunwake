/**
 * @deprecated — runtime monolith retired. Use boot.js / state.js / feature modules.
 * Kept as a compatibility shim so old imports keep resolving briefly.
 */
export { startRuntime, resize } from "./boot.js";
export { seedWorld } from "./particles.js";
export { updateFx } from "./simulation.js";
export { frame } from "./renderer.js";
export { vizMode, VIZ_MODES, FX, FX_TOGGLES, levels, canvas, ctx, W, H } from "./state.js";
