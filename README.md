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

## Maintainers

This is the **public** twin of a private visualizer. Never copy private Mist Listen UI over these files.

```powershell
node _check-public.js
```

Must exit 0 before push. CI blocks Pages deploy if it fails.

## License

MIT
