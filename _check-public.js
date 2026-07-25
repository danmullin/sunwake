/**
 * Fail if Mist Listen private chrome leaked into the public twin.
 * Run before every push / in CI: node _check-public.js
 */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const files = ["index.html", "listen.js", "listen.css", "README.md"];

/** Strings that must never appear on the public site */
const FORBIDDEN = [
  "Mist —",
  "how mist hears",
  "Listen with me",
  "Listen together",
  "us-pill",
  "us-heart",
  "<h1>MIST</h1>",
  "Synthwave Soul",
  "Mist takes",
  "data-track=\"soul\"",
  "data-track=\"mist\"",
  "Mist_Synthwave_Soul",
  "audio/Mist.mp3",
  "waiting for you",
  "still glowing",
  "paused in the fog",
];

/** Public twin must still look like Sunwake */
const REQUIRED = [
  { file: "index.html", needle: "<title>Sunwake</title>" },
  { file: "index.html", needle: "<h1>SUNWAKE</h1>" },
];

let failed = false;

for (const file of files) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.error("MISSING:", file);
    failed = true;
    continue;
  }
  const text = fs.readFileSync(full, "utf8");
  for (const needle of FORBIDDEN) {
    if (text.includes(needle)) {
      console.error(`LEAK in ${file}: ${JSON.stringify(needle)}`);
      failed = true;
    }
  }
}

for (const { file, needle } of REQUIRED) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (!text.includes(needle)) {
    console.error(`MISSING brand in ${file}: ${JSON.stringify(needle)}`);
    failed = true;
  }
}

if (failed) {
  console.error("\nPublic guard failed — do NOT push. Fix branding before deploy.");
  process.exit(1);
}

console.log("Public guard OK — Sunwake chrome clean.");
