#!/usr/bin/env node
// Verifies every catalog coordinate against measured elevation (Terrarium DEM).
// For each peak/volcano/range high point: loads a z12 window, finds the highest
// DEM cell within a search radius, and reports the offset between the catalog
// coordinate and that summit plus the DEM vs. listed elevation difference.
//   node scripts/verify-references.mjs [--json] [--radius-km 2]
import { readFile } from 'node:fs/promises';
import { decodePng } from './png-terrarium.mjs';
import { loadTerrainView } from '../sdk/atlas-terrain.js';

const args = process.argv.slice(2);
const radiusKm = Number(args[args.indexOf('--radius-km') + 1]) || 2;
const dataset = JSON.parse(await readFile(new URL('../data/mountains.json', import.meta.url)));
const decoder = async (blob) => {
  const png = decodePng(Buffer.from(await blob.arrayBuffer()));
  const elevations = new Float32Array(png.width * png.height);
  for (let i = 0; i < elevations.length; i += 1) elevations[i] = png.pixels[i * 4] * 256 + png.pixels[i * 4 + 1] + png.pixels[i * 4 + 2] / 256 - 32768;
  return { width: png.width, height: png.height, elevations };
};

// Summits whose DEM height legitimately differs from the surveyed height
// (ice surface / DEM void fill). Offset must still pass.
const KNOWN_ELEVATION_GAPS = new Set(['transantarctic']);
const refs = [
  ...dataset.terrain_features.peaks.map((p) => ({ kind: 'peak', ...p })),
  ...dataset.terrain_features.volcanoes.map((p) => ({ kind: 'volcano', ...p })),
  ...dataset.mountain_ranges.map((r) => ({ kind: 'range-high-point', id: r.id, ...r.highest_peak })),
];
const rows = [];
for (const ref of refs) {
  try {
    const view = await loadTerrainView(ref.latitude, ref.longitude, { zoom: 12, windowPx: 256, decoder });
    const metersPerPx = view.groundWidthMeters / view.width;
    const r = Math.round(radiusKm * 1000 / metersPerPx);
    const cx = Math.round(view.pixelX), cy = Math.round(view.pixelY);
    let best = { e: -Infinity, x: 0, y: 0 };
    for (let y = Math.max(0, cy - r); y <= Math.min(view.height - 1, cy + r); y += 1) {
      for (let x = Math.max(0, cx - r); x <= Math.min(view.width - 1, cx + r); x += 1) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        const e = view.elevations[y * view.width + x];
        if (e > best.e) best = { e, x, y };
      }
    }
    const atPoint = view.elevations[cy * view.width + cx];
    const offsetM = Math.hypot(best.x - view.pixelX, best.y - view.pixelY) * metersPerPx;
    const summit = view.pixelToLatLon(best.x, best.y);
    rows.push({ kind: ref.kind, id: ref.id, name: ref.name, listed: ref.elevation_m, demAtPoint: Math.round(atPoint), demSummit: Math.round(best.e),
      offsetM: Math.round(offsetM), summitLat: +summit.latitude.toFixed(4), summitLon: +summit.longitude.toFixed(4),
      flag: offsetM > 750 ? 'CHECK' : Math.abs(best.e - ref.elevation_m) > 250 ? (KNOWN_ELEVATION_GAPS.has(ref.id) ? 'known' : 'CHECK') : 'ok' });
  } catch (error) {
    rows.push({ kind: ref.kind, id: ref.id, name: ref.name, flag: 'ERROR', error: error.message });
  }
}
if (args.includes('--json')) console.log(JSON.stringify(rows, null, 2));
else for (const r of rows) console.log([r.flag.padEnd(5), r.kind.padEnd(16), String(r.id).padEnd(22), String(r.listed).padStart(8), String(r.demAtPoint).padStart(6), String(r.demSummit).padStart(6), (r.offsetM + 'm').padStart(7), r.summitLat, r.summitLon, r.error ?? ''].join(' '));
process.exitCode = rows.some((r) => r.flag === 'ERROR' || (args.includes('--strict') && r.flag === 'CHECK')) ? 1 : 0;
