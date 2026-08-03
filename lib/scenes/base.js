/** Base visualizer scene. */
export class VizScene {
  /** @param {import('../app.js').SunwakeApp} app */
  constructor(app) {
    this.app = app;
  }
  onEnter(_prev) {}
  onExit(_next) {}
  onResize(_w, _h) {}
  /** @param {number} now @param {number} dt @param {object} levels @param {object} fx */
  update(_now, _dt, _levels, _fx) {}
  /** @param {number} now @param {object} levels @param {object} fx */
  draw(_now, _levels, _fx) {}
}
