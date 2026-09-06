# Atlas — Environmental Terrain Viewer

An interactive 3D procedural terrain visualizer built with
[Three.js](https://threejs.org/). Explore six environmental terrain types —
mountains, valleys, deserts, plateaus, coastal regions, and volcanic
landscapes — rendered in the browser with WebGL.

## Features

- **Six procedural environments** with distinct terrain generation
  parameters and color palettes.
- **Data-driven configuration** — environment definitions are loaded at
  runtime from [`data/mountains.json`](data/mountains.json), which also
  includes real-world mountain range, peak, and volcano reference data.
  If the dataset cannot be loaded, the app falls back to built-in defaults.
- **Interactive 3D viewer** — orbit, zoom, and pan controls, plus:
  - **Reset View** — return the camera to its starting position.
  - **Wireframe** — toggle the terrain wireframe overlay.
  - **Rotate** — toggle automatic camera rotation.
- **Responsive UI** that works on desktop, tablet, and mobile screens.

## Running locally

Because the app loads `data/mountains.json` with `fetch`, it must be served
over HTTP (opening `index.html` directly from the filesystem will use the
built-in fallback data instead).

```bash
# Any static file server works, for example:
python3 -m http.server 8000

# then open
http://localhost:8000
```

## Deployment

This is a fully static site — no build step required. Deploy the repository
contents to any static host (GitHub Pages, Netlify, Vercel, etc.).

For GitHub Pages: enable **Settings → Pages → Deploy from branch** and the
site will be served as-is. Three.js is vendored under
[`vendor/three/`](vendor/three/), so no external CDN access is required.

## Project structure

```
├── index.html          # Application markup
├── style.css           # Global styles
├── app.js              # Terrain engine and UI logic
├── data/
│   └── mountains.json  # Terrain dataset (environments + mountain data)
├── vendor/
│   └── three/          # Vendored Three.js (MIT licensed)
├── codepen             # Original prototype reference
└── old/                # Previous single-file version
```

## License

Three.js is distributed under the MIT License (see `vendor/three/LICENSE`).
