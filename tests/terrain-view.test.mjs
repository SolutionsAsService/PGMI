import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import {
  loadTerrainView, latLonToGlobalPixel, globalPixelToLatLon, extentCenter, REFERENCE_VIEW_ZOOM,
} from '../sdk/atlas-terrain.js';
import { decodePng } from '../scripts/png-terrarium.mjs';

const dataset = JSON.parse(await readFile(new URL('../data/mountains.json', import.meta.url)));

// Fake provider: every tile's elevation encodes its own tile x/y so stitching can be checked.
function fakeProvider(calls) {
  return {
    fetcher: async (url) => { calls.push(url); return { ok: true, blob: async () => url, headers: new Headers({ 'x-amz-meta-x-imagery-sources': 'srtm/test.tif' }) }; },
    decoder: async (url) => {
      const [, , x, y] = url.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/).map(Number);
      return { width: 256, height: 256, elevations: new Float32Array(256 * 256).fill(x * 1000 + y) };
    },
  };
}

test('mercator pixel helpers round-trip', () => {
  for (const [lat, lon] of [[27.9881, 86.925], [-84.3333, 166.4167], [0, -179.99]]) {
    const p = latLonToGlobalPixel(lat, lon, 12);
    const back = globalPixelToLatLon(p.x, p.y, 12);
    assert.ok(Math.abs(back.latitude - lat) < 1e-9 && Math.abs(back.longitude - lon) < 1e-9);
  }
});

test('terrain view is centered on the requested point and stitches overlapping tiles', async () => {
  const calls = [];
  const view = await loadTerrainView(27.9881, 86.925, { zoom: 11, windowPx: 512, ...fakeProvider(calls) });
  assert.equal(view.width, 512);
  assert.ok(Math.abs(view.pixelX - 256) <= 0.5 && Math.abs(view.pixelY - 256) <= 0.5, 'summit is in the middle');
  assert.ok(calls.length >= 4 && calls.length <= 9);
  const center = view.uvToLatLon(view.pixelX / 512, view.pixelY / 512);
  assert.ok(Math.abs(center.latitude - 27.9881) < 1e-6 && Math.abs(center.longitude - 86.925) < 1e-6);
  assert.ok(view.groundWidthMeters > 30_000 && view.groundWidthMeters < 40_000, `z11 window ~34 km, got ${view.groundWidthMeters}`);
  assert.equal(new Set(view.elevations).size, calls.length, 'every fetched tile contributes pixels');
  assert.equal(view.imagerySources, 'srtm/test.tif');
  assert.ok(view.bounds.west < 86.925 && view.bounds.east > 86.925 && view.bounds.south < 27.9881 && view.bounds.north > 27.9881);
});

test('terrain view wraps across the antimeridian', async () => {
  const calls = [];
  const view = await loadTerrainView(-16.5, 179.999, { zoom: 9, windowPx: 256, ...fakeProvider(calls) });
  assert.ok(calls.some((u) => /\/9\/511\//.test(u)) && calls.some((u) => /\/9\/0\//.test(u)), calls.join(' '));
  assert.ok(view.bounds.west > 179 && view.bounds.east < -179);
});

test('extent center handles antimeridian-crossing ranges', () => {
  assert.deepEqual(extentCenter({ north: -71, south: -85, west: 160, east: -160 }), { latitude: -78, longitude: 180 });
  assert.deepEqual(extentCenter({ north: 10, south: 0, west: 10, east: 20 }), { latitude: 5, longitude: 15 });
});

test('every reference kind has a view zoom', () => {
  assert.deepEqual(Object.keys(REFERENCE_VIEW_ZOOM).sort(), ['mountain-peak', 'mountain-range', 'volcano']);
});

test('DEM-verified summit coordinates (regression for corrected entries)', () => {
  const ranges = Object.fromEntries(dataset.mountain_ranges.map((r) => [r.id, r.highest_peak]));
  const near = (p, lat, lon, tol = 0.02) => Math.abs(p.latitude - lat) < tol && Math.abs(p.longitude - lon) < tol;
  assert.ok(near(ranges.urals, 65.0333, 60.1167), 'Narodnaya is at ~60.12°E, not 59.25°E');
  assert.ok(near(ranges.kunlun, 35.3158, 80.9158), 'Liushi Shan');
  assert.ok(near(ranges.drakensberg, -29.4667, 29.2667), 'Thabana Ntlenyana');
  assert.ok(near(ranges.transantarctic, -84.3333, 166.4167), 'Mount Kirkpatrick');
  assert.ok(near(ranges.new_guinea_highlands, -4.0789, 137.1583), 'Puncak Jaya');
  const kili = dataset.terrain_features.peaks.find((p) => p.id === 'kilimanjaro');
  assert.ok(near(kili, -3.0758, 37.3533, 0.005), 'Uhuru Peak');
  assert.ok(dataset.dataset.coordinate_verification?.method.includes('verify-references'));
});

test('node PNG decoder reads an RGB Terrarium tile', () => {
  const w = 2, h = 2; const rows = [];
  for (let y = 0; y < h; y += 1) rows.push(Buffer.from([0, 128, 0, 0, 128, 1, 0])); // filter 0, two RGB pixels
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); return Buffer.concat([len, Buffer.from(type), data, Buffer.alloc(4)]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
  const out = decodePng(png);
  assert.deepEqual([out.width, out.height, out.pixels[0], out.pixels[4], out.pixels[5]], [2, 2, 128, 128, 1]);
});
