import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/*
|--------------------------------------------------------------------------
| Terrain Renderer
|--------------------------------------------------------------------------
|
| Standalone procedural 3D terrain renderer.
|
| Intended architecture:
|
|   Atlas
|      |
|      +--> Map / Geographic Renderer
|      |
|      +--> Terrain Renderer
|              |
|              +--> DEM / elevation data
|              +--> Procedural terrain
|              +--> Terrain materials
|              +--> Camera
|              +--> Lighting
|
|--------------------------------------------------------------------------
*/

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const CONFIG = {
  terrain: {
    width: 160,
    depth: 160,

    // Number of vertices across the terrain.
    // Higher = more detail, lower = better performance.
    segments: 180,

    // Overall mountain height.
    height: 28,

    // Frequency of the primary terrain shape.
    frequency: 0.035,

    // Secondary detail.
    detailFrequency: 0.09,

    // Small-scale terrain variation.
    microFrequency: 0.22,

    // Amount of secondary detail.
    detailStrength: 0.28,

    // Amount of small-scale detail.
    microStrength: 0.08,

    // Valley shaping.
    valleyStrength: 0.25,

    // Wireframe mode.
    wireframe: true,
  },

  camera: {
    fov: 45,
    near: 0.1,
    far: 1000,

    position: {
      x: 0,
      y: 65,
      z: 115,
    },
  },

  fog: {
    color: 0x080b0c,
    near: 100,
    far: 360,
  },

  colors: {
    background: 0x080b0c,

    // Terrain palette.
    deep: new THREE.Color("#18201d"),
    low: new THREE.Color("#26332d"),
    mid: new THREE.Color("#435047"),
    high: new THREE.Color("#778077"),
    peak: new THREE.Color("#c3c8c3"),
    snow: new THREE.Color("#e3e6e3"),
  },
};

// -----------------------------------------------------------------------------
// Application State
// -----------------------------------------------------------------------------

let renderer;
let scene;
let camera;
let controls;

let terrain;
let terrainGeometry;
let terrainMaterial;

let clock;

const app = document.querySelector("#app") || document.body;

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

init();
animate();

// -----------------------------------------------------------------------------
// Init
// -----------------------------------------------------------------------------

function init() {
  clock = new THREE.Clock();

  createRenderer();
  createScene();
  createCamera();
  createLights();
  createTerrain();
  createControls();

  window.addEventListener("resize", handleResize);
}

// -----------------------------------------------------------------------------
// Renderer
// -----------------------------------------------------------------------------

function createRenderer() {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 2)
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.setClearColor(
    CONFIG.colors.background,
    1
  );

  renderer.outputColorSpace = THREE.SRGBColorSpace;

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  app.appendChild(renderer.domElement);

  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
}

// -----------------------------------------------------------------------------
// Scene
// -----------------------------------------------------------------------------

function createScene() {
  scene = new THREE.Scene();

  scene.background = new THREE.Color(
    CONFIG.colors.background
  );

  scene.fog = new THREE.Fog(
    CONFIG.fog.color,
    CONFIG.fog.near,
    CONFIG.fog.far
  );
}

// -----------------------------------------------------------------------------
// Camera
// -----------------------------------------------------------------------------

function createCamera() {
  camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    CONFIG.camera.near,
    CONFIG.camera.far
  );

  camera.position.set(
    CONFIG.camera.position.x,
    CONFIG.camera.position.y,
    CONFIG.camera.position.z
  );

  camera.lookAt(0, 0, 0);
}

// -----------------------------------------------------------------------------
// Lighting
// -----------------------------------------------------------------------------

function createLights() {
  const ambient = new THREE.HemisphereLight(
    0x9ba7a2,
    0x111411,
    1.25
  );

  scene.add(ambient);

  const directional = new THREE.DirectionalLight(
    0xffffff,
    2.5
  );

  directional.position.set(
    -60,
    100,
    -80
  );

  directional.castShadow = true;

  directional.shadow.mapSize.width = 2048;
  directional.shadow.mapSize.height = 2048;

  directional.shadow.camera.near = 1;
  directional.shadow.camera.far = 400;

  directional.shadow.camera.left = -150;
  directional.shadow.camera.right = 150;
  directional.shadow.camera.top = 150;
  directional.shadow.camera.bottom = -150;

  scene.add(directional);
}

// -----------------------------------------------------------------------------
// Controls
// -----------------------------------------------------------------------------

function createControls() {
  controls = new OrbitControls(
    camera,
    renderer.domElement
  );

  controls.enableDamping = true;
  controls.dampingFactor = 0.06;

  controls.enablePan = true;

  controls.minDistance = 20;
  controls.maxDistance = 350;

  controls.maxPolarAngle = Math.PI * 0.49;

  controls.target.set(0, 5, 0);

  controls.update();
}

// -----------------------------------------------------------------------------
// Terrain
// -----------------------------------------------------------------------------

function createTerrain() {
  const {
    width,
    depth,
    segments,
  } = CONFIG.terrain;

  terrainGeometry = new THREE.PlaneGeometry(
    width,
    depth,
    segments,
    segments
  );

  // Rotate horizontal.
  terrainGeometry.rotateX(-Math.PI / 2);

  generateTerrainHeight();

  generateTerrainColors();

  terrainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,

    wireframe: CONFIG.terrain.wireframe,

    roughness: 1,
    metalness: 0,

    flatShading: false,
  });

  terrain = new THREE.Mesh(
    terrainGeometry,
    terrainMaterial
  );

  terrain.receiveShadow = true;
  terrain.castShadow = true;

  scene.add(terrain);
}

// -----------------------------------------------------------------------------
// Terrain Height Generation
// -----------------------------------------------------------------------------

function generateTerrainHeight() {
  const position =
    terrainGeometry.attributes.position;

  const {
    width,
    depth,
    height,
    frequency,
    detailFrequency,
    microFrequency,
    detailStrength,
    microStrength,
    valleyStrength,
  } = CONFIG.terrain;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);

    /*
    --------------------------------------------------------------------------
    Base terrain
    --------------------------------------------------------------------------

    Multiple sine/cosine fields are used here as a lightweight deterministic
    noise approximation.

    Later this function can be replaced by:

      - Simplex noise
      - Perlin noise
      - OpenSimplex
      - DEM raster data
      - Mapbox terrain tiles
      - GeoTIFF elevation data
      - USGS elevation data
    */

    const nx = x * frequency;
    const nz = z * frequency;

    const base =
      Math.sin(nx * 1.7) *
      Math.cos(nz * 1.3);

    const secondary =
      Math.sin(
        nx * 3.7 +
        Math.cos(nz * 2.1)
      ) *
      Math.cos(
        nz * 2.8
      );

    const tertiary =
      Math.sin(
        x * detailFrequency
      ) *
      Math.cos(
        z * detailFrequency * 0.8
      );

    const micro =
      Math.sin(
        x * microFrequency +
        Math.cos(z * 0.13)
      ) *
      Math.cos(
        z * microFrequency
      );

    /*
    --------------------------------------------------------------------------
    Mountain shaping
    --------------------------------------------------------------------------
    */

    const radialDistance =
      Math.sqrt(
        (x / (width * 0.5)) ** 2 +
        (z / (depth * 0.5)) ** 2
      );

    // Creates broader mountainous forms.
    const mountainMask =
      Math.max(
        0,
        1 - radialDistance * 0.65
      );

    // Creates valleys between larger formations.
    const valley =
      Math.abs(
        Math.sin(x * 0.055) *
        Math.cos(z * 0.047)
      );

    let elevation =
      base * 0.45 +
      secondary * detailStrength +
      tertiary * 0.25 +
      micro * microStrength;

    elevation *= mountainMask;

    elevation +=
      valley *
      valleyStrength *
      mountainMask;

    /*
    --------------------------------------------------------------------------
    Ridge shaping
    --------------------------------------------------------------------------
    */

    const ridge =
      1 -
      Math.abs(
        Math.sin(
          x * 0.035
        )
      );

    elevation +=
      ridge *
      0.18 *
      mountainMask;

    /*
    --------------------------------------------------------------------------
    Normalize
    --------------------------------------------------------------------------
    */

    elevation =
      (elevation + 1) * 0.5;

    // Clamp.
    elevation =
      THREE.MathUtils.clamp(
        elevation,
        0,
        1
      );

    // Increase mountain contrast.
    elevation =
      Math.pow(
        elevation,
        1.65
      );

    const y =
      elevation * height;

    position.setY(i, y);
  }

  position.needsUpdate = true;

  terrainGeometry.computeVertexNormals();
}

// -----------------------------------------------------------------------------
// Terrain Colors
// -----------------------------------------------------------------------------

function generateTerrainColors() {
  const position =
    terrainGeometry.attributes.position;

  const colors =
    new Float32Array(
      position.count * 3
    );

  const color =
    new THREE.Color();

  const {
    deep,
    low,
    mid,
    high,
    peak,
    snow,
  } = CONFIG.colors;

  const maxHeight =
    CONFIG.terrain.height;

  for (let i = 0; i < position.count; i++) {
    const y =
      position.getY(i);

    const elevation =
      THREE.MathUtils.clamp(
        y / maxHeight,
        0,
        1
      );

    /*
    --------------------------------------------------------------------------
    Elevation palette
    --------------------------------------------------------------------------
    */

    if (elevation < 0.18) {
      color.copy(deep);
    }

    else if (elevation < 0.38) {
      color.lerpColors(
        deep,
        low,
        (elevation - 0.18) / 0.20
      );
    }

    else if (elevation < 0.60) {
      color.lerpColors(
        low,
        mid,
        (elevation - 0.38) / 0.22
      );
    }

    else if (elevation < 0.78) {
      color.lerpColors(
        mid,
        high,
        (elevation - 0.60) / 0.18
      );
    }

    else if (elevation < 0.91) {
      color.lerpColors(
        high,
        peak,
        (elevation - 0.78) / 0.13
      );
    }

    else {
      color.lerpColors(
        peak,
        snow,
        (elevation - 0.91) / 0.09
      );
    }

    colors[i * 3] =
      color.r;

    colors[i * 3 + 1] =
      color.g;

    colors[i * 3 + 2] =
      color.b;
  }

  terrainGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(
      colors,
      3
    )
  );
}

// -----------------------------------------------------------------------------
// Animation
// -----------------------------------------------------------------------------

function animate() {
  requestAnimationFrame(animate);

  const delta =
    clock.getDelta();

  update(delta);

  renderer.render(
    scene,
    camera
  );
}

// -----------------------------------------------------------------------------
// Update
// -----------------------------------------------------------------------------

function update(delta) {
  if (controls) {
    controls.update();
  }

  /*
  --------------------------------------------------------------------------
  Optional terrain movement
  --------------------------------------------------------------------------

  The original CodePen rotated the entire terrain.

  We don't do that by default because an interactive terrain viewer is more
  useful when the camera moves around the landscape.

  If we want the original effect:

      terrain.rotation.z += delta * 0.2;
  */
}

// -----------------------------------------------------------------------------
// Resize
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export {
  scene,
  camera,
  terrain,
  renderer,
};
