import { DomRefs } from "./dom.js";
import { PerfMonitor } from "./perf.js";
import { FxConfig } from "./fxConfig.js";
import { FxRuntime } from "./fxRuntime.js";
import { VizModeController } from "./vizMode.js";
import { SunModel } from "./sun.js";
import { Camera } from "./camera.js";
import { AudioEngine } from "./audio.js";
import { ChromeUi } from "./ui.js";
import { InputBindings } from "./input.js";
import { ParticleSystem } from "./particles.js";
import { Simulation } from "./simulation.js";
import { Renderer } from "./renderer.js";
import { NightDriveScene } from "./scenes/nightDrive.js";
import { RainDriveScene } from "./scenes/rainDrive.js";
import { SkylineScene } from "./scenes/skyline.js";
import { TunnelScene } from "./scenes/tunnel.js";
import { ArcadeScene } from "./scenes/arcade.js";
import { registerScenes } from "./sceneRegistry.js";
import { startRuntime } from "./boot.js";
import { vizMode } from "./state.js";

/**
 * Sunwake application composer — OOP surface over the runtime engine.
 */
export class SunwakeApp {
  constructor() {
    this.dom = new DomRefs();
    this.perf = new PerfMonitor();
    this.fxConfig = new FxConfig();
    this.fxRuntime = new FxRuntime();
    this.vizMode = new VizModeController();
    this.sun = new SunModel();
    this.camera = new Camera();
    this.audio = new AudioEngine();
    this.ui = new ChromeUi();
    this.input = new InputBindings();
    this.particles = new ParticleSystem();
    this.simulation = new Simulation();
    this.renderer = new Renderer(this);
    this.scenes = {
      nightDrive: new NightDriveScene(this),
      rainDrive: new RainDriveScene(this),
      skyline: new SkylineScene(this),
      tunnel: new TunnelScene(this),
      arcade: new ArcadeScene(this),
    };
  }

  /** Active scene instance for the current viz mode. */
  get scene() {
    return this.scenes[vizMode] || this.scenes.nightDrive;
  }

  /** Register scenes, wire DOM, seed world, start the render loop. */
  start() {
    registerScenes(this.scenes);
    startRuntime();
    this.scenes[vizMode]?.onEnter?.(null);
    this.renderer.start();
    return this;
  }
}
