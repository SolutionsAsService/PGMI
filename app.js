
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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

let ENVIRONMENTS =
  DEFAULT_ENVIRONMENTS;

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

  createTerrain(
    currentEnvironment
  );

  bindEnvironmentSwitcher();

  bindViewerActions();

  updateUI(
    currentEnvironment
  );

  hideLoading();

  window.addEventListener(
    "resize",
    handleResize
  );

  animate();

}


// ============================================================================
// LOAD ENVIRONMENTS FROM DATASET
// ============================================================================

async function loadEnvironments() {

  try {

    const response =
      await fetch(
        CONFIG.dataUrl
      );


    if (!response.ok) {

      throw new Error(
        "Failed to load terrain data: " +
        response.status
      );

    }


    const dataset =
      await response.json();


    const environments =
      mapDatasetEnvironments(
        dataset
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


    return DEFAULT_ENVIRONMENTS;

  }

}


// ============================================================================
// MAP DATASET ENVIRONMENTS
// ============================================================================

function mapDatasetEnvironments(
  dataset
) {

  const source =
    dataset &&
    dataset.environments;


  if (!source) {
    return null;
  }


  const mapped =
    {};


  Object.keys(
    source
  ).forEach(

    (key, position) => {

      const entry =
        source[key];


      const generation =
        entry.generation || {};


      const visual =
        entry.visual || {};


      const fallback =
        DEFAULT_ENVIRONMENTS[
          key
        ] || {};


      mapped[key] = {

        title:
          entry.name ||
          fallback.title ||
          key,

        index:
          String(
            position + 1
          ).padStart(
            2,
            "0"
          ),

        mode:
          entry.mode_label ||
          fallback.mode ||
          key.toUpperCase(),

        description:
          entry.description ||
          fallback.description ||
          "",

        height:
          generation.height_scale ??
          fallback.height ??
          20,

        frequency:
          generation.frequency ??
          fallback.frequency ??
          0.04,

        detailFrequency:
          (generation.frequency ??
            fallback.frequency ??
            0.04) * 2.2,

        microFrequency:
          (generation.frequency ??
            fallback.frequency ??
            0.04) * 5,

        detailStrength:
          generation.roughness ??
          fallback.detailStrength ??
          0.2,

        microStrength:
          fallback.microStrength ??
          0.08,

        valleyStrength:
          generation.valley_strength ??
          fallback.valleyStrength ??
          0.3,

        ridgeStrength:
          generation.ridge_strength ??
          fallback.ridgeStrength ??
          0.2,

        maskStrength:
          generation.radial_falloff ??
          fallback.maskStrength ??
          0.5,

        exponent:
          generation.peak_sharpness ??
          fallback.exponent ??
          1.4,

        wireframe:
          visual.wireframe ??
          fallback.wireframe ??
          CONFIG.terrain.wireframe,

        colors:
          (
            Array.isArray(
              visual.palette
            ) &&
            visual.palette.length > 0
          )
            ? visual.palette
            : (
              fallback.colors ||
              DEFAULT_ENVIRONMENTS
                .mountains.colors
            )

      };

    }

  );


  return mapped;

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
  environmentName
) {

  const environment =
    ENVIRONMENTS[
      environmentName
    ];


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

  generateElevation(
    terrainGeometry,
    environment,
    environmentName
  );


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
    environment.wireframe ??
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
  environmentName
) {

  const position =
    geometry.attributes.position;


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
            environment ===
            currentEnvironment
          ) {
            return;
          }


          showLoading();


          // Set before generation so environment-specific
          // terrain functions use the correct environment.
          currentEnvironment =
            environment;


          setTimeout(
            () => {

              createTerrain(
                environment
              );


              updateUI(
                environment
              );


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
  environmentName
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


  const panelIndex =
    document.querySelector(
      ".panel-index"
    );


  if (title) {

    title.textContent =
      environment.title;

  }


  if (terrainType) {

    terrainType.textContent =
      environment.mode;

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

}


// ============================================================================
// LOADING
// ============================================================================

function showLoading() {

  const loading =
    document.getElementById(
      "loading"
    );


  if (loading) {

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

      createTerrain(
        environment
      );

      updateUI(
        environment
      );

    }

  },


  getEnvironment() {

    return currentEnvironment;

  },


  getEnvironments() {

    return Object.keys(
      ENVIRONMENTS
    );

  }

};

