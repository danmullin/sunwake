import {
  ensureGraph,
  start,
  toggle,
  restart,
  loadFile,
  startSystemListen,
  stopSystemListen,
  playing,
  started,
  sourceMode,
  levels,
} from "./runtime.js";

/** Web Audio graph, file + system capture, level meters. */
export class AudioEngine {
  get levels() {
    return levels;
  }
  get playing() {
    return playing;
  }
  get started() {
    return started;
  }
  get sourceMode() {
    return sourceMode;
  }
  ensureGraph() {
    return ensureGraph();
  }
  start() {
    return start();
  }
  toggle() {
    return toggle();
  }
  restart() {
    return restart();
  }
  loadFile(file) {
    return loadFile(file);
  }
  startSystemListen(e) {
    return startSystemListen(e);
  }
  stopSystemListen() {
    return stopSystemListen();
  }
}

export {
  ensureGraph,
  start,
  toggle,
  restart,
  loadFile,
  startSystemListen,
  stopSystemListen,
  playing,
  started,
  sourceMode,
  levels,
} from "./runtime.js";
