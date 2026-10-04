export const TERRAIN_DATA_URL = './data/mountains.json';
export const SDK_VERSION = '1.1.0';
export const TERRARIUM_TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
export const TERRARIUM_ATTRIBUTION_URL = 'https://registry.opendata.aws/terrain-tiles/';
export const TERRARIUM_LICENSE_URL = 'https://raw.githubusercontent.com/tilezen/joerd/master/docs/attribution.md';
export const TERRARIUM_ATTRIBUTION = 'Mapzen terrain tiles · hosted by AWS Open Data';
export const TERRAIN_TILE_SIZE = 256;
const MAX_MERCATOR_LATITUDE = 85.05112878;

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

export function terrainTileAddress(latitude, longitude, zoom = 9) {
  if (!finiteWithin(latitude, -90, 90) || !finiteWithin(longitude, -180, 180)) {
    throw new Error('Terrain tile coordinates must be valid WGS84 latitude/longitude values.');
  }
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > 15) {
    throw new Error('Terrain tile zoom must be an integer from 0 to 15.');
  }
  const tileCount = 2 ** zoom;
  const clampedLatitude = clamp(latitude, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
  const latitudeRadians = clampedLatitude * Math.PI / 180;
  const x = clamp((longitude + 180) / 360 * tileCount, 0, tileCount - 1e-9);
  const y = clamp((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * tileCount, 0, tileCount - 1e-9);
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  return {
    zoom,
    x: tileX,
    y: tileY,
    pixelX: (x - tileX) * TERRAIN_TILE_SIZE,
    pixelY: (y - tileY) * TERRAIN_TILE_SIZE,
    url: `${TERRARIUM_TILE_URL}/${zoom}/${tileX}/${tileY}.png`,
  };
}

export function terrariumElevation(red, green, blue) {
  return red * 256 + green + blue / 256 - 32768;
}

export function decodeTerrariumPixels(pixels, width = TERRAIN_TILE_SIZE, height = TERRAIN_TILE_SIZE) {
  if (!pixels || pixels.length !== width * height * 4 || width !== TERRAIN_TILE_SIZE || height !== TERRAIN_TILE_SIZE) {
    throw new Error(`Terrarium elevation imagery must be a ${TERRAIN_TILE_SIZE}×${TERRAIN_TILE_SIZE} RGBA tile.`);
  }
  const elevations = new Float32Array(width * height);
  for (let pixel = 0, rgba = 0; pixel < elevations.length; pixel += 1, rgba += 4) {
    elevations[pixel] = terrariumElevation(pixels[rgba], pixels[rgba + 1], pixels[rgba + 2]);
  }
  return elevations;
}

function decodeTerrariumBlob(blob) {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('This browser cannot decode elevation tiles (createImageBitmap is unavailable).');
  }
  return createImageBitmap(blob).then(bitmap => {
    const canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(bitmap.width, bitmap.height)
      : Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      bitmap.close?.();
      throw new Error('The browser could not read elevation pixels from the tile.');
    }
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const elevations = decodeTerrariumPixels(pixels, bitmap.width, bitmap.height);
    const width = bitmap.width;
    const height = bitmap.height;
    bitmap.close?.();
    return { elevations, width, height };
  });
}

export async function loadTerrariumTile(latitude, longitude, {
  zoom = 9,
  fetcher = globalThis.fetch,
  decoder = decodeTerrariumBlob,
  signal,
} = {}) {
  const address = terrainTileAddress(latitude, longitude, zoom);
  if (typeof fetcher !== 'function') throw new Error('A Fetch-compatible elevation tile loader is required.');
  const response = await fetcher(address.url, { mode: 'cors', signal });
  if (!response?.ok) throw new Error(`Elevation tile request failed${response?.status ? ` (${response.status})` : ''}.`);
  const decoded = await decoder(await response.blob());
  if (decoded.width !== TERRAIN_TILE_SIZE || decoded.height !== TERRAIN_TILE_SIZE || decoded.elevations?.length !== TERRAIN_TILE_SIZE ** 2) {
    throw new Error('The elevation provider returned a tile with an unsupported size.');
  }
  let minimumElevationM = Infinity;
  let maximumElevationM = -Infinity;
  for (const elevation of decoded.elevations) {
    if (!Number.isFinite(elevation)) throw new Error('The elevation tile contains an invalid sample.');
    minimumElevationM = Math.min(minimumElevationM, elevation);
    maximumElevationM = Math.max(maximumElevationM, elevation);
  }
  const tileCount = 2 ** zoom;
  const longitudeAtTileX = x => x / tileCount * 360 - 180;
  const latitudeAtTileY = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / tileCount))) * 180 / Math.PI;
  return {
    ...address,
    latitude,
    longitude,
    width: decoded.width,
    height: decoded.height,
    elevations: decoded.elevations,
    minimumElevationM,
    maximumElevationM,
    bounds: {
      west: longitudeAtTileX(address.x),
      east: longitudeAtTileX(address.x + 1),
      north: latitudeAtTileY(address.y),
      south: latitudeAtTileY(address.y + 1),
    },
    imagerySources: (response.headers?.get?.('x-amz-meta-x-imagery-sources') || '').slice(0, 240),
    attribution: TERRARIUM_ATTRIBUTION,
    attributionUrl: TERRARIUM_ATTRIBUTION_URL,
    elevationUnit: 'm',
    dataType: 'measured-elevation-tile',
  };
}

export function sampleTerrainElevation(tile, u, v) {
  if (!tile?.elevations || !Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) {
    return null;
  }
  const px = u * (tile.width - 1);
  const py = v * (tile.height - 1);
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const x1 = Math.min(x0 + 1, tile.width - 1);
  const y1 = Math.min(y0 + 1, tile.height - 1);
  const xFraction = px - x0;
  const yFraction = py - y0;
  const top = tile.elevations[y0 * tile.width + x0] * (1 - xFraction) + tile.elevations[y0 * tile.width + x1] * xFraction;
  const bottom = tile.elevations[y1 * tile.width + x0] * (1 - xFraction) + tile.elevations[y1 * tile.width + x1] * xFraction;
  return top * (1 - yFraction) + bottom * yFraction;
}

export function getTerrariumSourceAttributions(sourceMetadata = '') {
  const sources = String(sourceMetadata).toLocaleLowerCase();
  const attributions = [];
  const includeWhen = (pattern, attribution) => {
    if (pattern.test(sources)) attributions.push(attribution);
  };
  includeWhen(/arcticdem/, 'ArcticDEM created from DigitalGlobe imagery; funded under U.S. National Science Foundation awards 1043681, 1559691, and 1542736.');
  includeWhen(/australia|geoscience.?australia/, 'Australia terrain data © Commonwealth of Australia (Geoscience Australia) 2017.');
  includeWhen(/austria/, 'Austria terrain data © offene Daten Österreichs – Digitales Geländemodell Österreich.');
  includeWhen(/canada/, 'Canada terrain data contains information licensed under the Open Government Licence – Canada.');
  includeWhen(/eu.?dem|copernicus/, 'Europe terrain data produced using Copernicus data and information funded by the European Union – EU-DEM layers.');
  includeWhen(/etopo1/, 'Global ETOPO1 terrain data: U.S. National Oceanic and Atmospheric Administration.');
  includeWhen(/mexico|inegi/, 'Mexico terrain data source: INEGI, Continental relief, 2016.');
  includeWhen(/new.?zealand|linz/, 'New Zealand terrain data © Crown copyright / Land Information New Zealand and the New Zealand Government.');
  includeWhen(/norway|kartverket/, 'Norway terrain data © Kartverket.');
  includeWhen(/united.?kingdom|uk\//, 'United Kingdom terrain data © Environment Agency copyright and/or database right 2015.');
  includeWhen(/srtm|gmted/, 'SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey.');
  includeWhen(/3dep|ned\//, 'U.S. 3DEP (formerly NED) terrain data courtesy of the U.S. Geological Survey.');
  return [...new Set(attributions)];
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
  const extent = range.approximate_extent;
  const latitude = range.highest_peak?.latitude ?? (extent ? (extent.north + extent.south) / 2 : null);
  const longitude = range.highest_peak?.longitude ?? (extent ? (extent.west + extent.east) / 2 : null);
  return {
    ...base,
    title: range.name,
    mode: 'MOUNTAIN SYSTEM STUDY',
    description: `${range.name} · ${range.region || (range.continent || []).join(', ')}. Loads a real elevation tile centered on its highest mapped peak or approximate regional center.`,
    height: base.height * clamp(profile.height_scale ?? 1, 0.4, 2),
    ridgeStrength: clamp(profile.ridge_strength ?? base.ridgeStrength, 0, 2),
    detailStrength: clamp(profile.roughness ?? base.detailStrength, 0, 2),
    valleyStrength: clamp(profile.valley_strength ?? base.valleyStrength, 0, 2),
    exponent: clamp(profile.peak_sharpness ?? base.exponent, 0.3, 3),
    reference: {
      kind: 'mountain-range',
      id: range.id,
      name: range.name,
      latitude,
      longitude,
      centerSource: range.highest_peak ? 'highest-peak-reference' : extent ? 'approximate-range-center' : 'unavailable',
      region: range.region || (range.continent || []).join(', '),
      countries: [...(range.countries || [])],
      lengthKm: Number.isFinite(range.length_km) ? range.length_km : null,
      tectonicContext: range.tectonic_context || '',
      highestPeak: range.highest_peak ? { ...range.highest_peak } : null,
      tags: [...(range.tags || [])],
      environment: environmentId,
      dataType: 'measured-elevation-tile',
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
    description: `${feature.name} · ${feature.elevation_m.toLocaleString()} m listed elevation. Loads a real elevation tile around the mapped coordinates; listed height is shown separately from sampled DEM elevations.`,
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
      dataType: 'measured-elevation-tile',
    },
  };
}
