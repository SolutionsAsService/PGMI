# Atlas — Environmental Terrain Viewer

An interactive 3D procedural terrain visualizer built with
[Three.js](https://threejs.org/). Explore six environmental terrain types —
mountains, valleys, deserts, plateaus, coastal regions, and volcanic
landscapes — rendered in the browser with WebGL.

## Features

- **Six procedural environments** with distinct terrain-generation
  parameters and color palettes.
- **Data-driven configuration** — environment definitions are loaded at
  runtime from [`data/mountains.json`](data/mountains.json), which also
  includes real-world mountain range, peak, and volcano reference data.
  If the dataset cannot be loaded, the app falls back to built-in defaults.
- **43 real-world terrain studies** — search/select 30 mountain systems, 8
  major peaks and 5 volcanoes. Mountain-system profiles change the procedural
  preview; landmark studies use a related mountain/volcanic biome and show
  supplied elevation/location facts. These are reference-guided previews,
  **not** measured elevation models or geographic reconstructions.
- **Interactive 3D viewer** — orbit, zoom, and pan controls, plus:
  - **Reset View** — return the camera to its starting position.
  - **Wireframe** — toggle the terrain wireframe overlay.
  - **Rotate** — toggle automatic camera rotation.
- **Responsive UI** that works on desktop, tablet, and mobile screens.
- **Reusable browser SDK** at [`sdk/atlas-terrain.js`](sdk/atlas-terrain.js):
  validate/load the dataset, enumerate its catalog, and derive renderer-ready
  biome, range, peak and volcano study profiles without a Three.js dependency.
  The running viewer also exposes `window.AtlasTerrain` for integration.

## Running locally

Because the app loads `data/mountains.json` with `fetch`, it must be served
over HTTP (opening `index.html` directly from the filesystem will use the
built-in fallback data instead).

```bash
# Node.js: dependency-free SDK contract tests and local static server
npm test
npm run serve

# then open
http://localhost:8000
```

Python's `python3 -m http.server 8000` also works. No package installation or
build step is required; the Three.js runtime remains vendored locally.

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
├── sdk/
│   ├── atlas-terrain.js # Reusable dataset/preset SDK
│   └── README.md        # SDK integration contract
├── tests/               # Dataset and SDK contract tests
├── vendor/
│   └── three/          # Vendored Three.js (MIT licensed)
├── codepen             # Original prototype reference
└── old/                # Previous single-file version
```

## License

Three.js is distributed under the MIT License (see `vendor/three/LICENSE`).
