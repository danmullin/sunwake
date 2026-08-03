import { seedWorld } from "./runtime.js";

/** Shared particle world seed + atmosphere draw (runtime-backed). */
export class ParticleSystem {
  seed() {
    seedWorld();
  }
}

export { seedWorld } from "./runtime.js";
