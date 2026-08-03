/**
 * Fix remaining compound assignments to imported state primitives.
 */
const fs = require("fs");
const path = require("path");
const runtimePath = path.join(__dirname, "../lib/runtime.js");
let src = fs.readFileSync(runtimePath, "utf8");

// raf: `if (!raf) raf = requestAnimationFrame(frame);`
src = src.replace(/if \(!raf\) raf = requestAnimationFrame\(frame\);/g,
  "if (!raf) setRaf(requestAnimationFrame(frame));");

// stormFlash *= 0.82
src = src.replace(/stormFlash \*= 0\.82;/g,
  "setStormFlash(stormFlash * 0.82);");

fs.writeFileSync(runtimePath, src, "utf8");
console.log("Done");
