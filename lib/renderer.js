import { frame, resize, PERF } from "./runtime.js";

/** RAF owner — delegates to runtime frame (scene dispatch lives there today). */
export class Renderer {
  /** @param {import('./app.js').SunwakeApp} app */
  constructor(app) {
    this.app = app;
    this._raf = 0;
  }
  resize() {
    resize();
  }
  /** Kick the shared runtime loop (idempotent with runtime's own rAF). */
  start() {
    // runtime startRuntime already schedules rAF; this exists for API completeness
    if (!this._raf) {
      // frame self-reschedules; calling once is enough if runtime hasn't
      this._raf = 1;
    }
  }
  get perf() {
    return PERF;
  }
}

export { frame, resize } from "./runtime.js";
