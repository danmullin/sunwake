/**
 * Sunwake — entry.
 * Implementation lives under ./lib (OOP services + scenes + runtime engine).
 */
import { SunwakeApp } from "./lib/app.js";

const app = new SunwakeApp();
app.start();

export { app, SunwakeApp };
