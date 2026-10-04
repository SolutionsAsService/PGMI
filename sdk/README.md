# Atlas Terrain SDK

`atlas-terrain.js` is a browser-native ES module for loading and validating the
Atlas terrain dataset, enumerating biome/range/landmark records, and adapting
those source records into procedural reference-study presets. It has no npm
dependencies and does not import Three.js, so it can be reused by other browser
projects without adopting this viewer.

```js
import {
  loadTerrainDataset,
  buildEnvironmentCatalog,
  createMountainRangeStudy,
} from './sdk/atlas-terrain.js';

const dataset = await loadTerrainDataset('./data/mountains.json');
const environments = buildEnvironmentCatalog(dataset, rendererFallbacks, { wireframe: true });
const andesStudy = createMountainRangeStudy(dataset, 'andes', environments);
```

The current viewer exposes a separate runtime bridge as `window.AtlasTerrain`:

```js
AtlasTerrain.getEnvironments();
AtlasTerrain.getMountainRanges();
AtlasTerrain.getTerrainFeatures('peaks');
AtlasTerrain.selectMountainRange('andes');
AtlasTerrain.selectTerrainFeature('volcanoes', 'fuji');
AtlasTerrain.getCurrentStudy();
```

Range/peak/volcano study settings are procedural previews informed by the
dataset's reference profiles. They are **not** measured digital elevation
models or claims of geographic terrain accuracy. The dataset's source records
and attribution live in `data/mountains.json` and the root README.

Run the dependency-free contract tests with `npm test`. Serve the repository over
HTTP (`npm run serve`) to allow the viewer to fetch its dataset and vendored
Three.js modules.
