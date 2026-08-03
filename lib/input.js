import { onKey, onDragOver, onDragLeave, onDrop } from "./runtime.js";

/** Keyboard + drag/drop bindings (wired inside startRuntime; class exposes handlers). */
export class InputBindings {
  onKey(e) {
    onKey(e);
  }
  onDragOver(e) {
    onDragOver(e);
  }
  onDragLeave(e) {
    onDragLeave(e);
  }
  onDrop(e) {
    onDrop(e);
  }
}

export { onKey, onDragOver, onDragLeave, onDrop } from "./runtime.js";
