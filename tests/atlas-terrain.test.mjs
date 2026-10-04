import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildEnvironmentCatalog,
  createMountainRangeStudy,
  createTerrainFeatureStudy,
  listMountainRanges,
  listTerrainFeatures,
  loadTerrainDataset,
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
  assert.deepEqual(study.reference.countries, ['Argentina', 'Bolivia', 'Chile', 'Colombia', 'Ecuador', 'Peru', 'Venezuela']);
  assert.match(study.description, /not measured elevation data/);
  assert.ok(study.height > 0 && study.height <= environments.mountains.height * 2);
  assert.throws(() => createMountainRangeStudy(dataset, 'not-a-range', environments), /not found/);
});

test('peak and volcano reference studies use distinct procedural biomes and remain explicit previews', () => {
  const environments = buildEnvironmentCatalog(dataset, fallbacks, terrainDefaults);
  const peak = createTerrainFeatureStudy(dataset, 'peaks', 'everest', environments);
  const volcano = createTerrainFeatureStudy(dataset, 'volcanoes', 'fuji', environments);
  assert.equal(peak.reference.kind, 'mountain-peak');
  assert.equal(peak.reference.elevationM, 8848.86);
  assert.equal(peak.reference.environment, 'mountains');
  assert.equal(volcano.reference.kind, 'volcano');
  assert.equal(volcano.reference.environment, 'volcanic');
  assert.match(volcano.description, /not a digital elevation model/);
  assert.throws(() => createTerrainFeatureStudy(dataset, 'peaks', 'missing', environments), /not found/);
});

test('public catalog access returns detached record collections', () => {
  const ranges = listMountainRanges(dataset);
  ranges[0].countries.push('Invented');
  assert.equal(dataset.mountain_ranges[0].countries.includes('Invented'), false);
});
