export const TERRAIN_DATA_URL = './data/mountains.json';
export const SDK_VERSION = '1.0.0';

const VALID_FEATURE_TYPES = new Set(['peaks', 'volcanoes']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteWithin(value, minimum, maximum) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function validateTerrainDataset(dataset) {
  if (!isRecord(dataset) || typeof dataset.schema_version !== 'string') {
    throw new Error('Terrain dataset must declare a schema version.');
  }
  if (!isRecord(dataset.dataset) || typeof dataset.dataset.id !== 'string') {
    throw new Error('Terrain dataset metadata is missing its identifier.');
  }
  if (!isRecord(dataset.environments) || Object.keys(dataset.environments).length < 1 || Object.keys(dataset.environments).length > 64) {
    throw new Error('Terrain dataset must define between 1 and 64 environments.');
  }
  for (const [id, environment] of Object.entries(dataset.environments)) {
    if (!isRecord(environment) || environment.id !== id || typeof environment.name !== 'string' || !isRecord(environment.generation)) {
      throw new Error(`Terrain environment '${id}' has an invalid definition.`);
    }
    for (const [key, value] of Object.entries(environment.generation)) {
      if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`Terrain environment '${id}' has invalid ${key}.`);
    }
    if (environment.visual?.palette && (!Array.isArray(environment.visual.palette) || environment.visual.palette.length < 2 || environment.visual.palette.length > 16 || environment.visual.palette.some(color => typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)))) {
      throw new Error(`Terrain environment '${id}' has an invalid color palette.`);
    }
  }
  if (!Array.isArray(dataset.mountain_ranges) || dataset.mountain_ranges.length > 500) {
    throw new Error('Terrain dataset mountain range catalog is invalid.');
  }
  for (const range of dataset.mountain_ranges) {
    if (!isRecord(range) || typeof range.id !== 'string' || typeof range.name !== 'string' || !isRecord(range.terrain_profile)) {
      throw new Error('Terrain dataset contains an invalid mountain range record.');
    }
  }
  if (!isRecord(dataset.terrain_features)) throw new Error('Terrain dataset feature catalog is missing.');
  for (const type of VALID_FEATURE_TYPES) {
    if (!Array.isArray(dataset.terrain_features[type]) || dataset.terrain_features[type].length > 5000) {
      throw new Error(`Terrain dataset '${type}' catalog is invalid.`);
    }
    for (const feature of dataset.terrain_features[type]) {
      if (!isRecord(feature) || typeof feature.id !== 'string' || typeof feature.name !== 'string' || !finiteWithin(feature.elevation_m, 0, 10_000)) {
        throw new Error(`Terrain dataset contains an invalid ${type} record.`);
      }
      if ((feature.latitude !== undefined && !finiteWithin(feature.latitude, -90, 90)) || (feature.longitude !== undefined && !finiteWithin(feature.longitude, -180, 180))) {
        throw new Error(`Terrain feature '${feature.id}' has invalid coordinates.`);
      }
    }
  }
  if (!Array.isArray(dataset.sources) || dataset.sources.length > 64) {
    throw new Error('Terrain dataset source catalog is invalid.');
  }
  for (const source of dataset.sources) {
    if (!isRecord(source) || typeof source.id !== 'string' || typeof source.name !== 'string' || typeof source.url !== 'string') {
      throw new Error('Terrain dataset contains an invalid source citation.');
    }
    let sourceUrl;
    try {
      sourceUrl = new URL(source.url);
    } catch {
      throw new Error(`Terrain source '${source.id}' has an invalid URL.`);
    }
    if (sourceUrl.protocol !== 'https:' || sourceUrl.username || sourceUrl.password) {
      throw new Error(`Terrain source '${source.id}' must use a public HTTPS URL.`);
    }
  }
  return dataset;
}

export async function loadTerrainDataset(url = TERRAIN_DATA_URL, fetcher = globalThis.fetch) {
  if (typeof fetcher !== 'function') throw new Error('A Fetch-compatible loader is required to load the terrain dataset.');
  const response = await fetcher(url);
  if (!response?.ok) throw new Error(`Terrain dataset request failed${response?.status ? ` (${response.status})` : ''}.`);
  return validateTerrainDataset(await response.json());
}

export function buildEnvironmentCatalog(dataset, fallbacks, terrainDefaults) {
  validateTerrainDataset(dataset);
  const entries = Object.entries(dataset.environments);
  return Object.fromEntries(entries.map(([id, entry], index) => {
    const generation = entry.generation || {};
    const visual = entry.visual || {};
    const fallback = fallbacks[id] || {};
    const frequency = generation.frequency ?? fallback.frequency ?? 0.04;
    const colors = Array.isArray(visual.palette) && visual.palette.length > 1
      ? [...visual.palette]
      : [...(fallback.colors || fallbacks.mountains.colors)];
    return [id, {
      title: entry.name || fallback.title || id,
      index: String(index + 1).padStart(2, '0'),
      mode: entry.mode_label || fallback.mode || id.toUpperCase(),
      description: entry.description || fallback.description || '',
      height: generation.height_scale ?? fallback.height ?? 20,
      frequency,
      detailFrequency: frequency * 2.2,
      microFrequency: frequency * 5,
      detailStrength: generation.roughness ?? fallback.detailStrength ?? 0.2,
      microStrength: fallback.microStrength ?? 0.08,
      valleyStrength: generation.valley_strength ?? fallback.valleyStrength ?? 0.3,
      ridgeStrength: generation.ridge_strength ?? fallback.ridgeStrength ?? 0.2,
      maskStrength: generation.radial_falloff ?? fallback.maskStrength ?? 0.5,
      exponent: generation.peak_sharpness ?? fallback.exponent ?? 1.4,
      wireframe: visual.wireframe ?? fallback.wireframe ?? terrainDefaults.wireframe,
      colors,
    }];
  }));
}

export function listMountainRanges(dataset) {
  validateTerrainDataset(dataset);
  return dataset.mountain_ranges.map(range => ({
    ...range,
    continent: [...(range.continent || [])],
    countries: [...(range.countries || [])],
    tags: [...(range.tags || [])],
    highest_peak: range.highest_peak ? { ...range.highest_peak } : null,
    terrain_profile: { ...range.terrain_profile },
  }));
}

export function listTerrainFeatures(dataset, type) {
  validateTerrainDataset(dataset);
  if (!VALID_FEATURE_TYPES.has(type)) throw new Error(`Unknown terrain feature catalog '${type}'.`);
  return dataset.terrain_features[type].map(feature => ({ ...feature }));
}

export function createMountainRangeStudy(dataset, rangeId, environments) {
  validateTerrainDataset(dataset);
  const range = dataset.mountain_ranges.find(item => item.id === rangeId);
  if (!range) throw new Error(`Mountain system '${rangeId}' was not found.`);
  const environmentId = range.terrain_profile.environment;
  const base = environments[environmentId] || environments.mountains;
  if (!base) throw new Error(`No terrain preset is available for '${range.name}'.`);
  const profile = range.terrain_profile;
  return {
    ...base,
    title: range.name,
    mode: 'MOUNTAIN SYSTEM STUDY',
    description: `${range.name} · ${range.region || (range.continent || []).join(', ')}. Procedural preview guided by the reference terrain profile; not measured elevation data.`,
    height: base.height * clamp(profile.height_scale ?? 1, 0.4, 2),
    ridgeStrength: clamp(profile.ridge_strength ?? base.ridgeStrength, 0, 2),
    detailStrength: clamp(profile.roughness ?? base.detailStrength, 0, 2),
    valleyStrength: clamp(profile.valley_strength ?? base.valleyStrength, 0, 2),
    exponent: clamp(profile.peak_sharpness ?? base.exponent, 0.3, 3),
    reference: {
      kind: 'mountain-range',
      id: range.id,
      name: range.name,
      region: range.region || (range.continent || []).join(', '),
      countries: [...(range.countries || [])],
      lengthKm: Number.isFinite(range.length_km) ? range.length_km : null,
      tectonicContext: range.tectonic_context || '',
      highestPeak: range.highest_peak ? { ...range.highest_peak } : null,
      tags: [...(range.tags || [])],
      environment: environmentId,
      dataType: 'procedural-reference-study',
    },
  };
}

export function createTerrainFeatureStudy(dataset, type, featureId, environments) {
  const features = listTerrainFeatures(dataset, type);
  const feature = features.find(item => item.id === featureId);
  if (!feature) throw new Error(`Terrain feature '${featureId}' was not found in '${type}'.`);
  const environmentId = type === 'volcanoes' ? 'volcanic' : 'mountains';
  const base = environments[environmentId] || environments.mountains;
  if (!base) throw new Error(`No terrain preset is available for '${feature.name}'.`);
  const referenceElevation = type === 'volcanoes' ? 6_000 : 8_848.86;
  return {
    ...base,
    title: feature.name,
    mode: type === 'volcanoes' ? 'VOLCANO STUDY' : 'PEAK STUDY',
    description: `${feature.name} · ${feature.elevation_m.toLocaleString()} m reference elevation. Procedural scale preview; not a digital elevation model.`,
    height: base.height * clamp(feature.elevation_m / referenceElevation, 0.35, 1.6),
    reference: {
      kind: type === 'volcanoes' ? 'volcano' : 'mountain-peak',
      id: feature.id,
      name: feature.name,
      elevationM: feature.elevation_m,
      latitude: Number.isFinite(feature.latitude) ? feature.latitude : null,
      longitude: Number.isFinite(feature.longitude) ? feature.longitude : null,
      country: feature.country || '',
      featureType: feature.type || '',
      environment: environmentId,
      dataType: 'procedural-reference-study',
    },
  };
}
