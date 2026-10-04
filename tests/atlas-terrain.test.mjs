import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildEnvironmentCatalog,
  createMountainRangeStudy,
  createTerrainFeatureStudy,
  decodeTerrariumPixels,
  getTerrariumSourceAttributions,
  listMountainRanges,
  listTerrainFeatures,
  loadTerrariumTile,
  loadTerrainDataset,
  sampleTerrainElevation,
  terrainTileAddress,
  terrariumElevation,
  validateTerrainDataset,
} from '../sdk/atlas-terrain.js';

const dataset = JSON.parse(await readFile(new URL('../data/mountains.json', import.meta.url), 'utf8'));
const fallbacks = {
  mountains: { title: 'Mountains', height: 32, ridgeStrength: 0.2, detailStrength: 0.3, valleyStrength: 0.3, exponent: 1.5, colors: ['#111111', '#eeeeee'] },
  volcanic: { title: 'Volcanic', height: 35, ridgeStrength: 0.4, detailStrength: 0.4, valleyStrength: 0.2, exponent: 1.4, colors: ['#111111', '#eeeeee'] },
};
const terrainDefaults = { wireframe: true };

test('terrain dataset validates its reusable biome, range, landmark and source inventories', () => {
  assert.equal(validateTerrainDataset(dataset), dataset);
  assert.equal(Object.keys(dataset.environments).length, 6);
  assert.equal(listMountainRanges(dataset).length, 30);
  assert.equal(listTerrainFeatures(dataset, 'peaks').length, 8);
  assert.equal(listTerrainFeatures(dataset, 'volcanoes').length, 5);
  assert.throws(() => listTerrainFeatures(dataset, 'rivers'), /Unknown terrain feature catalog/);
});

test('dataset validation rejects unsafe geometry metadata and malformed presets', () => {
  const invalid = structuredClone(dataset);
  invalid.terrain_features.peaks[0].latitude = 94;
  assert.throws(() => validateTerrainDataset(invalid), /invalid coordinates/);
  const badPalette = structuredClone(dataset);
  badPalette.environments.mountains.visual.palette = ['red', '#ffffff'];
  assert.throws(() => validateTerrainDataset(badPalette), /invalid color palette/);
});

test('browser loader accepts injectable fetch and validates the returned document', async () => {
  let requestedUrl;
  const loaded = await loadTerrainDataset('/fixtures/terrain.json', async url => {
    requestedUrl = url;
    return { ok: true, json: async () => dataset };
  });
  assert.equal(requestedUrl, '/fixtures/terrain.json');
  assert.equal(loaded.dataset.id, 'atlas-terrain');
  await assert.rejects(() => loadTerrainDataset('/missing.json', async () => ({ ok: false, status: 404 })), /404/);
  await assert.rejects(() => loadTerrainDataset('/invalid.json', async () => ({ ok: true, json: async () => ({}) })), /schema version/);
});

test('environment catalog adapts dataset definitions for the renderer', () => {
  const environments = buildEnvironmentCatalog(dataset, fallbacks, terrainDefaults);
  assert.equal(Object.keys(environments).length, 6);
  assert.equal(environments.mountains.title, 'Mountain Range');
  assert.equal(environments.mountains.index, '01');
  assert.ok(environments.mountains.detailFrequency > environments.mountains.frequency);
  assert.equal(environments.mountains.wireframe, true);
  assert.notEqual(environments.mountains.colors, dataset.environments.mountains.visual.palette);
});

test('mountain range studies carry source facts and derive bounded renderer settings', () => {
  const environments = buildEnvironmentCatalog(dataset, fallbacks, terrainDefaults);
  const study = createMountainRangeStudy(dataset, 'andes', environments);
  assert.equal(study.reference.name, 'Andes');
  assert.equal(study.reference.kind, 'mountain-range');
  assert.equal(study.reference.highestPeak.name, 'Aconcagua');
  assert.equal(study.reference.latitude, -32.6532);
  assert.equal(study.reference.longitude, -70.0109);
  assert.deepEqual(study.reference.countries, ['Argentina', 'Bolivia', 'Chile', 'Colombia', 'Ecuador', 'Peru', 'Venezuela']);
  assert.match(study.description, /Loads a real elevation tile/);
  assert.ok(study.height > 0 && study.height <= environments.mountains.height * 2);
  assert.throws(() => createMountainRangeStudy(dataset, 'not-a-range', environments), /not found/);
});

test('Terrarium coordinate math returns a valid slippy tile and clamps world edges', () => {
  assert.deepEqual(terrainTileAddress(0, 0, 1), {
    zoom: 1,
    x: 1,
    y: 1,
    pixelX: 0,
    pixelY: 0,
    url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/1/1/1.png',
  });
  const eastEdge = terrainTileAddress(0, 180, 9);
  assert.equal(eastEdge.x, 511);
  assert.match(eastEdge.url, /\/9\/511\/256\.png$/);
  assert.throws(() => terrainTileAddress(91, 0, 9), /valid WGS84/);
  assert.throws(() => terrainTileAddress(0, 0, 16), /zoom/);
});

test('Terrarium RGB decoding maps encoded pixels to meter elevation', () => {
  assert.equal(terrariumElevation(128, 123, 64), 123.25);
  const rgba = new Uint8ClampedArray(256 * 256 * 4);
  for (let index = 0; index < rgba.length; index += 4) {
    rgba[index] = 128;
    rgba[index + 1] = 123;
    rgba[index + 2] = 64;
    rgba[index + 3] = 255;
  }
  const decoded = decodeTerrariumPixels(rgba);
  assert.equal(decoded.length, 256 * 256);
  assert.equal(decoded[0], 123.25);
  assert.throws(() => decodeTerrariumPixels(new Uint8Array(16), 2, 2), /256×256/);
});

test('real tile loader returns bounded elevation samples and source attribution', async () => {
  let requestedUrl = '';
  let requestedMode = '';
  const elevations = new Float32Array(256 * 256);
  elevations.fill(250);
  elevations[128 * 256 + 128] = 725;
  const tile = await loadTerrariumTile(27.9881, 86.925, {
    zoom: 9,
    fetcher: async (url, options) => {
      requestedUrl = url;
      requestedMode = options.mode;
      return {
        ok: true,
        blob: async () => new Blob(['tile']),
        headers: new Headers({ 'x-amz-meta-x-imagery-sources': 'srtm/N27E086.tif' }),
      };
    },
    decoder: async () => ({ width: 256, height: 256, elevations }),
  });
  assert.equal(requestedMode, 'cors');
  assert.equal(requestedUrl, tile.url);
  assert.match(tile.url, /\/9\/379\/214\.png$/);
  assert.equal(tile.minimumElevationM, 250);
  assert.equal(tile.maximumElevationM, 725);
  assert.equal(tile.imagerySources, 'srtm/N27E086.tif');
  assert.equal(tile.dataType, 'measured-elevation-tile');
  assert.ok(tile.bounds.north > tile.bounds.south);
  assert.match(tile.attributionUrl, /^https:\/\//);
});

test('tile elevation sampler bilinearly interpolates and rejects points outside its tile', () => {
  const tile = { width: 2, height: 2, elevations: new Float32Array([0, 100, 200, 300]) };
  assert.equal(sampleTerrainElevation(tile, 0, 0), 0);
  assert.equal(sampleTerrainElevation(tile, 1, 1), 300);
  assert.equal(sampleTerrainElevation(tile, 0.5, 0.5), 150);
  assert.equal(sampleTerrainElevation(tile, 1.1, 0.5), null);
});

test('source-specific tile credits resolve the actual SRTM and GMTED source metadata', () => {
  const credits = getTerrariumSourceAttributions('srtm/N27E086.tif, gmted/10N060E_mea075.tif');
  assert.deepEqual(credits, [
    'SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey.',
  ]);
  assert.deepEqual(getTerrariumSourceAttributions('usgs/3dep/N40W105.tif'), [
    'U.S. 3DEP (formerly NED) terrain data courtesy of the U.S. Geological Survey.',
  ]);
  assert.deepEqual(getTerrariumSourceAttributions('unlisted/source.tif'), []);
});

test('peak and volcano studies resolve real coordinates while retaining distinct source biomes', () => {
  const environments = buildEnvironmentCatalog(dataset, fallbacks, terrainDefaults);
  const peak = createTerrainFeatureStudy(dataset, 'peaks', 'everest', environments);
  const volcano = createTerrainFeatureStudy(dataset, 'volcanoes', 'fuji', environments);
  assert.equal(peak.reference.kind, 'mountain-peak');
  assert.equal(peak.reference.elevationM, 8848.86);
  assert.equal(peak.reference.latitude, 27.9881);
  assert.equal(peak.reference.longitude, 86.925);
  assert.equal(peak.reference.environment, 'mountains');
  assert.equal(volcano.reference.kind, 'volcano');
  assert.equal(volcano.reference.environment, 'volcanic');
  assert.match(volcano.description, /Loads a real elevation tile/);
  assert.equal(volcano.reference.latitude, 35.3606);
  assert.throws(() => createTerrainFeatureStudy(dataset, 'peaks', 'missing', environments), /not found/);
});

test('public catalog access returns detached record collections', () => {
  const ranges = listMountainRanges(dataset);
  ranges[0].countries.push('Invented');
  assert.equal(dataset.mountain_ranges[0].countries.includes('Invented'), false);
});
