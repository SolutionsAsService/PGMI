
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  buildEnvironmentCatalog,
  createMountainRangeStudy,
  createTerrainFeatureStudy,
  listMountainRanges,
  listTerrainFeatures,
  loadTerrainDataset,
  loadTerrariumTile,
  sampleTerrainElevation,
  getTerrariumSourceAttributions,
  TERRARIUM_ATTRIBUTION,
  TERRARIUM_ATTRIBUTION_URL,
  TERRARIUM_LICENSE_URL,
} from "./sdk/atlas-terrain.js";

/*
|--------------------------------------------------------------------------
| ATLAS TERRAIN RENDERER
|--------------------------------------------------------------------------
|
| Standalone procedural environmental terrain engine.
|
| Environments:
|
|   mountains
|   valley
|   desert
|   plateau
|   coastal
|   volcanic
|
|--------------------------------------------------------------------------
*/


// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {

  terrain: {
    width: 180,
    depth: 180,

    segments: 180,

    height: 32,

    wireframe: true
  },

  camera: {
    fov: 45,
    near: 0.1,
    far: 1000,

    position: {
      x: 0,
      y: 62,
      z: 115
    }
  },

  fog: {
    near: 100,
    far: 350
  },

  dataUrl: "./data/mountains.json"

};


// ============================================================================
// DATASET
// ============================================================================
//
// Environment definitions are loaded from the terrain dataset in
// `data/mountains.json`. If the dataset cannot be loaded (for example when
// opening index.html directly from the filesystem) the application falls
// back to these built-in defaults.
//
// Dataset fields are mapped onto the renderer parameters as follows:
//
//   generation.height_scale    -> height
//   generation.frequency       -> frequency
//   generation.ridge_strength  -> ridgeStrength
//   generation.valley_strength -> valleyStrength
//   generation.peak_sharpness  -> exponent
//   generation.roughness       -> detailStrength
//   generation.radial_falloff  -> maskStrength
//   visual.palette             -> colors
//
// ============================================================================

const DEFAULT_ENVIRONMENTS = {

  mountains: {

    title: "Mountain Range",

    index: "01",

    mode: "MOUNTAIN RANGE",

    height: 32,

    frequency: 0.035,

    detailFrequency: 0.09,

    microFrequency: 0.22,

    detailStrength: 0.30,

    microStrength: 0.08,

    valleyStrength: 0.30,

    ridgeStrength: 0.24,

    maskStrength: 0.65,

    exponent: 1.65,

    colors: [
      "#17201c",
      "#28342e",
      "#465149",
      "#737d76",
      "#b8beb9",
      "#e2e5e2"
    ]

  },


  valley: {

    title: "Valley",

    index: "02",

    mode: "LOWLAND VALLEY",

    height: 15,

    frequency: 0.028,

    detailFrequency: 0.075,

    microFrequency: 0.18,

    detailStrength: 0.18,

    microStrength: 0.05,

    valleyStrength: 0.60,

    ridgeStrength: 0.08,

    maskStrength: 0.30,

    exponent: 1.15,

    colors: [
      "#17221d",
      "#304238",
      "#526355",
      "#768676",
      "#9ba79b",
      "#c8cec9"
    ]

  },


  desert: {

    title: "Desert",

    index: "03",

    mode: "ARID TERRAIN",

    height: 19,

    frequency: 0.055,

    detailFrequency: 0.12,

    microFrequency: 0.30,

    detailStrength: 0.20,

    microStrength: 0.12,

    valleyStrength: 0.15,

    ridgeStrength: 0.15,

    maskStrength: 0.50,

    exponent: 1.30,

    colors: [
      "#29241d",
      "#51483a",
      "#756650",
      "#98876c",
      "#c0ad8d",
      "#ddd0b6"
    ]

  },


  plateau: {

    title: "Plateau",

    index: "04",

    mode: "ELEVATED FLATLAND",

    height: 27,

    frequency: 0.032,

    detailFrequency: 0.075,

    microFrequency: 0.18,

    detailStrength: 0.16,

    microStrength: 0.04,

    valleyStrength: 0.12,

    ridgeStrength: 0.06,

    maskStrength: 0.45,

    exponent: 0.72,

    colors: [
      "#202721",
      "#374337",
      "#566354",
      "#747f6e",
      "#9ca58f",
      "#c8ccb9"
    ]

  },


  coastal: {

    title: "Coastal",

    index: "05",

    mode: "COASTAL TERRAIN",

    height: 22,

    frequency: 0.045,

    detailFrequency: 0.11,

    microFrequency: 0.25,

    detailStrength: 0.22,

    microStrength: 0.07,

    valleyStrength: 0.25,

    ridgeStrength: 0.14,

    maskStrength: 0.55,

    exponent: 1.35,

    colors: [
      "#101b1d",
      "#263b39",
      "#3f5952",
      "#68766b",
      "#9ca393",
      "#d1d3c5"
    ]

  },


  volcanic: {

    title: "Volcanic",

    index: "06",

    mode: "VOLCANIC LANDSCAPE",

    height: 35,

    frequency: 0.025,

    detailFrequency: 0.08,

    microFrequency: 0.25,

    detailStrength: 0.32,

    microStrength: 0.10,

    valleyStrength: 0.12,

    ridgeStrength: 0.32,

    maskStrength: 0.40,

    exponent: 1.50,

    colors: [
      "#111313",
      "#292b29",
      "#444642",
      "#62645e",
      "#898b81",
      "#b9bab0"
    ]

  }

};


// ============================================================================
// APPLICATION STATE
// ============================================================================

let renderer;

let scene;

let camera;

let controls;

let terrain;

let terrainGeometry;

let terrainMaterial;

let currentEnvironment = "mountains";

let terrainGenerationId = 0;

let terrainRequestId = 0;

let activeTerrainController = null;

let currentElevationTile = null;

let ENVIRONMENTS =
  DEFAULT_ENVIRONMENTS;

let terrainDataset = null;

let activeReference = null;

let autoRotate = true;

let wireframe =
  CONFIG.terrain.wireframe;

let dataSourceLabel =
  "FALLBACK";


// ============================================================================
// INITIALIZATION
// ============================================================================

init();


// ============================================================================
// INIT
// ============================================================================

async function init() {

  try {

    createRenderer();

  }
  catch (error) {

    showError(
      "Your browser could not create a WebGL context, which is required to render the 3D terrain."
    );

    throw error;

  }

  createScene();

  createCamera();

  createLights();

  createControls();

  ENVIRONMENTS =
    await loadEnvironments();

  updateDataSource();

  buildEnvironmentList();

  buildReferencePicker();

  createTerrain(
    currentEnvironment
  );

  bindEnvironmentSwitcher();

  bindReferencePicker();

  bindViewerActions();

  bindTerrainInspector();

  updateUI(
    currentEnvironment
  );

  hideLoading();

  window.addEventListener(
    "resize",
    handleResize
  );

  animate();

  if (terrainDataset) {
    try {
      applyReferenceStudy(createTerrainFeatureStudy(terrainDataset, "peaks", "everest", ENVIRONMENTS));
    } catch (error) {
      console.warn("Atlas Terrain: initial real elevation study could not be selected.", error);
    }
  }

}


// ============================================================================
// LOAD ENVIRONMENTS FROM DATASET
// ============================================================================

async function loadEnvironments() {

  try {

    terrainDataset =
      await loadTerrainDataset(
        CONFIG.dataUrl
      );


    const environments =
      mapDatasetEnvironments(
        terrainDataset
      );


    if (
      environments &&
      Object.keys(
        environments
      ).length > 0
    ) {

      dataSourceLabel =
        "DATASET";

      return environments;

    }


    throw new Error(
      "Terrain dataset contains no environments"
    );

  }
  catch (error) {

    console.warn(

      "Atlas Terrain: falling back to built-in environment data.",

      error

    );

    terrainDataset = null;


    return DEFAULT_ENVIRONMENTS;

  }

}


// ============================================================================
// MAP DATASET ENVIRONMENTS
// ============================================================================

function mapDatasetEnvironments(
  dataset
) {
  return buildEnvironmentCatalog(
    dataset,
    DEFAULT_ENVIRONMENTS,
    CONFIG.terrain
  );
}


// ============================================================================
// DATA SOURCE INDICATOR
// ============================================================================

function updateDataSource() {

  const element =
    document.getElementById(
      "data-source"
    );


  if (element) {

    element.textContent =
      dataSourceLabel;

  }

}


// ============================================================================
// BUILD ENVIRONMENT LIST UI
// ============================================================================

function buildEnvironmentList() {

  const list =
    document.querySelector(
      ".environment-list"
    );


  if (!list) {
    return;
  }


  list.textContent =
    "";


  Object.keys(
    ENVIRONMENTS
  ).forEach(

    key => {

      const environment =
        ENVIRONMENTS[key];


      const button =
        document.createElement(
          "button"
        );


      button.className =

        "environment-option" +

        (
          key === currentEnvironment
            ? " active"
            : ""
        );


      button.type =
        "button";


      button.dataset.environment =
        key;


      const number =
        document.createElement(
          "span"
        );


      number.className =
        "option-number";


      number.textContent =
        environment.index;


      const content =
        document.createElement(
          "span"
        );


      content.className =
        "option-content";


      const title =
        document.createElement(
          "span"
        );


      title.className =
        "option-title";


      title.textContent =
        environment.title;


      const description =
        document.createElement(
          "span"
        );


      description.className =
        "option-description";


      description.textContent =
        environment.description;


      content.appendChild(
        title
      );


      content.appendChild(
        description
      );


      const arrow =
        document.createElement(
          "span"
        );


      arrow.className =
        "option-arrow";


      arrow.textContent =
        "→";


      button.appendChild(
        number
      );


      button.appendChild(
        content
      );


      button.appendChild(
        arrow
      );


      list.appendChild(
        button
      );

    }

  );

}


function buildReferencePicker(query = "") {

  const picker =
    document.getElementById("reference-picker");

  const count =
    document.getElementById("reference-count");

  if (!picker) return;

  const normalizedQuery =
    query.trim().toLocaleLowerCase();

  picker.replaceChildren();

  const placeholder =
    document.createElement("option");

  placeholder.value = "";
  placeholder.textContent = terrainDataset
    ? "Choose a mountain system or landmark"
    : "Reference data unavailable";
  picker.appendChild(placeholder);

  if (!terrainDataset) {
    picker.disabled = true;
    if (count) count.textContent = "OFFLINE";
    return;
  }

  picker.disabled = false;

  const references = [
    {
      label: "Mountain systems",
      items: listMountainRanges(terrainDataset).map(range => ({
        value: `range:${range.id}`,
        label: range.name,
        search: `${range.name} ${range.region || ""} ${(range.countries || []).join(" ")} ${(range.tags || []).join(" ")}`,
      })),
    },
    {
      label: "Major peaks",
      items: listTerrainFeatures(terrainDataset, "peaks").map(feature => ({
        value: `peaks:${feature.id}`,
        label: `${feature.name} · ${feature.elevation_m.toLocaleString()} m`,
        search: `${feature.name} ${feature.country || ""} ${feature.type || ""}`,
      })),
    },
    {
      label: "Volcanoes",
      items: listTerrainFeatures(terrainDataset, "volcanoes").map(feature => ({
        value: `volcanoes:${feature.id}`,
        label: `${feature.name} · ${feature.elevation_m.toLocaleString()} m`,
        search: `${feature.name} ${feature.country || ""} ${feature.type || ""}`,
      })),
    },
  ];

  let resultCount = 0;

  references.forEach(group => {
    const items = group.items.filter(item => !normalizedQuery || item.search.toLocaleLowerCase().includes(normalizedQuery));
    if (!items.length) return;

    const optionGroup =
      document.createElement("optgroup");

    optionGroup.label = group.label;

    items.forEach(item => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      if (`${activeReference?.collection || ""}:${activeReference?.id || ""}` === item.value) option.selected = true;
      optionGroup.appendChild(option);
      resultCount += 1;
    });

    picker.appendChild(optionGroup);
  });

  if (count) count.textContent = `${resultCount} REFERENCES`;
}


function updateReferenceDetails(study) {

  const details =
    document.getElementById("reference-detail");

  if (!details) return;

  const reference = study?.reference;

  details.hidden = !reference;

  if (!reference) return;

  const title = document.getElementById("reference-title");
  const type = document.getElementById("reference-type");
  const description = document.getElementById("reference-description");
  const facts = document.getElementById("reference-facts");
  const sources = document.getElementById("reference-sources");

  if (title) title.textContent = reference.name;
  if (type) type.textContent = currentElevationTile ? "MEASURED DEM · LIVE TILE" : "REAL-WORLD ELEVATION STUDY";
  if (description) description.textContent = study.description;

  if (facts && reference.kind === "mountain-range") {
    const peak = reference.highestPeak;
    facts.textContent = [
      reference.region,
      reference.countries.join(" · "),
      peak ? `${peak.name} · ${peak.elevation_m.toLocaleString()} m` : "Peak elevation unavailable",
      reference.lengthKm ? `${reference.lengthKm.toLocaleString()} km system length` : "Length unavailable",
      reference.tectonicContext,
    ].filter(Boolean).join("\n");
  } else if (facts) {
    const coordinates = Number.isFinite(reference.latitude) && Number.isFinite(reference.longitude)
      ? `${Math.abs(reference.latitude).toFixed(3)}°${reference.latitude < 0 ? "S" : "N"}, ${Math.abs(reference.longitude).toFixed(3)}°${reference.longitude < 0 ? "W" : "E"}`
      : "Coordinates not supplied";
    facts.textContent = [
      reference.country,
      `${reference.elevationM.toLocaleString()} m reference elevation`,
      reference.featureType,
      coordinates,
    ].filter(Boolean).join("\n");
  }

  const demStatus = document.getElementById("reference-dem-status");
  if (demStatus) {
    if (currentElevationTile) {
      const latitude = reference.latitude;
      const longitude = reference.longitude;
      const centerElevation = sampleTerrainElevation(
        currentElevationTile,
        currentElevationTile.pixelX / currentElevationTile.width,
        currentElevationTile.pixelY / currentElevationTile.height,
      );
      const tileSpanKm = 40075.017 * Math.cos(latitude * Math.PI / 180) / (2 ** currentElevationTile.zoom);
      demStatus.textContent = [
        `${currentElevationTile.zoom}z elevation tile · ${tileSpanKm.toFixed(1)} km wide`,
        `DEM range ${Math.round(currentElevationTile.minimumElevationM).toLocaleString()}–${Math.round(currentElevationTile.maximumElevationM).toLocaleString()} m`,
        Number.isFinite(centerElevation) ? `Center sample ${Math.round(centerElevation).toLocaleString()} m` : "Center sample unavailable",
        Number.isFinite(reference.elevationM) ? `Catalog summit ${Math.round(reference.elevationM).toLocaleString()} m (independent reference)` : null,
        `View center ${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
        currentElevationTile.imagerySources ? `Terrain inputs: ${currentElevationTile.imagerySources}` : "Terrain inputs vary by tile (SRTM / GMTED / ETOPO1)",
        "Surface height uses 2× vertical exaggeration",
      ].join("\n");
    } else {
      demStatus.textContent = "Loading measured elevation data…";
    }
  }

  if (sources) {
    sources.replaceChildren();
    const heading = document.createElement("span");
    heading.className = "reference-sources-heading";
    heading.textContent = "DATA REFERENCES";
    sources.appendChild(heading);
    const demLink = document.createElement("a");
    demLink.href = TERRARIUM_ATTRIBUTION_URL;
    demLink.target = "_blank";
    demLink.rel = "noopener noreferrer";
    demLink.textContent = currentElevationTile ? TERRARIUM_ATTRIBUTION : "Elevation source: Mapzen / AWS Open Data terrain tiles";
    sources.appendChild(demLink);
    if (currentElevationTile) {
      for (const attribution of getTerrariumSourceAttributions(currentElevationTile.imagerySources)) {
        const credit = document.createElement("span");
        credit.className = "terrain-source-credit";
        credit.textContent = attribution;
        sources.appendChild(credit);
      }
    }
    const licenseLink = document.createElement("a");
    licenseLink.href = TERRARIUM_LICENSE_URL;
    licenseLink.target = "_blank";
    licenseLink.rel = "noopener noreferrer";
    licenseLink.textContent = "Source-specific attribution and licenses";
    sources.appendChild(licenseLink);
    for (const source of terrainDataset?.sources || []) {
      const sourceUrl = new URL(source.url);
      if (sourceUrl.protocol !== "https:") continue;
      const link = document.createElement("a");
      link.href = sourceUrl.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = source.name;
      sources.appendChild(link);
    }
  }
}


async function applyReferenceStudy(study) {
  const previousReference = activeReference;
  const previousElevationTile = currentElevationTile;
  const previousEnvironment = currentEnvironment;
  const previousDataSource = document.getElementById("data-source")?.textContent || dataSourceLabel;
  const requestedReference = {
    ...study.reference,
    collection: study.reference.kind === "mountain-range" ? "range" : study.reference.kind === "volcano" ? "volcanoes" : "peaks",
  };
  currentEnvironment = study.reference.environment;
  const requestId = ++terrainRequestId;

  const picker = document.getElementById("reference-picker");
  if (picker && [...picker.options].some(option => option.value === `${requestedReference.collection}:${requestedReference.id}`)) {
    picker.value = `${requestedReference.collection}:${requestedReference.id}`;
  }

  showLoading("LOADING REAL ELEVATION TILE");
  activeTerrainController?.abort();
  activeTerrainController = new AbortController();
  const status = document.getElementById("renderer-status");
  if (status) status.textContent = "FETCHING DEM";
  try {
    if (!Number.isFinite(study.reference.latitude) || !Number.isFinite(study.reference.longitude)) {
      throw new Error("This reference has no coordinates for an elevation lookup.");
    }
    const tile = await loadTerrariumTile(study.reference.latitude, study.reference.longitude, {
      zoom: 9,
      signal: activeTerrainController.signal,
    });
    if (requestId !== terrainRequestId) return false;
    currentElevationTile = tile;
    const realStudy = { ...study, wireframe: false, dataType: tile.dataType };
    activeReference = { ...requestedReference, dataType: tile.dataType, tileZoom: tile.zoom };
    createTerrain(currentEnvironment, realStudy, tile);
    updateUI(currentEnvironment, realStudy);
    const dataSource = document.getElementById("data-source");
    if (dataSource) dataSource.textContent = "LIVE DEM";
    if (status) status.textContent = "LIVE ELEVATION";
    updateReferenceDetails(realStudy);
    hideLoading();
    return true;
  } catch (error) {
    if (requestId !== terrainRequestId) return false;
    console.error("Atlas Terrain: real elevation tile could not be loaded.", error);
    activeReference = previousReference || requestedReference;
    currentElevationTile = previousElevationTile;
    currentEnvironment = previousEnvironment;
    const picker = document.getElementById("reference-picker");
    if (picker) picker.value = previousReference ? `${previousReference.collection}:${previousReference.id}` : `${requestedReference.collection}:${requestedReference.id}`;
    const previousStudy = previousReference
      ? previousReference.collection === "range"
        ? createMountainRangeStudy(terrainDataset, previousReference.id, ENVIRONMENTS)
        : createTerrainFeatureStudy(terrainDataset, previousReference.collection, previousReference.id, ENVIRONMENTS)
      : study;
    updateUI(previousEnvironment, previousStudy);
    const dataSource = document.getElementById("data-source");
    if (dataSource) dataSource.textContent = previousElevationTile ? previousDataSource : "PROCEDURAL PREVIEW";
    const terrainMode = document.getElementById("terrain-mode");
    if (terrainMode && !previousElevationTile) terrainMode.textContent = "DEM UNAVAILABLE · PROCEDURAL";
    const message = document.getElementById("reference-dem-status");
    if (message) message.textContent = `Could not load a DEM tile for ${requestedReference.name}: ${error.message}. Kept ${previousReference?.name || "the existing procedural scene"}; select this feature again to retry.`;
    if (status) status.textContent = "DEM LOAD FAILED";
    hideLoading();
    return false;
  }
}


function bindReferencePicker() {

  const search = document.getElementById("reference-search");
  const picker = document.getElementById("reference-picker");

  if (search) search.addEventListener("input", () => buildReferencePicker(search.value));

  if (picker) picker.addEventListener("change", () => {
    if (!terrainDataset || !picker.value) return;
    const [collection, id] = picker.value.split(":");
    const study = collection === "range"
      ? createMountainRangeStudy(terrainDataset, id, ENVIRONMENTS)
      : createTerrainFeatureStudy(terrainDataset, collection, id, ENVIRONMENTS);
    void applyReferenceStudy(study);
  });
}


function bindTerrainInspector() {
  const canvas = renderer?.domElement;
  const readout = document.getElementById("terrain-inspector");
  const coordinates = document.getElementById("terrain-inspector-coordinates");
  const elevation = document.getElementById("terrain-inspector-elevation");
  if (!canvas || !readout || !coordinates || !elevation) return;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  canvas.addEventListener("pointermove", event => {
    const tile = currentElevationTile;
    if (!tile || !terrain) {
      readout.hidden = true;
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(terrain, false)[0];
    if (!hit) {
      readout.hidden = true;
      return;
    }

    const u = THREE.MathUtils.clamp(hit.point.x / CONFIG.terrain.width + 0.5, 0, 1);
    const v = THREE.MathUtils.clamp(hit.point.z / CONFIG.terrain.depth + 0.5, 0, 1);
    const tileCount = 2 ** tile.zoom;
    const longitude = (tile.x + u) / tileCount * 360 - 180;
    const tileY = tile.y + v;
    const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY / tileCount))) * 180 / Math.PI;
    const sampledElevation = sampleTerrainElevation(tile, u, v);
    coordinates.textContent = `${Math.abs(latitude).toFixed(4)}°${latitude < 0 ? "S" : "N"}  ${Math.abs(longitude).toFixed(4)}°${longitude < 0 ? "W" : "E"}`;
    elevation.textContent = `${Math.round(sampledElevation).toLocaleString()} m`;
    readout.hidden = false;
  });

  canvas.addEventListener("pointerleave", () => {
    readout.hidden = true;
  });
}


// ============================================================================
// RENDERER
// ============================================================================

function createRenderer() {

  renderer =
    new THREE.WebGLRenderer({

      antialias: true,

      powerPreference:
        "high-performance"

    });


  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      2
    )
  );


  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );


  renderer.setClearColor(
    0x080b0c,
    1
  );


  renderer.outputColorSpace =
    THREE.SRGBColorSpace;


  renderer.shadowMap.enabled =
    true;


  renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;


  const viewport =
    document.getElementById(
      "terrain-viewer"
    );


  viewport.appendChild(
    renderer.domElement
  );

}


// ============================================================================
// SCENE
// ============================================================================

function createScene() {

  scene =
    new THREE.Scene();


  scene.background =
    new THREE.Color(
      0x080b0c
    );


  scene.fog =
    new THREE.Fog(
      0x080b0c,
      CONFIG.fog.near,
      CONFIG.fog.far
    );

}


// ============================================================================
// CAMERA
// ============================================================================

function createCamera() {

  camera =
    new THREE.PerspectiveCamera(

      CONFIG.camera.fov,

      window.innerWidth /
        window.innerHeight,

      CONFIG.camera.near,

      CONFIG.camera.far

    );


  camera.position.set(

    CONFIG.camera.position.x,

    CONFIG.camera.position.y,

    CONFIG.camera.position.z

  );


  camera.lookAt(
    0,
    5,
    0
  );

}


// ============================================================================
// LIGHTING
// ============================================================================

function createLights() {

  const hemisphere =
    new THREE.HemisphereLight(

      0xb6c1bb,

      0x111413,

      1.2

    );


  scene.add(
    hemisphere
  );


  const ambient =
    new THREE.AmbientLight(

      0x303633,

      0.55

    );


  scene.add(
    ambient
  );


  const sun =
    new THREE.DirectionalLight(

      0xffffff,

      2.7

    );


  sun.position.set(

    -70,
    110,
    -80

  );


  sun.castShadow =
    true;


  sun.shadow.mapSize.width =
    2048;


  sun.shadow.mapSize.height =
    2048;


  sun.shadow.camera.near =
    1;


  sun.shadow.camera.far =
    400;


  sun.shadow.camera.left =
    -150;


  sun.shadow.camera.right =
    150;


  sun.shadow.camera.top =
    150;


  sun.shadow.camera.bottom =
    -150;


  scene.add(
    sun
  );

}


// ============================================================================
// CONTROLS
// ============================================================================

function createControls() {

  controls =
    new OrbitControls(

      camera,

      renderer.domElement

    );


  controls.enableDamping =
    true;


  controls.dampingFactor =
    0.055;


  controls.enablePan =
    true;


  controls.minDistance =
    18;


  controls.maxDistance =
    320;


  controls.maxPolarAngle =
    Math.PI * 0.49;


  controls.autoRotate =
    autoRotate;


  controls.autoRotateSpeed =
    0.6;


  controls.target.set(
    0,
    6,
    0
  );


  controls.update();


  // Pause auto-rotation while the user is interacting
  // with the viewer, then resume shortly afterwards.

  let resumeTimeout;


  controls.addEventListener(
    "start",
    () => {

      controls.autoRotate =
        false;

      clearTimeout(
        resumeTimeout
      );

    }
  );


  controls.addEventListener(
    "end",
    () => {

      clearTimeout(
        resumeTimeout
      );


      resumeTimeout =
        setTimeout(
          () => {

            controls.autoRotate =
              autoRotate;

          },
          2500
        );

    }
  );

}


// ============================================================================
// VIEWER ACTIONS (RESET VIEW / WIREFRAME / AUTO-ROTATE)
// ============================================================================

function bindViewerActions() {

  const resetButton =
    document.getElementById(
      "reset-view"
    );


  const wireframeButton =
    document.getElementById(
      "toggle-wireframe"
    );


  const rotateButton =
    document.getElementById(
      "toggle-rotate"
    );


  if (resetButton) {

    resetButton.addEventListener(
      "click",
      () => {

        camera.position.set(

          CONFIG.camera.position.x,

          CONFIG.camera.position.y,

          CONFIG.camera.position.z

        );


        controls.target.set(
          0,
          6,
          0
        );


        controls.update();

      }
    );

  }


  if (wireframeButton) {

    updateToggleButton(
      wireframeButton,
      wireframe
    );


    wireframeButton.addEventListener(
      "click",
      () => {

        wireframe =
          !wireframe;


        if (terrainMaterial) {

          terrainMaterial.wireframe =
            wireframe;

          terrainMaterial.needsUpdate =
            true;

        }


        updateToggleButton(
          wireframeButton,
          wireframe
        );

      }
    );

  }


  if (rotateButton) {

    updateToggleButton(
      rotateButton,
      autoRotate
    );


    rotateButton.addEventListener(
      "click",
      () => {

        autoRotate =
          !autoRotate;


        controls.autoRotate =
          autoRotate;


        updateToggleButton(
          rotateButton,
          autoRotate
        );

      }
    );

  }

}


// ============================================================================
// TOGGLE BUTTON STATE
// ============================================================================

function updateToggleButton(
  button,
  enabled
) {

  button.classList.toggle(
    "active",
    enabled
  );


  button.setAttribute(

    "aria-pressed",

    enabled
      ? "true"
      : "false"

  );


  const state =
    button.querySelector(
      ".action-state"
    );


  if (state) {

    state.textContent =
      enabled
        ? "ON"
        : "OFF";

  }

}


// ============================================================================
// CREATE TERRAIN
// ============================================================================

function createTerrain(
  environmentName,
  preset = null,
  elevationModel = null,
) {

  let environment =
    preset || ENVIRONMENTS[environmentName];


  if (!environment) {
    return;
  }


  terrainGenerationId++;


  const generationId =
    terrainGenerationId;


  // ------------------------------------------------------------
  // Remove existing terrain
  // ------------------------------------------------------------

  if (terrain) {

    scene.remove(
      terrain
    );


    terrain.geometry.dispose();

    terrain.material.dispose();

  }


  // ------------------------------------------------------------
  // Geometry
  // ------------------------------------------------------------

  terrainGeometry =
    new THREE.PlaneGeometry(

      CONFIG.terrain.width,

      CONFIG.terrain.depth,

      CONFIG.terrain.segments,

      CONFIG.terrain.segments

    );


  terrainGeometry.rotateX(
    -Math.PI / 2
  );


  // ------------------------------------------------------------
  // Elevation
  // ------------------------------------------------------------

  const realReliefHeight = generateElevation(
    terrainGeometry,
    environment,
    environmentName,
    elevationModel,
  );

  if (elevationModel) {
    environment = { ...environment, height: Math.max(realReliefHeight, 1), wireframe: false };
  }


  // ------------------------------------------------------------
  // Colors
  // ------------------------------------------------------------

  generateColors(
    terrainGeometry,
    environment
  );


  // ------------------------------------------------------------
  // Material
  // ------------------------------------------------------------

  wireframe =
    elevationModel ? false : environment.wireframe ??
    wireframe;


  const wireframeButton =
    document.getElementById(
      "toggle-wireframe"
    );


  if (wireframeButton) {

    updateToggleButton(
      wireframeButton,
      wireframe
    );

  }


  terrainMaterial =
    new THREE.MeshStandardMaterial({

      vertexColors: true,

      wireframe:
        wireframe,

      roughness: 1,

      metalness: 0

    });


  // ------------------------------------------------------------
  // Mesh
  // ------------------------------------------------------------

  terrain =
    new THREE.Mesh(

      terrainGeometry,

      terrainMaterial

    );

  terrain.userData.elevationTile = elevationModel;


  terrain.castShadow =
    true;


  terrain.receiveShadow =
    true;


  scene.add(
    terrain
  );


  currentEnvironment =
    environmentName;


  // ------------------------------------------------------------
  // Small visual transition
  // ------------------------------------------------------------

  terrain.scale.set(
    0.92,
    0.92,
    0.92
  );


  requestAnimationFrame(
    () => {

      if (
        generationId !==
        terrainGenerationId
      ) {
        return;
      }


      terrain.scale.set(
        1,
        1,
        1
      );

    }
  );

}


// ============================================================================
// ELEVATION GENERATOR
// ============================================================================

function generateElevation(
  geometry,
  environment,
  environmentName,
  elevationModel = null,
) {

  const position =
    geometry.attributes.position;

  if (elevationModel) {
    const groundWidthMeters = 40075017 * Math.cos(elevationModel.latitude * Math.PI / 180) / (2 ** elevationModel.zoom);
    const worldPerMeter = CONFIG.terrain.width / groundWidthMeters * 2;
    let maximumHeight = 0;
    for (let index = 0; index < position.count; index += 1) {
      const u = THREE.MathUtils.clamp(position.getX(index) / CONFIG.terrain.width + 0.5, 0, 1);
      const v = THREE.MathUtils.clamp(position.getZ(index) / CONFIG.terrain.depth + 0.5, 0, 1);
      const elevation = sampleTerrainElevation(elevationModel, u, v);
      const relativeHeight = Math.max(0, elevation - elevationModel.minimumElevationM) * worldPerMeter;
      position.setY(index, relativeHeight);
      maximumHeight = Math.max(maximumHeight, relativeHeight);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return maximumHeight;
  }


  const width =
    CONFIG.terrain.width;


  const depth =
    CONFIG.terrain.depth;


  for (
    let i = 0;
    i < position.count;
    i++
  ) {

    const x =
      position.getX(i);


    const z =
      position.getZ(i);


    // ----------------------------------------------------------
    // Base terrain
    // ----------------------------------------------------------

    const base =
      Math.sin(
        x *
        environment.frequency *
        1.7
      ) *
      Math.cos(
        z *
        environment.frequency *
        1.3
      );


    // ----------------------------------------------------------
    // Secondary terrain
    // ----------------------------------------------------------

    const secondary =
      Math.sin(

        x *
        environment.detailFrequency *
        3.7 +

        Math.cos(
          z *
          environment.detailFrequency *
          2.1
        )

      ) *
      Math.cos(

        z *
        environment.detailFrequency *
        2.8

      );


    // ----------------------------------------------------------
    // Broad terrain variation
    // ----------------------------------------------------------

    const tertiary =
      Math.sin(
        x *
        environment.detailFrequency
      ) *
      Math.cos(
        z *
        environment.detailFrequency *
        0.8
      );


    // ----------------------------------------------------------
    // Small terrain detail
    // ----------------------------------------------------------

    const micro =
      Math.sin(

        x *
        environment.microFrequency +

        Math.cos(
          z * 0.13
        )

      ) *
      Math.cos(

        z *
        environment.microFrequency

      );


    // ----------------------------------------------------------
    // Broad landscape mask
    // ----------------------------------------------------------

    const radialDistance =
      Math.sqrt(

        Math.pow(
          x /
          (width * 0.5),
          2
        ) +

        Math.pow(
          z /
          (depth * 0.5),
          2
        )

      );


    const mask =
      Math.max(

        0,

        1 -
        radialDistance *
        environment.maskStrength

      );


    // ----------------------------------------------------------
    // Valley structure
    // ----------------------------------------------------------

    const valley =
      Math.abs(

        Math.sin(
          x * 0.055
        ) *

        Math.cos(
          z * 0.047
        )

      );


    // ----------------------------------------------------------
    // Primary elevation
    // ----------------------------------------------------------

    let elevation =

      base * 0.45 +

      secondary *
      environment.detailStrength +

      tertiary * 0.25 +

      micro *
      environment.microStrength;


    elevation *=
      mask;


    elevation +=

      valley *

      environment.valleyStrength *

      mask;


    // ----------------------------------------------------------
    // Ridge generation
    // ----------------------------------------------------------

    const ridge =

      1 -

      Math.abs(

        Math.sin(
          x * 0.035
        )

      );


    elevation +=

      ridge *

      environment.ridgeStrength *

      mask;


    // ----------------------------------------------------------
    // Environment-specific terrain
    // ----------------------------------------------------------

    switch (
      environmentName
    ) {

      case "mountains":

        elevation +=
          createMountainPeaks(
            x,
            z
          ) *
          0.30;

        break;


      case "valley":

        elevation -=
          createValleyFloor(
            x,
            z
          ) *
          0.35;

        break;


      case "desert":

        elevation +=
          createDunes(
            x,
            z
          ) *
          0.22;

        break;


      case "plateau":

        elevation =
          createPlateau(
            elevation
          );

        break;


      case "coastal":

        elevation =
          createCoastline(
            x,
            z,
            elevation
          );

        break;


      case "volcanic":

        elevation =
          createVolcanicTerrain(
            x,
            z,
            elevation
          );

        break;

    }


    // ----------------------------------------------------------
    // Normalize
    // ----------------------------------------------------------

    elevation =
      (elevation + 1) *
      0.5;


    elevation =
      THREE.MathUtils.clamp(
        elevation,
        0,
        1
      );


    // ----------------------------------------------------------
    // Elevation curve
    // ----------------------------------------------------------

    elevation =
      Math.pow(
        elevation,
        environment.exponent
      );


    const y =
      elevation *
      environment.height;


    position.setY(
      i,
      y
    );

  }


  position.needsUpdate =
    true;


  geometry.computeVertexNormals();

  return null;

}


// ============================================================================
// MOUNTAIN PEAKS
// ============================================================================

function createMountainPeaks(
  x,
  z
) {

  const peak1 =
    Math.exp(
      -(
        Math.pow(
          x - 35,
          2
        ) +
        Math.pow(
          z + 15,
          2
        )
      ) /
      1200
    );


  const peak2 =
    Math.exp(
      -(
        Math.pow(
          x + 30,
          2
        ) +
        Math.pow(
          z - 20,
          2
        )
      ) /
      1700
    );


  const peak3 =
    Math.exp(
      -(
        Math.pow(
          x - 5,
          2
        ) +
        Math.pow(
          z - 45,
          2
        )
      ) /
      900
    );


  return (
    peak1 +
    peak2 +
    peak3
  );

}


// ============================================================================
// VALLEY FLOOR
// ============================================================================

function createValleyFloor(
  x,
  z
) {

  const valley =
    Math.sin(
      x * 0.025
    ) *
    Math.cos(
      z * 0.035
    );


  return Math.abs(
    valley
  );

}


// ============================================================================
// DESERT DUNES
// ============================================================================

function createDunes(
  x,
  z
) {

  return (

    Math.sin(
      x * 0.075 +
      Math.sin(z * 0.025)
    ) *

    Math.cos(
      z * 0.045
    )

  );

}


// ============================================================================
// PLATEAU
// ============================================================================

function createPlateau(
  elevation
) {

  const threshold =
    0.58;


  if (
    elevation >
    threshold
  ) {

    const compression =
      (elevation - threshold) *
      0.25;


    return (
      threshold +
      compression
    );

  }


  return elevation;

}


// ============================================================================
// COASTLINE
// ============================================================================

function createCoastline(
  x,
  z,
  elevation
) {

  const coast =
    Math.sin(
      x * 0.025
    ) *
    0.15;


  return (
    elevation +
    coast
  );

}


// ============================================================================
// VOLCANIC TERRAIN
// ============================================================================

function createVolcanicTerrain(
  x,
  z,
  elevation
) {

  const radius =
    Math.sqrt(
      x * x +
      z * z
    );


  const volcano =
    Math.max(
      0,
      1 -
      radius / 65
    );


  const crater =
    Math.exp(
      -Math.pow(
        radius - 25,
        2
      ) /
      80
    );


  return (

    elevation +

    volcano *
    0.55 -

    crater *
    0.35

  );

}


// ============================================================================
// TERRAIN COLORS
// ============================================================================

function generateColors(
  geometry,
  environment
) {

  const position =
    geometry.attributes.position;


  const colors =
    new Float32Array(
      position.count * 3
    );


  const palette =
    environment.colors.map(
      color =>
        new THREE.Color(
          color
        )
    );


  const color =
    new THREE.Color();


  for (
    let i = 0;
    i < position.count;
    i++
  ) {

    const elevation =
      THREE.MathUtils.clamp(

        position.getY(i) /
        environment.height,

        0,
        1

      );


    const scaled =
      elevation *
      (palette.length - 1);


    const lower =
      Math.floor(
        scaled
      );


    const upper =
      Math.min(
        lower + 1,
        palette.length - 1
      );


    const amount =
      scaled -
      lower;


    color.lerpColors(

      palette[lower],

      palette[upper],

      amount

    );


    colors[i * 3] =
      color.r;


    colors[i * 3 + 1] =
      color.g;


    colors[i * 3 + 2] =
      color.b;

  }


  geometry.setAttribute(

    "color",

    new THREE.BufferAttribute(
      colors,
      3
    )

  );

}


// ============================================================================
// ENVIRONMENT SWITCHER
// ============================================================================

function bindEnvironmentSwitcher() {

  const buttons =
    document.querySelectorAll(
      "[data-environment]"
    );


  buttons.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const environment =
            button.dataset.environment;


          if (
            environment === currentEnvironment &&
            !activeReference
          ) {
            return;
          }


          showLoading();

          terrainRequestId += 1;
          activeTerrainController?.abort();


          // Set before generation so environment-specific
          // terrain functions use the correct environment.
          currentEnvironment =
            environment;

          activeReference = null;
          currentElevationTile = null;


          setTimeout(
            () => {

              createTerrain(
                environment
              );


              updateUI(
                environment,
                null
              );

              const dataSource = document.getElementById("data-source");
              if (dataSource) dataSource.textContent = dataSourceLabel;
              const status = document.getElementById("renderer-status");
              if (status) status.textContent = "PROCEDURAL TERRAIN";


              hideLoading();

            },
            30
          );

        }
      );

    }
  );

}


// ============================================================================
// UI
// ============================================================================

function updateUI(
  environmentName,
  preset = null
) {

  const environment =
    ENVIRONMENTS[
      environmentName
    ];


  if (!environment) {
    return;
  }


  const title =
    document.getElementById(
      "environment-title"
    );


  const terrainType =
    document.getElementById(
      "terrain-type"
    );

  const terrainMode =
    document.getElementById("terrain-mode");


  const panelIndex =
    document.querySelector(
      ".panel-index"
    );


  if (title) {

    title.textContent =
      preset?.title || environment.title;

  }


  if (terrainType) {

    terrainType.textContent =
      preset?.mode || environment.mode;

  }

  if (terrainMode) {
    terrainMode.textContent = currentElevationTile ? "LIVE DEM · 2× RELIEF" : preset ? "LOADING DEM" : "PROCEDURAL";
  }


  if (panelIndex) {

    panelIndex.textContent =
      environment.index;

  }


  const buttons =
    document.querySelectorAll(
      "[data-environment]"
    );


  buttons.forEach(
    button => {

      button.classList.toggle(

        "active",

        button.dataset.environment ===
        environmentName

      );

    }
  );

  updateReferenceDetails(preset);

}


// ============================================================================
// LOADING
// ============================================================================

function showLoading(message = "LOADING TERRAIN") {

  const loading =
    document.getElementById(
      "loading"
    );


  if (loading) {

    const label = loading.querySelector("span");
    if (label) label.textContent = message;

    loading.style.opacity =
      "1";

    loading.style.pointerEvents =
      "auto";

  }

}


// ============================================================================
// ERROR STATE
// ============================================================================

function showError(
  message
) {

  const loading =
    document.getElementById(
      "loading"
    );


  if (loading) {

    const label =
      loading.querySelector(
        "span"
      );


    if (label) {

      label.textContent =
        message;

    }


    loading.classList.add(
      "error"
    );

  }


  const status =
    document.getElementById(
      "renderer-status"
    );


  if (status) {

    status.textContent =
      "RENDERER UNAVAILABLE";

  }

}


// ============================================================================
// HIDE LOADING
// ============================================================================

function hideLoading() {

  const loading =
    document.getElementById(
      "loading"
    );


  if (!loading) {
    return;
  }


  loading.style.opacity =
    "0";


  loading.style.pointerEvents =
    "none";

}


// ============================================================================
// RESIZE
// ============================================================================

function handleResize() {

  camera.aspect =
    window.innerWidth /
    window.innerHeight;


  camera.updateProjectionMatrix();


  renderer.setSize(

    window.innerWidth,

    window.innerHeight

  );


  renderer.setPixelRatio(

    Math.min(

      window.devicePixelRatio || 1,

      2

    )

  );

}


// ============================================================================
// ANIMATION
// ============================================================================

function animate() {

  requestAnimationFrame(
    animate
  );


  if (controls) {

    controls.update();

  }


  renderer.render(

    scene,

    camera

  );

}


// ============================================================================
// PUBLIC API
// ============================================================================

window.AtlasTerrain = {

  setEnvironment(
    environment
  ) {

    if (
      ENVIRONMENTS[
        environment
      ]
    ) {

      currentEnvironment =
        environment;

      terrainRequestId += 1;
      activeTerrainController?.abort();
      currentElevationTile = null;
      activeReference = null;

      createTerrain(
        environment
      );

      updateUI(
        environment
      );

      const picker = document.getElementById("reference-picker");
      if (picker) picker.value = "";
      const dataSource = document.getElementById("data-source");
      if (dataSource) dataSource.textContent = dataSourceLabel;
      const status = document.getElementById("renderer-status");
      if (status) status.textContent = "PROCEDURAL TERRAIN";

    }

  },


  getEnvironment() {

    return currentEnvironment;

  },


  getEnvironments() {

    return Object.keys(
      ENVIRONMENTS
    );

  },


  getMountainRanges() {
    return terrainDataset ? listMountainRanges(terrainDataset) : [];
  },


  getTerrainFeatures(type) {
    return terrainDataset ? listTerrainFeatures(terrainDataset, type) : [];
  },


  async selectMountainRange(id) {
    if (!terrainDataset) return false;
    try {
      return await applyReferenceStudy(createMountainRangeStudy(terrainDataset, id, ENVIRONMENTS));
    } catch (error) {
      console.warn("Atlas Terrain: mountain range could not be selected.", error);
      return false;
    }
  },


  async selectTerrainFeature(type, id) {
    if (!terrainDataset) return false;
    try {
      return await applyReferenceStudy(createTerrainFeatureStudy(terrainDataset, type, id, ENVIRONMENTS));
    } catch (error) {
      console.warn("Atlas Terrain: terrain feature could not be selected.", error);
      return false;
    }
  },


  getCurrentStudy() {
    return activeReference ? {
      ...activeReference,
      countries: activeReference.countries ? [...activeReference.countries] : undefined,
      tags: activeReference.tags ? [...activeReference.tags] : undefined,
      highestPeak: activeReference.highestPeak ? { ...activeReference.highestPeak } : undefined,
      elevation: currentElevationTile ? {
        zoom: currentElevationTile.zoom,
        minimumElevationM: currentElevationTile.minimumElevationM,
        maximumElevationM: currentElevationTile.maximumElevationM,
        imagerySources: currentElevationTile.imagerySources,
        attribution: currentElevationTile.attribution,
        attributionUrl: currentElevationTile.attributionUrl,
      } : null,
    } : {
      kind: "environment",
      id: currentEnvironment,
      name: ENVIRONMENTS[currentEnvironment]?.title || currentEnvironment,
      dataType: "procedural",
    };
  }

};
