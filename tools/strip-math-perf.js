/**
 * Remove math/perf definitions from runtime.js and inject imports.
 * Run: node tools/strip-math-perf.js
 */
const fs = require("fs");
const path = require("path");

const runtimePath = path.join(__dirname, "../lib/runtime.js");
let src = fs.readFileSync(runtimePath, "utf8");
const lines = src.split("\n");
console.log("Original lines:", lines.length);

// Sections to remove (0-based inclusive line indices):
// PERF obj + updatePerf + sparkCap: 130-152
// swapRemove + trailing blank: 153-159
// SW_RAINBOW + synthRainbow: 446-469
// ecgShape + trailing blank: 597-607
// bandEnergy: 1257-1265
// smooth + trailing blank: 1266-1269
// midCentroid + trailing blank: 1572-1587

const skip = new Set();
const addRange = (a, b) => { for (let i = a; i <= b; i++) skip.add(i); };

addRange(130, 152); // PERF block
addRange(153, 159); // swapRemove + blank
addRange(446, 469); // SW_RAINBOW + synthRainbow
addRange(597, 607); // ecgShape + blank
addRange(1257, 1265); // bandEnergy
addRange(1266, 1269); // smooth + blank
addRange(1572, 1587); // midCentroid + blank

// Inject two import lines right after the existing sceneRegistry import (line index 5)
// so they appear on lines 7 and 8
const perfImport = 'import { PERF, updatePerf, sparkCap } from "./perf.js";';
const mathImport = 'import { SW_RAINBOW, synthRainbow, swapRemove, ecgShape, bandEnergy, smooth, midCentroid } from "./math.js";';

const newLines = [];
for (let i = 0; i < lines.length; i++) {
  if (skip.has(i)) continue;
  newLines.push(lines[i]);
  if (i === 5) {
    newLines.push(perfImport);
    newLines.push(mathImport);
  }
}

fs.writeFileSync(runtimePath, newLines.join("\n"), "utf8");
console.log("New lines:", newLines.length, "(removed", lines.length - newLines.length + 2, "definition lines)");
