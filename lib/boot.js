/**
 * Boot — thin re-export of startRuntime from runtime.js while the full
 * migration of resize/seedWorld wiring is completed incrementally.
 * app.js imports startRuntime from here; runtime.js remains the implementation.
 */
export { startRuntime } from "./runtime.js";
