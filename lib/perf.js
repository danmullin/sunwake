/** Performance knobs + EMA frame-time tracker. */

export const PERF = {
  emaDt: 16.7,
  lastNow: 0,
  meterAcc: 0,
  dprCap: 1.5,
  sparkMax: 320,
  gridStep: 12,
  vertSamples: 30,
  cellEdge: 5,
};

/** Update EMA frame time from the RAF timestamp. */
export function updatePerf(now) {
  const raw = PERF.lastNow ? now - PERF.lastNow : 16.7;
  PERF.lastNow = now;
  const dt = raw > 0 && raw < 80 ? raw : 16.7;
  PERF.emaDt = PERF.emaDt * 0.9 + dt * 0.1;
}

/** Current spark particle cap. */
export function sparkCap() {
  return PERF.sparkMax;
}

/** OOP wrapper — kept for SunwakeApp.perf compatibility. */
export class PerfMonitor {
  get state() { return PERF; }
  update(now) { updatePerf(now); }
  sparkCap() { return sparkCap(); }
}
