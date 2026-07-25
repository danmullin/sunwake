/**
 * Stamp date + short git SHA into version.json.
 * Codename is hand-edited when a chapter starts (currently: Quasar).
 *
 * Local:  node _stamp-version.js
 * CI:     runs before Pages stage (GITHUB_SHA)
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const file = path.join(__dirname, "version.json");
const version = JSON.parse(fs.readFileSync(file, "utf8"));

version.name = version.name || "Sunwake";
version.codename = version.codename || "Quasar";

const fullSha =
  process.env.GITHUB_SHA ||
  execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
version.sha = String(fullSha).slice(0, 7);

const iso = new Date().toISOString().slice(0, 10);
version.date = iso;

fs.writeFileSync(file, `${JSON.stringify(version, null, 2)}\n`);
console.log(
  `Stamped ${version.name} “${version.codename}” — ${version.date} · ${version.sha}`,
);
