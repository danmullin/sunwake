import { PERF, updatePerf as _updatePerf, sparkCap as _sparkCap } from "./runtime.js";

/** Performance knobs + frame dt EMA. */
export class PerfMonitor {
  get state() {
    return PERF;
  }
  update(now) {
    _updatePerf(now);
  }
  sparkCap() {
    return _sparkCap();
  }
}

export { PERF, updatePerf, sparkCap } from "./runtime.js";
