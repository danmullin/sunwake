import { FX } from "./state.js";

/** Mutable per-frame FX energy / clocks. */
export class FxRuntime {
  get state() { return FX; }
}

export { FX } from "./state.js";
