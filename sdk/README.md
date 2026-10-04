# Atlas Terrain SDK

`atlas-terrain.js` is a browser-native ES module for loading and validating the
Atlas reference dataset, enumerating biome/range/landmark records, and loading
Mapzen Terrarium DEM tiles from AWS Open Data. It has no npm dependencies and
does not import Three.js, so the tile math and data loader can be reused by
other browser projects without adopting this viewer.

```js
import {
  loadTerrainDataset,
  loadTerrariumTile,
  sampleTerrainElevation,
  buildEnvironmentCatalog,
  createMountainRangeStudy,
} from './sdk/atlas-terrain.js';

const dataset = await loadTerrainDataset('./data/mountains.json');
const environments = buildEnvironmentCatalog(dataset, rendererFallbacks, { wireframe: true });
const andesStudy = createMountainRangeStudy(dataset, 'andes', environments);
const demTile = await loadTerrariumTile(andesStudy.reference.latitude, andesStudy.reference.longitude);
const centerElevationM = sampleTerrainElevation(demTile, demTile.pixelX / demTile.width, demTile.pixelY / demTile.height);
```

`loadTerrariumTile` fetches one 256×256 public tile and returns decoded meter
samples, WGS84 tile bounds, min/max elevations, and source metadata. The
default zoom is 9; valid zooms are 0–15. Use only in a browser context that can
read cross-origin images. The viewer uses 2× vertical exaggeration and reports
that choice rather than implying physically scaled vertical relief. Tile
sources and coverage vary; see [AWS Open Data terrain tiles](https://registry.opendata.aws/terrain-tiles/).

The current viewer exposes a separate runtime bridge as `window.AtlasTerrain`:

```js
AtlasTerrain.getEnvironments();
AtlasTerrain.getMountainRanges();
AtlasTerrain.getTerrainFeatures('peaks');
AtlasTerrain.selectMountainRange('andes');
AtlasTerrain.selectTerrainFeature('volcanoes', 'fuji');
AtlasTerrain.getCurrentStudy();
```

Range/peak/volcano references point to real coordinate-based DEM tiles. A
mountain-range selection centers on its highest mapped peak, falling back to
the approximate extent center when needed; it does not download the complete
range. The six environment presets remain procedural. Reference catalog
sources are in `data/mountains.json`; DEM attribution and limits are in the
root README.

Run the dependency-free contract tests with `npm test`. Serve the repository over
HTTP (`npm run serve`) to allow the viewer to fetch its dataset and vendored
Three.js modules.
