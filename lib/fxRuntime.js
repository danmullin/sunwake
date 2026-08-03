import { FX } from "./runtime.js";

/** Mutable per-frame FX energy / clocks. */
export class FxRuntime {
  get state() {
    return FX;
  }
}

export { FX } from "./runtime.js";
