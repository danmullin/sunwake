# Sunwake

Synthwave audio visualizer — a night-drive sea of light that reacts to your music, a stormy **Rain Drive** cousin, plus a classic side-view **Skyline** highway strip.

**Live:** https://danmullin.github.io/sunwake/

## Scenes (web)

| Mode | Feel |
|------|------|
| **Night Drive** (default) | Perspective grid sea, camera sway, full Effects panel |
| **Rain Drive** | Same highway in a storm — cloudy overcast, wet asphalt, denser rain, lightning bolts on drums |
| **Skyline** | Flat side-view skyline + highway strip (parallax buildings, lane dashes) |

Pick on the gate before you listen, or cycle from the chrome button while playing. Preference is saved in the browser. Skyline is web-first; mobile bake comes later when it feels ready.

## Run

```powershell
cd projects/sunwake
python -m http.server 8765
```

Open http://127.0.0.1:8765/

Or open `index.html` via any static file server (modules need HTTP, not `file://`).

## Listen

1. Choose **Night Drive**, **Rain Drive**, or **Skyline**
2. **Open a song** — pick a local audio file, or drag one onto the page
3. **Listen to system audio** — Chrome or Edge → Entire screen → check **Share system audio** (Spotify, YouTube, etc.)
4. **Hide UI** (`H`) for a clean full-screen view
5. **Effects** panel (`F`) — Night Drive / Rain Drive toggles; drag the title bar to move it (hidden in Skyline)

## Tips

- Chrome or Edge works best for system audio capture
- No songs are bundled — bring your own
- **B-sides** in the Effects panel are experimental FX (off by default; Night Drive family)
- Rain Drive forces storm weather (cloudy sky, rain, fog, wet road, drum-synced lightning) even if some weather toggles are off

```powershell
node _check-public.js
node _stamp-version.js   # optional local: date + git SHA into version.json
```

Must exit 0 on the public guard before push. CI stamps `version.json` and blocks Pages deploy if the guard fails.

**Versioning:** hand-edit `codename` in `version.json` when a chapter starts (current: **Quasar**). CI fills `date` + short `sha`. UI shows `Quasar · abc1234` bottom-left; full stamp logs to the console on boot.

## License

MIT
