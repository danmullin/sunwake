# Sunwake

Synthwave audio visualizer — a night-drive sea of light that reacts to your music.

**Live:** https://danmullin.github.io/sunwake/

## Run

```powershell
cd projects/sunwake
python -m http.server 8765
```

Open http://127.0.0.1:8765/

Or open `index.html` via any static file server (modules need HTTP, not `file://`).

## Listen

1. **Open a song** — pick a local audio file, or drag one onto the page
2. **Listen to system audio** — Chrome or Edge → Entire screen → check **Share system audio** (Spotify, YouTube, etc.)
3. **Hide UI** (`H`) for a clean full-screen view
4. **Effects** panel (`F`) — toggle visuals; drag the title bar to move it

## Tips

- Chrome or Edge works best for system audio capture
- No songs are bundled — bring your own
- **B-sides** in the Effects panel are experimental FX (off by default)

```powershell
node _check-public.js
node _stamp-version.js   # optional local: date + git SHA into version.json
```

Must exit 0 on the public guard before push. CI stamps `version.json` and blocks Pages deploy if the guard fails.

**Versioning:** hand-edit `codename` in `version.json` when a chapter starts (current: **Quasar**). CI fills `date` + short `sha`. UI shows `Quasar · abc1234` bottom-left; full stamp logs to the console on boot.

## License

MIT
