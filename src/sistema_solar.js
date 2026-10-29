import * as THREE from "three";
import { obtenerCuerposColision, resolverColisiones } from "./colisiones.js";
import { CONSTELACIONES_EXTRA, crearAsteroidesAnillosSaturno, crearCampoInterestelar, crearCinturonAsteroides, crearNebulosa, crearViaLactea } from "./cosmos.js";
import { crearEfectoVelocidad } from "./efecto-velocidad.js";
import { detectarObjetivo, DISTANCIA_DETALLE_CONSTELACION } from "./objetivos.js";
import { diasAnimacion, diasSimulados, ELEMENTOS, PERIODOS_LUNAS, posicionEnDias, posicionOrbital, ROTACION_HORAS, VELOCIDADES_SIMULACION } from "./orbitas.js";
import { crearHistoriador } from "./planetas-info.js";

/**
 * PRÁCTICA S6 - INFORMÁTICA GRÁFICA (EII - ULPGC)
 * SISTEMA PLANETARIO INTERACTIVO CON NAVEGACIÓN LIBRE, MODOS DE CÁMARA,
 * CABINA DEL HALCÓN MILENARIO, ZOOM Y DETECCIÓN DE OBJETIVOS,
 * INSTRUCCIONES EN TAB Y VUELO DE PRECISIÓN
 */

// --- VARIABLES GLOBALES DEL SISTEMA ---
let scene, renderer;
let cameraGeneral, cameraShip, activeCamera;
let efectoVelocidad;
const cameraTarget = new THREE.Vector3();

// Grupos principales de los sistemas estelares
let solarSystemGroup, alphaCentauriGroup;

// Objetos astronómicos
let sunMesh, sunGlow, sunLight;
let earthOrbitPivot, earthSystem, earthMesh, earthCloudsMesh;
let moonOrbitPivot, moonMesh;
let alphaStarA, alphaStarB, proximaMesh;
let asteroidBelt;
// Catálogo de cuerpos celestes conocidos para telemetría Sci-Fi
let celestialTargets = [];
let currentLockedTarget = null;

// Configuración de animación y simulación de velocidades
const clock = new THREE.Clock();
let simSpeed = 1; // Multiplicador de animación: ×1, ×2, ×4, ×8 o ×16.
let simulationTimeMode = "animation"; // Animación visible por defecto; 0 activa tiempo real.
let isPaused = false;
let simulationDays = Date.now() / 86400000 + 2440587.5 - 2451545;
let alphaOrbitTime = 0;
// Centro del parabrisas frontal inferior, medido sobre la textura de cabina.
const CABIN_SIGHT = Object.freeze({ x: 813 / 1672, y: 576 / 941 });
// Pantalla azul del salpicadero, en las mismas coordenadas que la textura.
const CABIN_RADAR = Object.freeze({ x: 702 / 1672, y: 743 / 941, width: 58 / 1672, height: 67 / 941 });
let solarRadarContext;
const radarSunPosition = new THREE.Vector3();
const radarShipPosition = new THREE.Vector3();
const radarInverseRotation = new THREE.Quaternion();
// Campo más estrecho: los planetas se ven mayores respecto al marco de la cabina.
const CABIN_FOV = 25;
const PLANET_TEXTURES = {
  mercurio: "2k_mercury.jpg", venus: "2k_venus_atmosphere.jpg", marte: "2k_mars.jpg",
  jupiter: "2k_jupiter.jpg", saturno: "2k_saturn.jpg", urano: "2k_uranus.jpg", neptuno: "2k_neptune.jpg"
};
const ZOOM_LEVELS = [1, 2, 4, 8];
let zoomIndex = 0;

// Vistas general y de cabina.
const VIEW_MODES = {
  GENERAL: "general",
  FIRST_PERSON: "first_person"
};
let currentViewMode = VIEW_MODES.GENERAL;
let isFirstPerson = false; // Compatibilidad con lógica existente


// Grupos para constelaciones zodiacales en la elíptica y universo estelar global
let constellationsGroup = null;
let constellationTargets = [];
let labelsVisible = true;
const constellationLabels = [];
let universeStarsMesh = null;
let planetasSistemaSolar = [];

// Estado del vuelo en primera persona (Nave Espacial / Halcón Milenario)
const ship = {
  position: new THREE.Vector3(0, 5, 80),
  rotation: new THREE.Euler(0, 0, 0, "YXZ"),
  quaternion: new THREE.Quaternion(),
  velocity: new THREE.Vector3(0, 0, 0),
  speed: 0,
  maxSpeed: 15.0,
  acceleration: 10.0,
  boostMaxSpeed: 650.0,
  boostAcceleration: 260.0,
  damping: 0.92,
  pitch: 0,
  yaw: 0,
  roll: 0,
  turnSpeed: 0.0022
};

// WASD y Shift como acelerador, sin desplazamiento vertical.
const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  ShiftLeft: false,
  ShiftRight: false,
  AltLeft: false,
  AltRight: false
};

// Estado del cursor y vista
let isPointerLocked = false;
let pointerLockPending = false;
let pointerLockWanted = false;
let isMouseDown = false;
let previousMousePosition = { x: 0, y: 0 };
let lastClickPoint = null;
let lastClickTime = 0;
let lastClickPlanet = null;
let orientationTransition = null;
let followedPlanet = null;
let generalReticleVisible = false;
let cabinReticleVisible = true;
const generalLook = { yaw: 0, pitch: 0 };
const generalVelocity = new THREE.Vector3();
const generalMousePending = new THREE.Vector2();
const GENERAL_SMOOTHING = 30; // Suavizado breve: aproximadamente 0,1 s para responder al 95 %.
let hudVisible = true;
let previousCollisionCenters = new Map();
let lastCollision = null;
const actualizarHistoria = crearHistoriador();
const POINT_TURN_DURATION = 1.0;

// Coordenadas fijas de los dos sistemas estelares
const ALPHA_CENTAURI_POS = new THREE.Vector3(0, 100, -3200);

// --- INICIALIZACIÓN ---
init();
setupUI();
setupEvents();
animate();

function init() {
  // 1. Escena
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020208, 0.0001);

  // Grupos principales para escalado en el salto
  solarSystemGroup = new THREE.Group();
  scene.add(solarSystemGroup);

  // 2. Cámaras
  const aspect = window.innerWidth / window.innerHeight;
  cameraGeneral = new THREE.PerspectiveCamera(55, aspect, 0.1, 25000);
  cameraGeneral.position.set(0, 45, 95);
  scene.add(cameraGeneral);

  cameraShip = new THREE.PerspectiveCamera(CABIN_FOV, aspect, 0.1, 25000);
  cameraShip.position.copy(ship.position);
  scene.add(cameraShip);
  efectoVelocidad = crearEfectoVelocidad();
  cameraShip.add(efectoVelocidad);

  activeCamera = cameraGeneral; // Comenzar en vista general

  // 3. Renderizador WebGL
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.cursor = "default";
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  document.body.appendChild(renderer.domElement);

  cameraTarget.set(0, 0, 0);
  cameraGeneral.lookAt(cameraTarget);
  sincronizarGiroGeneral();

  // 5. Carga de texturas y creación de cuerpos celestes
  crearIluminacion();
  crearFondoEstelar();
  crearSol();
  crearTierraYLuna();
  crearPlanetasSistemaSolar();
  configurarOrbitas();
  asteroidBelt = crearCinturonAsteroides();
  solarSystemGroup.add(asteroidBelt);
  crearSistemaAlphaCentauri();
  crearConstelacionesEliptica();
  crearUniversoEstrellas();


  // Registrar catálogo de objetivos para la mira
  registrarObjetivosCelestes();

}

// --- GESTIÓN DE TEXTURAS DESDE LA CARPETA img/ ---
function cargarTextura(nombreArchivo, fallback = null) {
  const cleanName = nombreArchivo.replace(/^(\.\/)?(src|img)\//, "");
  const inSrcDir = window.location.pathname.includes("/src/") || window.location.pathname.endsWith("/src");
  const rutas = [
    inSrcDir ? "../img/" + cleanName : "img/" + cleanName,
    "img/" + cleanName,
    "./img/" + cleanName,
    "../img/" + cleanName,
    "src/" + cleanName,
    cleanName
  ];

  const loader = new THREE.TextureLoader();
  const texture = loader.load(
    rutas[0],
    undefined,
    undefined,
    function () {
      loader.load(
        rutas[1],
        (tex) => {
          texture.image = tex.image;
          texture.needsUpdate = true;
        },
        undefined,
        function () {
          loader.load(rutas[3], (tex) => {
            texture.image = tex.image;
            texture.needsUpdate = true;
          });
        }
      );
    }
  );

  if (fallback) texture.image = fallback.image;
  texture.userData.source = cleanName;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// --- ILUMINACIÓN DEL COSMOS ---
function crearIluminacion() {
  const ambientLight = new THREE.AmbientLight(0x282c38, 0.45);
  scene.add(ambientLight);

  // Luz puntual del Sol en el centro del sistema solar
  sunLight = new THREE.PointLight(0xfff7e8, 3.2, 1200, 0.4);
  sunLight.position.set(0, 0, 0);
  solarSystemGroup.add(sunLight);
}

// --- FONDO ESTELAR ---
function crearFondoEstelar() {
  scene.add(crearViaLactea());
}

// --- EL SOL ---
function crearSol() {
  const sunGeo = new THREE.SphereGeometry(6.5, 64, 64);
  const sunTex = cargarTextura("2k_sun.jpg");
  const sunMat = new THREE.MeshBasicMaterial({
    map: sunTex
  });

  sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunMesh.name = "Sol";
  solarSystemGroup.add(sunMesh);

  // Halo solar
  const glowGeo = new THREE.SphereGeometry(7.3, 32, 32);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa22,
    transparent: true,
    opacity: 0.2,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending
  });
  sunGlow = new THREE.Mesh(glowGeo, glowMat);
  sunMesh.add(sunGlow);
}

// --- LA TIERRA Y SU LUNA ---
function crearTierraYLuna() {
  earthOrbitPivot = new THREE.Object3D();
  solarSystemGroup.add(earthOrbitPivot);

  earthSystem = new THREE.Group();
  earthSystem.position.set(45, 0, 0);
  earthOrbitPivot.add(earthSystem);

  // Inclinación axial de la Tierra (23.44°)
  const earthAxisGroup = new THREE.Group();
  earthAxisGroup.rotation.z = THREE.MathUtils.degToRad(23.44);
  earthSystem.add(earthAxisGroup);

  // 1. Superficie de la Tierra
  const earthGeo = new THREE.SphereGeometry(2.3, 64, 64);
  const earthMap = cargarTextura("earthmap1k.jpg");
  const earthBump = cargarTextura("earthbump1k.jpg");
  const earthSpec = cargarTextura("earthspec1k.jpg");

  const earthMat = new THREE.MeshPhongMaterial({
    map: earthMap,
    bumpMap: earthBump,
    bumpScale: 0.06,
    specularMap: earthSpec,
    specular: new THREE.Color(0x354455),
    shininess: 25
  });

  earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthMesh.name = "Tierra";
  earthAxisGroup.add(earthMesh);

  // 2. Capa de nubes atmosféricas
  const cloudGeo = new THREE.SphereGeometry(2.34, 64, 64);
  const cloudMap = cargarTextura("earthcloudmap.jpg");
  const cloudAlpha = cargarTextura("earthcloudmaptrans_invert.jpg");

  const cloudMat = new THREE.MeshPhongMaterial({
    map: cloudMap,
    alphaMap: cloudAlpha,
    transparent: true,
    opacity: 0.92,
    blending: THREE.NormalBlending,
    depthWrite: false
  });

  earthCloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
  earthCloudsMesh.name = "Nubes de la Tierra";
  earthAxisGroup.add(earthCloudsMesh);

  // 3. Satélite natural: La Luna
  moonOrbitPivot = new THREE.Group();
  moonOrbitPivot.rotation.x = THREE.MathUtils.degToRad(5.14);
  earthSystem.add(moonOrbitPivot);

  const moonGeo = new THREE.SphereGeometry(0.62, 32, 32);
  const moonTex = cargarTextura("moon_1024.jpg");
  const moonMat = new THREE.MeshStandardMaterial({
    map: moonTex,
    roughness: 0.88,
    metalness: 0.05
  });

  moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.name = "La Luna";
  moonMesh.position.set(6.8, 0, 0);
  moonOrbitPivot.add(moonMesh);

  // Trazas orbitales

  crearLineaOrbital(moonOrbitPivot, 6.8, 0x8899aa, 0.45);
}

function crearLineaOrbital(padre, radio, colorHex, opacidad) {
  const puntos = [];
  const segmentos = 128;
  for (let i = 0; i <= segmentos; i++) {
    const theta = (i / segmentos) * Math.PI * 2;
    puntos.push(new THREE.Vector3(Math.cos(theta) * radio, 0, Math.sin(theta) * radio));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(puntos);
  const mat = new THREE.LineBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: opacidad
  });
  const linea = new THREE.Line(geo, mat);
  padre.add(linea);
}

// --- DESTINO INTERESTELAR: SISTEMA ALPHA CENTAURI ---
function crearSistemaAlphaCentauri() {
  alphaCentauriGroup = new THREE.Group();
  alphaCentauriGroup.position.copy(ALPHA_CENTAURI_POS);
  scene.add(alphaCentauriGroup);

  // Estrella Alpha Centauri A
  const starAGeo = new THREE.SphereGeometry(8.5, 48, 48);
  const starAMat = new THREE.MeshBasicMaterial({ color: 0xffe899 });
  alphaStarA = new THREE.Mesh(starAGeo, starAMat);
  alphaStarA.name = "Alpha Centauri A";
  alphaCentauriGroup.add(alphaStarA);

  const glowAGeo = new THREE.SphereGeometry(10.5, 32, 32);
  const glowAMat = new THREE.MeshBasicMaterial({
    color: 0xffcc33,
    transparent: true,
    opacity: 0.25,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending
  });
  alphaStarA.add(new THREE.Mesh(glowAGeo, glowAMat));

  // Estrella Alpha Centauri B
  const starBGeo = new THREE.SphereGeometry(6.2, 48, 48);
  const starBMat = new THREE.MeshBasicMaterial({ color: 0xff8833 });
  alphaStarB = new THREE.Mesh(starBGeo, starBMat);
  alphaStarB.name = "Alpha Centauri B";
  alphaStarB.position.set(38, 5, 12);
  alphaCentauriGroup.add(alphaStarB);

  // Estrella Proxima Centauri
  const proxGeo = new THREE.SphereGeometry(2.4, 32, 32);
  const proxMat = new THREE.MeshBasicMaterial({ color: 0xff3322 });
  proximaMesh = new THREE.Mesh(proxGeo, proxMat);
  proximaMesh.name = "Proxima Centauri";
  proximaMesh.position.set(-85, -20, 40);
  alphaCentauriGroup.add(proximaMesh);

  // Luz estelar propia
  const alphaLight = new THREE.PointLight(0xfff0dd, 3.5, 1200, 0.5);
  alphaCentauriGroup.add(alphaLight);

  // Baliza de navegación orbital
  const beaconGeo = new THREE.RingGeometry(24, 25, 64);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6
  });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.rotation.x = Math.PI / 2;
  alphaCentauriGroup.add(beacon);
}

// --- GENERADOR DE TEXTURAS PROCEDURALES PARA LOS PLANETAS DEL SISTEMA SOLAR ---
function crearTexturaProceduralPlaneta(tipo) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (tipo === "mercurio") {
    ctx.fillStyle = "#8c8882";
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 350; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      const r = 2 + Math.random() * 14;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(55,53,50,0.38)" : "rgba(175,172,168,0.32)";
      ctx.fill();
    }
  } else if (tipo === "venus") {
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#c99e63");
    grad.addColorStop(0.25, "#e5be82");
    grad.addColorStop(0.5, "#d9b375");
    grad.addColorStop(0.75, "#edd4a2");
    grad.addColorStop(1, "#c49759");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 40; i++) {
      const y = Math.random() * 512;
      ctx.fillStyle = "rgba(255, 245, 220, 0.14)";
      ctx.fillRect(0, y, 1024, 8 + Math.random() * 16);
    }
  } else if (tipo === "marte") {
    ctx.fillStyle = "#b84214";
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * 1024;
      const y = 80 + Math.random() * 350;
      ctx.beginPath();
      ctx.ellipse(x, y, 25 + Math.random() * 75, 12 + Math.random() * 35, Math.random(), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(95, 30, 10, 0.45)";
      ctx.fill();
    }
    // Casquetes polares
    ctx.fillStyle = "rgba(245, 248, 255, 0.95)";
    ctx.fillRect(0, 0, 1024, 22);
    ctx.fillRect(0, 490, 1024, 22);
  } else if (tipo === "jupiter") {
    const bands = [
      "#d8c89d", "#9e5f38", "#e5d5b5", "#7e4222", "#f4e7cc",
      "#97532d", "#ecd8b6", "#b06d40", "#dbc9ac", "#763d1e", "#ebd5af"
    ];
    const bHeight = 512 / bands.length;
    for (let i = 0; i < bands.length; i++) {
      ctx.fillStyle = bands[i];
      ctx.fillRect(0, i * bHeight, 1024, bHeight + 2);
    }
    // Gran Mancha Roja
    ctx.beginPath();
    ctx.ellipse(660, 325, 70, 40, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#b5371c";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(660, 325, 42, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#d85a3c";
    ctx.fill();
  } else if (tipo === "saturno") {
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#baa072");
    grad.addColorStop(0.3, "#e3cca0");
    grad.addColorStop(0.6, "#d3b984");
    grad.addColorStop(0.85, "#eedab0");
    grad.addColorStop(1, "#b59b69");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);
  } else if (tipo === "urano") {
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#72c4d4");
    grad.addColorStop(0.5, "#96e6f7");
    grad.addColorStop(1, "#69b7c8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);
  } else if (tipo === "pluton") {
    ctx.fillStyle = "#ac9381";
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 180; i++) {
      ctx.beginPath();
      ctx.ellipse(Math.random() * 1024, Math.random() * 512,
        8 + Math.random() * 80, 5 + Math.random() * 40, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? "rgba(73,49,39,0.3)" : "rgba(239,224,205,0.45)";
      ctx.fill();
    }
    // Región helada ilustrativa, sin pretensión de mapa cartográfico.
    ctx.fillStyle = "#e4d9c9";
    ctx.beginPath();
    ctx.ellipse(540, 265, 95, 70, -0.3, 0, Math.PI * 2);
    ctx.ellipse(655, 255, 70, 55, 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (tipo === "neptuno") {
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#254485");
    grad.addColorStop(0.5, "#3d6bd3");
    grad.addColorStop(1, "#1c3875");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);
    // Gran Mancha Oscura
    ctx.beginPath();
    ctx.ellipse(420, 220, 50, 26, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(12, 26, 70, 0.75)";
    ctx.fill();
    // Cirros
    ctx.fillStyle = "rgba(225, 242, 255, 0.42)";
    ctx.fillRect(290, 255, 250, 5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Textura concéntrica de anillos de Saturno con División de Cassini
function crearTexturaAnillosSaturno() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0.0, "rgba(0,0,0,0)");
  grad.addColorStop(0.12, "rgba(185, 165, 125, 0.7)");
  grad.addColorStop(0.42, "rgba(235, 215, 175, 0.95)");
  grad.addColorStop(0.68, "rgba(225, 205, 165, 0.9)");
  grad.addColorStop(0.70, "rgba(10, 10, 10, 0.04)"); // División de Cassini
  grad.addColorStop(0.74, "rgba(10, 10, 10, 0.04)");
  grad.addColorStop(0.77, "rgba(200, 180, 145, 0.85)");
  grad.addColorStop(0.95, "rgba(175, 155, 125, 0.55)");
  grad.addColorStop(1.0, "rgba(0,0,0,0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 64);

  return new THREE.CanvasTexture(canvas);
}

// --- CREACIÓN DE TODOS LOS PLANETAS DEL SISTEMA SOLAR ---
function crearPlanetasSistemaSolar() {
  planetasSistemaSolar = [];

  // Función constructora modular para planetas
  function instanciarPlaneta(config) {
    const orbitPivot = new THREE.Object3D();
    solarSystemGroup.add(orbitPivot);

    const planetPivot = new THREE.Group();
    orbitPivot.add(planetPivot);

    // Eje de inclinación axial
    const axisGroup = new THREE.Group();
    if (config.inclinacionAxial) {
      axisGroup.rotation.z = THREE.MathUtils.degToRad(config.inclinacionAxial);
    }
    planetPivot.add(axisGroup);

    const geo = new THREE.SphereGeometry(config.radio, 48, 48);
    const procedural = crearTexturaProceduralPlaneta(config.tipo);
    const tex = PLANET_TEXTURES[config.tipo]
      ? cargarTextura(PLANET_TEXTURES[config.tipo], procedural) : procedural;
    tex.colorSpace = THREE.SRGBColorSpace;
    const softLight = config.tipo === "neptuno" ? 0x6b9fff : config.tipo === "pluton" ? 0xe8d1ba : 0;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: config.roughness || 0.75,
      metalness: 0.05,
      // Luz ilustrativa suave que conserva la textura en la cara nocturna.
      emissive: softLight,
      emissiveMap: softLight ? tex : null,
      emissiveIntensity: softLight ? 0.55 : 0
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = config.nombre;
    axisGroup.add(mesh);

    // Traza de la órbita alrededor del Sol


    // Anillos (Saturno, Urano)
    let ringAsteroids = null;
    if (config.anillos) {
      const ringGeo = new THREE.RingGeometry(config.anillos.radioInterno, config.anillos.radioExterno, 64);
      // La textura varía con el radio, no con las coordenadas cartesianas del disco.
      const positions = ringGeo.attributes.position;
      const uv = ringGeo.attributes.uv;
      for (let i = 0; i < positions.count; i++) {
        uv.setXY(i, (Math.hypot(positions.getX(i), positions.getY(i)) - config.anillos.radioInterno)
          / (config.anillos.radioExterno - config.anillos.radioInterno), 0.5);
      }
      const ringMat = new THREE.MeshBasicMaterial({
        map: config.anillos.textura,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      axisGroup.add(ringMesh);
      if (config.tipo === "saturno") {
        ringAsteroids = crearAsteroidesAnillosSaturno(config.anillos.radioInterno, config.anillos.radioExterno);
        axisGroup.add(ringAsteroids);
      }
    }

    // Lunas / satélites naturales
    const lunasMeshes = [];
    if (config.lunas && config.lunas.length > 0) {
      let moonParent = planetPivot;
      if (config.lunasEcuatoriales) {
        moonParent = new THREE.Group();
        moonParent.rotation.copy(axisGroup.rotation);
        planetPivot.add(moonParent);
      }
      config.lunas.forEach((lunaConf) => {
        const moonPivot = new THREE.Group();
        if (lunaConf.inclinacion) moonPivot.rotation.x = THREE.MathUtils.degToRad(lunaConf.inclinacion);
        moonPivot.rotation.y = THREE.MathUtils.degToRad(lunaConf.fase || 0);
        moonParent.add(moonPivot);

        const moonGeo = new THREE.SphereGeometry(lunaConf.radio, 24, 24);
        const moonMat = new THREE.MeshStandardMaterial({
          color: lunaConf.color || 0xcccccc,
          roughness: 0.85,
          emissive: lunaConf.brillo ? lunaConf.color || 0xcccccc : 0x000000,
          emissiveIntensity: lunaConf.brillo || 0
        });
        const moonMeshObj = new THREE.Mesh(moonGeo, moonMat);
        moonMeshObj.name = lunaConf.nombre;
        moonMeshObj.position.set(lunaConf.distancia, 0, 0);
        moonPivot.add(moonMeshObj);

        crearLineaOrbital(moonPivot, lunaConf.distancia, 0x8899aa, 0.25);
        lunasMeshes.push({ pivot: moonPivot, mesh: moonMeshObj, info: lunaConf.info });
      });
    }

    const item = {
      nombre: config.nombre,
      mesh: mesh,
      orbitPivot: orbitPivot,
      planetPivot: planetPivot,
      ringAsteroids,
      lunas: lunasMeshes
    };
    planetasSistemaSolar.push(item);
    return item;
  }

  // 1. MERCURIO
  instanciarPlaneta({
    nombre: "Mercurio",
    tipo: "mercurio",
    radio: 0.95,
    inclinacionAxial: 0.03,
  });

  // 2. VENUS
  instanciarPlaneta({
    nombre: "Venus",
    tipo: "venus",
    radio: 2.1,
    inclinacionAxial: 177.3,
  });

  // (3. Tierra y Luna ya creadas en crearTierraYLuna con mapas de alta resolución)
  planetasSistemaSolar.push({
    nombre: "Tierra",
    mesh: earthMesh,
    orbitPivot: earthOrbitPivot,
    planetPivot: earthSystem,
    lunas: [{ pivot: moonOrbitPivot, mesh: moonMesh }]
  });

  // 4. MARTE
  instanciarPlaneta({
    nombre: "Marte",
    tipo: "marte",
    radio: 1.35,
    inclinacionAxial: 25.19,
    lunas: [
      { nombre: "Fobos", distancia: 2.3, radio: 0.22, color: 0x9e9e9e },
      { nombre: "Deimos", distancia: 3.4, radio: 0.16, color: 0x757575 }
    ]
  });

  // 5. JÚPITER
  instanciarPlaneta({
    nombre: "Júpiter",
    tipo: "jupiter",
    radio: 4.8,
    inclinacionAxial: 3.13,
    lunas: [
      { nombre: "Ío", distancia: 6.8, radio: 0.45, color: 0xffd54f },
      { nombre: "Europa", distancia: 8.8, radio: 0.40, color: 0xe0f7fa },
      { nombre: "Ganimedes", distancia: 11.2, radio: 0.65, color: 0xb0bec5 },
      { nombre: "Calisto", distancia: 13.8, radio: 0.58, color: 0x78909c }
    ]
  });

  // 6. SATURNO
  instanciarPlaneta({
    nombre: "Saturno",
    tipo: "saturno",
    radio: 3.8,
    inclinacionAxial: 26.73,
    anillos: {
      radioInterno: 4.8,
      radioExterno: 9.6,
      textura: crearTexturaAnillosSaturno()
    },
    lunas: [
      { nombre: "Titán", distancia: 13.5, radio: 0.62, color: 0xffa726 }
    ]
  });

  // 7. URANO
  instanciarPlaneta({
    nombre: "Urano",
    tipo: "urano",
    radio: 2.6,
    inclinacionAxial: 97.77, // Rueda de lado
    anillos: {
      radioInterno: 3.4,
      radioExterno: 4.8,
      textura: crearTexturaAnillosSaturno()
    }
  });

  // 8. NEPTUNO
  instanciarPlaneta({
    nombre: "Neptuno",
    tipo: "neptuno",
    radio: 2.5,
    inclinacionAxial: 28.32,
    lunas: [
      { nombre: "Tritón", distancia: 6.8, radio: 0.48, color: 0xb2ebf2 }
    ]
  });
  // 9. PLUTÓN (planeta enano); comparte navegación, selección y dinámica orbital.
  instanciarPlaneta({
    nombre: "Plutón",
    tipo: "pluton",
    radio: 0.65,
    inclinacionAxial: 119.6,
    lunasEcuatoriales: true,
    // Separaciones y tamaños ilustrativos; periodos orbitales en orbitas.js.
    lunas: [
      {
        nombre: "Caronte", distancia: 3.4, radio: 0.33, color: 0xb5aba4, brillo: 0.3, fase: 0,
        info: "Luna principal de Plutón | Órbita: 6,387 días | Descubierta en 1978"
      },
      {
        nombre: "Estigia", distancia: 7.5, radio: 0.07, color: 0xa7a39d, brillo: 0.3, fase: 70,
        info: "Pequeña luna de Plutón (Styx) | Órbita: 20,16 días"
      },
      {
        nombre: "Nix", distancia: 8.55, radio: 0.10, color: 0xd0c7bc, brillo: 0.3, fase: 145,
        info: "Pequeña luna de Plutón | Órbita: 24,85 días"
      },
      {
        nombre: "Cerbero", distancia: 10.1, radio: 0.07, color: 0xb8b0a4, brillo: 0.3, fase: 220,
        info: "Pequeña luna de Plutón (Kerberos) | Órbita: 32,17 días"
      },
      {
        nombre: "Hidra", distancia: 11.3, radio: 0.11, color: 0xd9d6cb, brillo: 0.3, fase: 290,
        info: "Luna exterior de Plutón (Hydra) | Órbita: 38,20 días"
      }
    ]
  });
}

function configurarOrbitas() {
  planetasSistemaSolar.forEach((p) => {
    p.elementos = ELEMENTOS[p.nombre];
    p.orbitPivot.rotation.set(0, 0, 0);
    p.planetPivot.position.fromArray(posicionEnDias(p.elementos, simulationDays));
    const points = [];
    for (let j = 0; j <= 512; j++) {
      points.push(new THREE.Vector3().fromArray(posicionOrbital(p.elementos, j / 512 * Math.PI * 2)));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0x638cba, transparent: true, opacity: 0.38 }));
    line.name = `Orbita_${p.nombre}`;
    solarSystemGroup.add(line);
  });
}

// --- HELPERS PARA CARTELES SCI-FI CON FINA LETRA PARA CONSTELACIONES Y ESTRELLAS ---
function crearCartelTextoConstelacion(nombre) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.font = "500 54px Rajdhani, sans-serif";
  ctx.fillStyle = "#b8fff1";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#00252e";
  ctx.shadowBlur = 8;
  ctx.fillText(nombre, 512, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false, depthTest: false
  }));
  sprite.scale.set(100, 12.5, 1);
  return sprite;
}

function crearCartelTextoEstrella(nombre) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  // Solo texto sobre fondo transparente, sin marco ni recuadro.
  ctx.font = "600 24px 'Rajdhani', 'Orbitron', sans-serif";
  ctx.fillStyle = "#e0f7fa";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#80d8ff";
  ctx.shadowBlur = 8;
  ctx.fillText(nombre, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.92,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(45, 11.25, 1);
  return sprite;
}

// --- CONSTELACIONES ZODIACALES EN LA ELÍPTICA CON LÍNEAS FINAS Y CARTELES IDENTIFICATIVOS ---
function crearConstelacionesEliptica() {
  constellationsGroup = new THREE.Group();
  constellationsGroup.name = "ConstelacionesEliptica";
  scene.add(constellationsGroup);
  constellationTargets = [];

  const RADIO_ELIPTICA = 4200; // Anillo zodiacal a lo largo del plano elíptico Y ~ 0

  // Datos astronómicos completos de las 12 constelaciones del Zodíaco
  const zodiaco = [
    {
      nombre: "ARIES",
      simbolo: "♈",
      info: "Primera constelación zodiacal (0°-30° elíptica). En la mitología clásica simboliza al carnero volador de vellocino de oro.",
      angulo: 0,
      estrellas: [
        { nombre: "Hamal", pos: [0, 5, 0], tipo: "Gigante naranja (α Ari)", mag: "2.0" },
        { nombre: "Sheratan", pos: [45, 12, 10], tipo: "Blanco-azulada (β Ari)", mag: "2.64" },
        { nombre: "Mesarthim", pos: [80, 5, -8], tipo: "Binaria blanca (γ Ari)", mag: "3.88" },
        { nombre: "Botein", pos: [115, -12, -18], tipo: "Gigante naranja (δ Ari)", mag: "4.35" }
      ],
      conexiones: [[0, 1], [1, 2], [2, 3]]
    },
    {
      nombre: "TAURO",
      simbolo: "♉",
      info: "Segunda constelación zodiacal (30°-60° elíptica). Alberga la superestrella Aldebarán y los legendarios cúmulos Pléyades e Híades.",
      angulo: Math.PI / 6,
      estrellas: [
        { nombre: "Aldebarán", pos: [0, 0, 0], tipo: "Gigante naranja (α Tau)", mag: "0.85" },
        { nombre: "Elnath", pos: [-35, 25, 20], tipo: "Gigante blanca (β Tau)", mag: "1.65" },
        { nombre: "Alcyone", pos: [40, 15, -15], tipo: "Cúmulo Pléyades (η Tau)", mag: "2.87" },
        { nombre: "Tianguan", pos: [-60, 48, 30], tipo: "Subgigante azul (ζ Tau)", mag: "3.0" },
        { nombre: "Ain", pos: [65, 42, -25], tipo: "Gigante amarilla (ε Tau)", mag: "3.53" },
        { nombre: "Hyadum I", pos: [-15, 65, 15], tipo: "Gigante naranja (γ Tau)", mag: "3.65" },
        { nombre: "Chamukuy", pos: [30, 75, -5], tipo: "Estrella blanca (θ Tau)", mag: "3.85" }
      ],
      conexiones: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6]]
    },
    {
      nombre: "GÉMINIS",
      simbolo: "♊",
      info: "Tercera constelación zodiacal (60°-90° elíptica). Representa a los inseparables gemelos mitológicos Pólux y Cástor.",
      angulo: (2 * Math.PI) / 6,
      estrellas: [
        { nombre: "Pólux", pos: [-20, 80, 0], tipo: "Gigante naranja (β Gem)", mag: "1.14" },
        { nombre: "Cástor", pos: [20, 80, 0], tipo: "Sistema múltiple séxtuple (α Gem)", mag: "1.58" },
        { nombre: "Alhena", pos: [-25, 40, -10], tipo: "Subgigante blanca (γ Gem)", mag: "1.9" },
        { nombre: "Wasat", pos: [25, 40, -10], tipo: "Subgigante blanca (δ Gem)", mag: "3.5" },
        { nombre: "Mebsuta", pos: [-15, 0, -20], tipo: "Supergigante amarilla (ε Gem)", mag: "3.0" },
        { nombre: "Mekbuda", pos: [15, 0, -20], tipo: "Cefeida pulsante (ζ Gem)", mag: "3.9" },
        { nombre: "Tejat Post.", pos: [-30, -45, -15], tipo: "Gigante roja (μ Gem)", mag: "2.87" },
        { nombre: "Propus", pos: [30, -45, -15], tipo: "Gigante roja binaria (η Gem)", mag: "3.3" }
      ],
      conexiones: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7]]
    },
    {
      nombre: "CÁNCER",
      simbolo: "♋",
      info: "Cuarta constelación zodiacal (90°-120° elíptica). En su seno reluce el cúmulo estelar abierto El Pesebre (M44 / Praesepe).",
      angulo: (3 * Math.PI) / 6,
      estrellas: [
        { nombre: "Asellus Aust.", pos: [0, 25, 0], tipo: "Gigante naranja (δ Cnc)", mag: "3.94" },
        { nombre: "Asellus Bor.", pos: [-35, 0, -15], tipo: "Subgigante blanca (γ Cnc)", mag: "4.66" },
        { nombre: "Acubens", pos: [35, 0, -15], tipo: "Sistema múltiple (α Cnc)", mag: "4.25" },
        { nombre: "Tarf", pos: [0, -35, 10], tipo: "Gigante naranja (β Cnc)", mag: "3.52" },
        { nombre: "Tegmine", pos: [0, -65, 20], tipo: "Sistema estelar (ζ Cnc)", mag: "4.67" }
      ],
      conexiones: [[0, 1], [0, 2], [0, 3], [3, 4]]
    },
    {
      nombre: "LEO",
      simbolo: "♌",
      info: "Quinta constelación zodiacal (120°-150° elíptica). Destaca la regia estrella Régulo y la forma inconfundible de la hoz celestial.",
      angulo: (4 * Math.PI) / 6,
      estrellas: [
        { nombre: "Régulo", pos: [40, 75, -10], tipo: "Azul de secuencia (α Leo)", mag: "1.36" },
        { nombre: "Algieba", pos: [15, 85, 0], tipo: "Binaria gigante naranja (γ Leo)", mag: "2.0" },
        { nombre: "Adhafera", pos: [-15, 65, 10], tipo: "Gigante blanca (ζ Leo)", mag: "3.44" },
        { nombre: "Rasalas", pos: [-20, 35, 15], tipo: "Gigante roja (μ Leo)", mag: "3.88" },
        { nombre: "Al Jabbah", pos: [0, 15, 0], tipo: "Supergigante blanca (η Leo)", mag: "3.5" },
        { nombre: "Zosma", pos: [-55, 10, 25], tipo: "Estrella blanca (δ Leo)", mag: "2.56" },
        { nombre: "Denebola", pos: [-85, -20, 30], tipo: "Blanca de secuencia (β Leo)", mag: "2.14" },
        { nombre: "Chertan", pos: [-45, -35, 20], tipo: "Estrella blanca (θ Leo)", mag: "3.32" },
        { nombre: "Subra", pos: [10, -30, 0], tipo: "Subgigante blanca (ο Leo)", mag: "3.52" }
      ],
      conexiones: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 4]]
    },
    {
      nombre: "VIRGO",
      simbolo: "♍",
      info: "Sexta constelación zodiacal (150°-180° elíptica). La mayor en extensión del zodíaco, coronada por la deslumbrante Espiga (Spica).",
      angulo: (5 * Math.PI) / 6,
      estrellas: [
        { nombre: "Espiga", pos: [0, 60, 0], tipo: "Binaria azul masiva (α Vir)", mag: "0.98" },
        { nombre: "Zavijava", pos: [25, 30, -10], tipo: "Amarilla de secuencia (β Vir)", mag: "3.6" },
        { nombre: "Porrima", pos: [-30, 25, 15], tipo: "Binaria enanas blancas (γ Vir)", mag: "2.74" },
        { nombre: "Auva", pos: [0, 0, 0], tipo: "Gigante roja (δ Vir)", mag: "3.38" },
        { nombre: "Vindemiatrix", pos: [-45, -20, 20], tipo: "Gigante amarilla (ε Vir)", mag: "2.85" },
        { nombre: "Heze", pos: [45, -25, -20], tipo: "Blanca de secuencia (ζ Vir)", mag: "3.38" },
        { nombre: "Zaniah", pos: [0, -65, 0], tipo: "Sistema triple (η Vir)", mag: "3.89" },
        { nombre: "Syrma", pos: [35, -85, -15], tipo: "Subgigante blanca (ι Vir)", mag: "4.07" }
      ],
      conexiones: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [3, 6], [6, 7]]
    },
    {
      nombre: "LIBRA",
      simbolo: "♎",
      info: "Séptima constelación zodiacal (180°-210° elíptica). Representa la balanza de la equidad y la justicia estelar.",
      angulo: Math.PI,
      estrellas: [
        { nombre: "Zubenelgenubi", pos: [0, 50, 0], tipo: "Binaria visual blanca (α Lib)", mag: "2.75" },
        { nombre: "Zubeneschamali", pos: [-45, 15, 20], tipo: "Enana azul-verdosa (β Lib)", mag: "2.61" },
        { nombre: "Zubenelhakrabi", pos: [45, 15, -20], tipo: "Gigante naranja (γ Lib)", mag: "3.91" },
        { nombre: "Brachium", pos: [-25, -40, 10], tipo: "Gigante roja (σ Lib)", mag: "3.25" },
        { nombre: "Zubenalgubi", pos: [25, -40, -10], tipo: "Gigante blanca (υ Lib)", mag: "3.6" }
      ],
      conexiones: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4]]
    },
    {
      nombre: "ESCORPIO",
      simbolo: "♏",
      info: "Octava constelación zodiacal (210°-240° elíptica). El colosal corazón ardiente Antares lidera la silueta del escorpión.",
      angulo: (7 * Math.PI) / 6,
      estrellas: [
        { nombre: "Antares", pos: [-55, 65, 20], tipo: "Supergigante roja M1.5 (α Sco)", mag: "1.06" },
        { nombre: "Graffias", pos: [-25, 60, 10], tipo: "Binaria azulada (β Sco)", mag: "2.56" },
        { nombre: "Dschubba", pos: [5, 45, 0], tipo: "Subgigante azul (δ Sco)", mag: "2.29" },
        { nombre: "Sargas", pos: [25, 15, -15], tipo: "Gigante brillante blanca (θ Sco)", mag: "1.86" },
        { nombre: "Shaula", pos: [30, -20, -20], tipo: "Subgigante azul triple (λ Sco)", mag: "1.62" },
        { nombre: "Lesath", pos: [15, -55, -10], tipo: "Subgigante azul (υ Sco)", mag: "2.7" },
        { nombre: "Wei", pos: [-10, -75, 5], tipo: "Gigante naranja (ε Sco)", mag: "2.29" },
        { nombre: "Girtab", pos: [-35, -70, 15], tipo: "Binaria espectroscópica (κ Sco)", mag: "2.41" },
        { nombre: "Iclil", pos: [-50, -45, 25], tipo: "Subgigante azul (π Sco)", mag: "2.89" },
        { nombre: "Alniyat", pos: [-35, -30, 20], tipo: "Azul masiva múltiple (τ Sco)", mag: "2.82" }
      ],
      conexiones: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]]
    },
    {
      nombre: "SAGITARIO",
      simbolo: "♐",
      info: "Novena constelación zodiacal (240°-270° elíptica). En su dirección exacta se encuentra Sagitario A*, el agujero negro de la Vía Láctea.",
      angulo: (8 * Math.PI) / 6,
      estrellas: [
        { nombre: "Kaus Australis", pos: [0, 45, 0], tipo: "Gigante azul-blanca (ε Sgr)", mag: "1.79" },
        { nombre: "Kaus Media", pos: [-35, 15, 15], tipo: "Gigante naranja (δ Sgr)", mag: "2.72" },
        { nombre: "Kaus Borealis", pos: [35, 15, -15], tipo: "Gigante naranja (λ Sgr)", mag: "2.82" },
        { nombre: "Nunki", pos: [-20, -25, 10], tipo: "Enana azul brillante (σ Sgr)", mag: "2.05" },
        { nombre: "Ascella", pos: [20, -25, -10], tipo: "Binaria blanca (ζ Sgr)", mag: "2.6" },
        { nombre: "Alnasl", pos: [-55, -15, 25], tipo: "Gigante naranja (γ Sgr)", mag: "2.98" },
        { nombre: "Rukbat", pos: [55, -15, -25], tipo: "Enana azul (α Sgr)", mag: "3.96" },
        { nombre: "Arkab", pos: [0, -55, 0], tipo: "Enana blanca (β Sgr)", mag: "3.96" }
      ],
      conexiones: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4], [1, 5], [2, 6], [3, 7], [4, 7]]
    },
    {
      nombre: "CAPRICORNIO",
      simbolo: "♑",
      info: "Décima constelación zodiacal (270°-300° elíptica). Representa a la mítica criatura marina-cabrío de las constelaciones mesopotámicas.",
      angulo: (9 * Math.PI) / 6,
      estrellas: [
        { nombre: "Deneb Algedi", pos: [-55, 30, 20], tipo: "Gigante metálica binaria (δ Cap)", mag: "2.85" },
        { nombre: "Dabih", pos: [0, 40, 0], tipo: "Sistema séptuple (β Cap)", mag: "3.05" },
        { nombre: "Algiedi", pos: [55, 25, -20], tipo: "Doble óptica amarilla (α Cap)", mag: "3.58" },
        { nombre: "Nashira", pos: [-35, -25, 15], tipo: "Gigante blanca (γ Cap)", mag: "3.69" },
        { nombre: "Alshat", pos: [25, -35, -10], tipo: "Enana azul-blanca (ν Cap)", mag: "4.77" },
        { nombre: "Baten Algiedi", pos: [0, -45, 0], tipo: "Gigante naranja (ω Cap)", mag: "4.12" }
      ],
      conexiones: [[0, 1], [1, 2], [0, 3], [2, 4], [3, 5], [4, 5]]
    },
    {
      nombre: "ACUARIO",
      simbolo: "♒",
      info: "Undécima constelación zodiacal (300°-330° elíptica). En la mitología celestial derrama la vasija con el agua del conocimiento universal.",
      angulo: (10 * Math.PI) / 6,
      estrellas: [
        { nombre: "Sadalsuud", pos: [-40, 50, 15], tipo: "Supergigante amarilla (β Aqr)", mag: "2.9" },
        { nombre: "Sadalmelik", pos: [-15, 40, 5], tipo: "Supergigante amarilla (α Aqr)", mag: "2.95" },
        { nombre: "Sadachbia", pos: [15, 45, -5], tipo: "Binaria blanca (γ Aqr)", mag: "3.86" },
        { nombre: "Skat", pos: [45, 30, -15], tipo: "Blanca de secuencia (δ Aqr)", mag: "3.27" },
        { nombre: "Albali", pos: [-30, 0, 10], tipo: "Blanca de secuencia (ε Aqr)", mag: "3.78" },
        { nombre: "Ancha", pos: [0, -10, 0], tipo: "Gigante amarilla (θ Aqr)", mag: "4.17" },
        { nombre: "Situla", pos: [30, -20, -10], tipo: "Gigante naranja (κ Aqr)", mag: "5.04" },
        { nombre: "Hydor", pos: [-15, -50, 5], tipo: "Gigante roja (λ Aqr)", mag: "3.73" },
        { nombre: "Bunda", pos: [20, -60, -8], tipo: "Binaria espectroscópica (ξ Aqr)", mag: "4.68" }
      ],
      conexiones: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6], [5, 7], [6, 8]]
    },
    {
      nombre: "PISCIS",
      simbolo: "♓",
      info: "Duodécima constelación zodiacal (330°-360° elíptica). Contiene el Punto Vernal celeste que marca el inicio del año astronómico.",
      angulo: (11 * Math.PI) / 6,
      estrellas: [
        { nombre: "Alrisha", pos: [-65, 55, 25], tipo: "Binaria blanca del nudo (α Psc)", mag: "3.82" },
        { nombre: "Fumalsamakah", pos: [-45, 40, 15], tipo: "Enana azul-blanca (β Psc)", mag: "4.48" },
        { nombre: "Torcular", pos: [-20, 20, 8], tipo: "Gigante amarilla (ο Psc)", mag: "4.26" },
        { nombre: "Linteum", pos: [0, 0, 0], tipo: "Gigante naranja (δ Psc)", mag: "4.44" },
        { nombre: "Kaht", pos: [25, 20, -10], tipo: "Gigante naranja (ε Psc)", mag: "4.27" },
        { nombre: "Revati", pos: [50, 45, -20], tipo: "Sistema cuádruple (ζ Psc)", mag: "5.21" },
        { nombre: "Kullat Nunu", pos: [70, 60, -28], tipo: "Gigante amarilla (η Psc)", mag: "3.62" },
        { nombre: "Vernalis", pos: [-15, -35, 5], tipo: "Gigante amarilla (γ Psc)", mag: "3.7" },
        { nombre: "Belen", pos: [20, -40, -8], tipo: "Enana blanca-amarilla (ι Psc)", mag: "4.13" }
      ],
      conexiones: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [3, 7], [3, 8]]
    }
  ];

  CONSTELACIONES_EXTRA.forEach((c) => zodiaco.push({
    ...c, simbolo: "", estrellas: c.estrellas.map(([nombre, x, y]) => ({
      nombre, pos: [x, y, 0], tipo: "Estrella", mag: "—"
    }))
  }));

  const lineMat = new THREE.LineBasicMaterial({
    color: 0x4fc3f7,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending
  });

  const starGeo = new THREE.SphereGeometry(3.5, 8, 8);
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  zodiaco.forEach((constelacion) => {
    const constGroup = new THREE.Group();
    constGroup.name = `Constelacion_${constelacion.nombre}`;

    // Posición base sobre la elíptica a gran radio R = 4200
    const cx = Math.cos(constelacion.angulo) * RADIO_ELIPTICA;
    const cz = Math.sin(constelacion.angulo) * RADIO_ELIPTICA;
    const cy = (Math.random() - 0.5) * 120; // Leve variación z-planar en Y ~ 0
    if (constelacion.centro) constGroup.position.fromArray(constelacion.centro);
    else constGroup.position.set(cx, cy, cz);
    constGroup.lookAt(0, 0, 0); // Orientada hacia el centro del Sistema Solar

    // 1. ANCLA CENTRAL DE LA CONSTELACIÓN PARA TELEMETRÍA CUANDO SE APUNTA A ELLA
    const constAnchorGeo = new THREE.SphereGeometry(24, 6, 6);
    const constAnchorMat = new THREE.MeshBasicMaterial({ visible: false });
    const constAnchorMesh = new THREE.Mesh(constAnchorGeo, constAnchorMat);
    constAnchorMesh.name = constelacion.nombre;
    constAnchorMesh.position.set(0, 0, 0);
    constGroup.add(constAnchorMesh);

    constellationTargets.push({
      mesh: constAnchorMesh,
      name: constelacion.nombre,
      type: constelacion.centro ? "CONSTELACIÓN" : "CONSTELACIÓN ZODIACAL",
      constellation: constGroup,
      category: constelacion.centro ? "Bóveda celeste" : `Eclíptica (${constelacion.simbolo})`,
      data: constelacion.info,
      color: "#64ffda",
      radius: 180
    });

    const worldPoints = constelacion.estrellas.map((est) => new THREE.Vector3(est.pos[0], est.pos[1], est.pos[2]));

    // 2. CREAR ESTRELLAS INDIVIDUALES CON CARTELES DE FINA LETRA
    constelacion.estrellas.forEach((est, idx) => {
      const p = worldPoints[idx];

      // Malla estelar visible
      const starMesh = new THREE.Mesh(starGeo, starMat);
      starMesh.position.copy(p);
      constGroup.add(starMesh);

      // Cartel identificativo con fina letra flotando sobre la estrella
      const starLabel = crearCartelTextoEstrella(est.nombre);
      starLabel.position.set(p.x, p.y + 7.5, p.z);
      constGroup.add(starLabel);
      constellationLabels.push({ sprite: starLabel, group: constGroup, star: true });

      // Registrar estrella en el catálogo de telemetría de la mira
      constellationTargets.push({
        mesh: starMesh,
        name: est.nombre.toUpperCase(),
        type: `ESTRELLA (${est.tipo})`,
        constellation: constGroup,
        category: `Constelación de ${constelacion.nombre}`,
        data: `Mag: ${est.mag} | Componente estelar de ${constelacion.nombre}`,
        color: "#80d8ff",
        radius: 45
      });
    });

    // 3. LÍNEAS FINAS CONECTANDO LAS ESTRELLAS
    const linePoints = [];
    constelacion.conexiones.forEach(([i1, i2]) => {
      linePoints.push(worldPoints[i1]);
      linePoints.push(worldPoints[i2]);
    });

    const linesGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
    const linesMesh = new THREE.LineSegments(linesGeo, lineMat);
    constGroup.add(linesMesh);

    // 4. CARTEL PRINCIPAL DE LA CONSTELACIÓN CON FINA LETRA SCI-FI
    const constTitleLabel = crearCartelTextoConstelacion(constelacion.nombre, constelacion.simbolo);
    const minX = Math.min(...worldPoints.map(p => p.x));
    const maxX = Math.max(...worldPoints.map(p => p.x));
    const maxY = Math.max(...worldPoints.map(p => p.y));
    constTitleLabel.position.set((minX + maxX) / 2, maxY + 55, 0);
    constGroup.add(constTitleLabel);
    constellationLabels.push({ sprite: constTitleLabel, group: constGroup, star: false });

    constellationsGroup.add(constGroup);
    if (constelacion.nombre === "ORIÓN" || constelacion.nombre === "ANDRÓMEDA") {
      const galaxia = constelacion.nombre === "ANDRÓMEDA";
      const nebula = crearNebulosa(galaxia ? "M31 · Galaxia de Andrómeda" : "M42 · Nebulosa de Orión", galaxia);
      nebula.position.set(galaxia ? 50 : 0, galaxia ? 230 : -60, -20);
      constGroup.add(nebula);
      constellationTargets.push({
        mesh: nebula, name: nebula.name,
        constellation: constGroup,
        type: galaxia ? "GALAXIA" : "NEBULOSA", category: constelacion.nombre,
        data: galaxia ? "Galaxia espiral M31, históricamente llamada nebulosa de Andrómeda." : "Región de formación estelar M42, en la espada de Orión.",
        color: "#edb5ff", radius: 100
      });
    }
  });
}

// --- UNIVERSO GLOBAL: MILES DE PEQUEÑAS ESTRELLAS REPARTIDAS POR EL COSMOS ---
function crearUniversoEstrellas() {
  universeStarsMesh = crearCampoInterestelar(ALPHA_CENTAURI_POS);
  scene.add(universeStarsMesh);
}


// --- REGISTRO DE OBJETIVOS CELESTES PARA TELEMETRÍA Y DETECCIÓN SCI-FI ---
function registrarObjetivosCelestes() {
  celestialTargets = [
    {
      mesh: sunMesh,
      name: "SOL",
      type: "ESTRELLA (G2V)",
      category: "Centro del Sistema Solar",
      data: "Masa: 1.989 × 10³⁰ kg | Temp: 5.778 K",
      color: "#ffcc00"
    },
    {
      mesh: earthMesh,
      name: "TIERRA",
      type: "PLANETA ROCOSO",
      category: "Biosfera Habitable (Tercer Planeta)",
      data: "Radio: 6.371 km | Satélites: 1 (La Luna)",
      color: "#00e5ff"
    },
    {
      mesh: moonMesh,
      name: "LA LUNA",
      type: "SATÉLITE NATURAL",
      category: "Satélite Sincrónico de la Tierra",
      data: "Radio: 1.737 km | Dist: 384.400 km",
      color: "#e0e0e0"
    },
    {
      mesh: alphaStarA,
      name: "ALPHA CENTAURI A",
      type: "ESTRELLA BINARIA PRINCIPAL",
      category: "Sistema Rigil Kentaurus",
      data: "Distancia: 4.37 años luz | Tipo: G2V",
      color: "#ffe082"
    },
    {
      mesh: alphaStarB,
      name: "ALPHA CENTAURI B",
      type: "ESTRELLA COMPAÑERA",
      category: "Enana Naranja de Alpha Centauri",
      data: "Distancia: 4.37 años luz | Tipo: K1V",
      color: "#ff9800"
    },
    {
      mesh: proximaMesh,
      name: "PROXIMA CENTAURI",
      type: "ENANA ROJA FULGURANTE",
      category: "Estrella más cercana a la Tierra",
      data: "Distancia: 4.24 años luz | Exoplaneta b",
      color: "#ff5252"
    }
  ];

  // Registrar todos los planetas adicionales del Sistema Solar
  const metadataPlanetas = {
    Mercurio: {
      type: "PLANETA ROCOSO TELÚRICO",
      category: "Primer planeta del Sistema Solar",
      data: "Radio: 2.440 km | Período: 88 días terrestres",
      color: "#b0bec5"
    },
    Venus: {
      type: "PLANETA ROCOSO DE INVERNADERO",
      category: "Segundo planeta del Sistema Solar",
      data: "Radio: 6.052 km | Temp: 464°C | Presión: 92 atm",
      color: "#ffe082"
    },
    Marte: {
      type: "PLANETA ROCOSO DESÉRTICO",
      category: "Cuarto planeta (El Planeta Rojo)",
      data: "Radio: 3.390 km | Monte Olimpo | 2 lunas",
      color: "#ff7043"
    },
    Júpiter: {
      type: "GIGANTE GASEOSO MASIVO",
      category: "Quinto planeta (El Rey del Sistema)",
      data: "Radio: 69.911 km | Gran Mancha Roja | 95 lunas",
      color: "#ffca28"
    },
    Saturno: {
      type: "GIGANTE GASEOSO A ANILLADO",
      category: "Sexto planeta (El Señor de los Anillos)",
      data: "Radio: 58.232 km | Anillos de hielo | Titán",
      color: "#ffd54f"
    },
    Urano: {
      type: "GIGANTE DE HIELO (EJE INCLINADO)",
      category: "Séptimo planeta (Rotación lateral)",
      data: "Radio: 25.362 km | Temp: -224°C | 28 lunas",
      color: "#80deea"
    },
    Neptuno: {
      type: "GIGANTE DE HIELO AZUL",
      category: "Octavo planeta del Sistema Solar",
      data: "Radio: 24.622 km | Vientos: 2.100 km/h | Tritón",
      color: "#42a5f5"
    },
    "Plutón": {
      type: "PLANETA ENANO",
      category: "Objeto transneptuniano del cinturón de Kuiper",
      data: "Órbita excéntrica e inclinada | Período: unos 249 años | 5 lunas, incluida Caronte",
      color: "#d7ccc8"
    }
  };

  planetasSistemaSolar.forEach((p) => {
    if (p.nombre === "Tierra") return; // Ya registrada
    const meta = metadataPlanetas[p.nombre];
    if (meta && p.mesh) {
      celestialTargets.push({
        mesh: p.mesh,
        name: p.nombre.toUpperCase(),
        type: meta.type,
        category: meta.category,
        data: meta.data,
        color: meta.color
      });
    }

    if (p.lunas) {
      p.lunas.forEach((l) => {
        if (l.mesh) {
          celestialTargets.push({
            mesh: l.mesh,
            name: l.mesh.name.toUpperCase(),
            type: "SATÉLITE NATURAL",
            category: `Satélite de ${p.nombre}`,
            data: l.info || `Órbita sincrónica alrededor de ${p.nombre}`,
            color: "#e0e0e0"
          });
        }
      });
    }
  });

  // Añadir constelaciones zodiacales y sus estrellas al catálogo de telemetría de la mira
  if (Array.isArray(constellationTargets) && constellationTargets.length > 0) {
    celestialTargets.push(...constellationTargets);
  }
}

function detectarObjetivoVisor() {
  if (!hudVisible || !miraActiva()) return null;
  return detectarObjetivo(activeCamera, celestialTargets, centroVisorNDC());
}

// --- SISTEMA DE TELEMETRÍA Y DETECCIÓN SCI-FI DEL OBJETIVO ENFOCADO ---
function actualizarMiraYObjetivos(delta = 0) {
  const targetLabel = document.getElementById("scifiTargetLabel");
  if (!targetLabel) return;
  // Sin mira activa no hay panel, detección automática ni sonido de bloqueo.
  if (!hudVisible || !miraActiva()) {
    currentLockedTarget = null;
    if (!hudVisible) {
      lastClickPoint = null;
      lastClickPlanet = null;
    }
    targetLabel.style.display = "none";
    targetLabel.style.opacity = "0";
    return;
  }

  const detectedTarget = detectarObjetivoVisor();
  const historyPanel = document.getElementById("planetHistory");
  const followedTarget = followedPlanet && detectedTarget && detectedTarget.target.mesh === followedPlanet.mesh;
  if (historyPanel) actualizarHistoria(historyPanel, followedTarget ? followedPlanet.mesh.name : null, delta, hudVisible);

  if (detectedTarget) {
    const item = detectedTarget.target;

    if (currentLockedTarget !== item.name) {
      currentLockedTarget = item.name;
    }

    const nameEl = document.getElementById("scifiTargetName");
    const typeEl = document.getElementById("scifiTargetType");
    const distEl = document.getElementById("scifiTargetDist");
    const catEl = document.getElementById("scifiTargetCategory");
    const dataEl = document.getElementById("scifiTargetData");

    if (nameEl) {
      nameEl.textContent = item.name;
      nameEl.style.color = item.color || "#00e5ff";
    }
    if (typeEl) typeEl.textContent = item.type;
    if (catEl) catEl.textContent = item.category;
    if (dataEl) dataEl.textContent = item.data;
    if (distEl) distEl.textContent = `${detectedTarget.worldDistance.toFixed(1)} u`;
    document.getElementById("scifiTargetStatus").textContent = "⟪ OBJETIVO IDENTIFICADO ⟫";

    // El cartel con la información siempre visible arriba a la derecha cuando se apunta
    targetLabel.style.display = hudVisible ? "block" : "none";
    targetLabel.style.opacity = "1";
    targetLabel.style.transform = "translateX(0)";
  } else {
    currentLockedTarget = null;
    targetLabel.style.display = "none";
    targetLabel.style.opacity = "0";
  }
}

// --- VUELO DE PRECISIÓN DE LA NAVE ---
function actualizarVueloNave(delta) {
  if (currentViewMode === VIEW_MODES.FIRST_PERSON) followedPlanet = null;
  ship.roll = 0;
  ship.rotation.set(ship.pitch, ship.yaw, 0, "YXZ");
  ship.quaternion.setFromEuler(ship.rotation);

  const moveDirection = new THREE.Vector3();
  if (keys.KeyW) moveDirection.z -= 1;
  if (keys.KeyS) moveDirection.z += 1;
  if (keys.KeyA) moveDirection.x -= 1;
  if (keys.KeyD) moveDirection.x += 1;

  // Impulso momentáneo: requiere W y cualquiera de las teclas Shift pulsadas.
  const boost = keys.KeyW && (keys.ShiftLeft || keys.ShiftRight);
  const maxAllowedSpeed = boost ? ship.boostMaxSpeed : ship.maxSpeed;
  const acceleration = boost ? ship.boostAcceleration : ship.acceleration;
  if (moveDirection.lengthSq() > 0) {
    moveDirection.normalize().applyQuaternion(ship.quaternion);
    ship.velocity.addScaledVector(moveDirection, acceleration * delta);
  } else {
    ship.velocity.multiplyScalar(Math.pow(ship.damping, delta * 60));
  }
  if (ship.velocity.length() > maxAllowedSpeed) ship.velocity.setLength(maxAllowedSpeed);
  ship.speed = ship.velocity.length();
  ship.position.addScaledVector(ship.velocity, delta);
  cameraShip.position.copy(ship.position);
  cameraShip.quaternion.copy(ship.quaternion);
}

// --- VISTA GENERAL CON LIBERTAD TOTAL DE MOVIMIENTO (TECLAS WASD + RATÓN) ---
function actualizarCamaraGeneral(delta) {
  if (currentViewMode !== VIEW_MODES.GENERAL) return;
  const blend = 1 - Math.exp(-GENERAL_SMOOTHING * delta);
  const mouseX = generalMousePending.x * blend;
  const mouseY = generalMousePending.y * blend;
  generalMousePending.multiplyScalar(1 - blend);
  if (Math.abs(mouseX) + Math.abs(mouseY) > 1e-12) {
    if (followedPlanet) orbitarObjetoSeguido(mouseX, mouseY, ship.turnSpeed);
    else {
      aplicarGiroRaton(generalLook, mouseX, mouseY, ship.turnSpeed);
      cameraGeneral.quaternion.setFromEuler(new THREE.Euler(generalLook.pitch, generalLook.yaw, 0, "YXZ"));
      const distance = Math.max(10, cameraGeneral.position.distanceTo(cameraTarget));
      cameraTarget.copy(cameraGeneral.position).addScaledVector(cameraGeneral.getWorldDirection(new THREE.Vector3()), distance);
    }
  }

  const forward = new THREE.Vector3();
  cameraGeneral.getWorldDirection(forward);
  const right = new THREE.Vector3().crossVectors(forward, cameraGeneral.up).normalize();

  const moveDir = new THREE.Vector3();
  if (keys.KeyW) moveDir.add(forward);
  if (keys.KeyS) moveDir.sub(forward);
  if (keys.KeyA) moveDir.sub(right);
  if (keys.KeyD) moveDir.add(right);

  if (moveDir.lengthSq() > 0) {
    moveDir.normalize();
    // La combinación tiene prioridad sobre los modificadores individuales.
    const alt = keys.AltLeft || keys.AltRight;
    const shift = keys.ShiftLeft || keys.ShiftRight;
    const speed = alt && shift ? 3000 : alt ? 9 : shift ? 270 : 90;
    moveDir.multiplyScalar(speed);
  }
  // Integración exponencial exacta: misma respuesta con distintas tasas de fotogramas.
  const difference = generalVelocity.clone().sub(moveDir);
  const displacement = moveDir.clone().multiplyScalar(delta).addScaledVector(difference, blend / GENERAL_SMOOTHING);
  generalVelocity.copy(moveDir).addScaledVector(difference, 1 - blend);
  if (generalVelocity.lengthSq() < 1e-12) generalVelocity.set(0, 0, 0);
  cameraGeneral.position.add(displacement);
  cameraTarget.add(displacement);

}

// --- ALTERNANCIA ENTRE VISTAS (GENERAL -> CABINA) ---
function cambiarVista(modoObjetivo = null) {
  cancelarSeguimiento();
  generalVelocity.set(0, 0, 0);
  generalMousePending.set(0, 0);
  if (modoObjetivo !== null) {
    if (typeof modoObjetivo === "boolean") {
      currentViewMode = modoObjetivo ? VIEW_MODES.FIRST_PERSON : VIEW_MODES.GENERAL;
    } else {
      currentViewMode = modoObjetivo;
    }
  } else {
    currentViewMode = currentViewMode === VIEW_MODES.GENERAL
      ? VIEW_MODES.FIRST_PERSON : VIEW_MODES.GENERAL;
  }

  isFirstPerson = (currentViewMode === VIEW_MODES.FIRST_PERSON);
  renderer.domElement.style.cursor = isPointerLocked ? "none" : "default";

  const cockpitOverlay = document.getElementById("cockpitOverlay");
  actualizarVisibilidadHUD();

  if (currentViewMode === VIEW_MODES.FIRST_PERSON) {
    activeCamera = cameraShip;
    if (cockpitOverlay) cockpitOverlay.style.display = "block";
    mostrarMensajeHUD("🎮 Cabina: WASD para mover · Clic central para Activar / Desactivar vista con ratón", 3500);
  } else {
    activeCamera = cameraGeneral;
    sincronizarGiroGeneral();
    pointerLockWanted = false;
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
    renderer.domElement.style.cursor = "default";
    if (cockpitOverlay) cockpitOverlay.style.display = "none";
    mostrarMensajeHUD("🔭 Clic central: activar / desactivar vista con ratón · Doble clic izquierdo: seleccionar seguimiento planeta", 3500);
  }
  previousCollisionCenters.clear();
  actualizarZoom();
  activeCamera.updateMatrixWorld();
  if (hudVisible && miraActiva()) actualizarMiraYObjetivos();
}

// --- VELOCIDAD: ANIMACIÓN VISIBLE Y TIEMPO REAL INDEPENDIENTES ---
function setVelocidadAnimacion(factor) {
  if (!VELOCIDADES_SIMULACION.includes(factor)) return;
  simSpeed = factor;
  simulationTimeMode = "animation";
  isPaused = false;
  actualizarEstadoTiempo();
}

function setTiempoReal() {
  simSpeed = 1;
  simulationTimeMode = "real";
  isPaused = false;
  actualizarEstadoTiempo();
}

function actualizarEstadoTiempo() {
  const label = document.getElementById("simulationTimeLabel");
  const mode = simulationTimeMode === "real" ? "Tiempo real (1 segundo/s)"
    : `Animación ×${simSpeed} (${diasAnimacion(1, simSpeed).toLocaleString("es-ES")} días/s)`;
  if (label) label.textContent = `${isPaused ? "PAUSA · " : ""}${mode}`;
}

// --- PANEL DE INSTRUCCIONES / TECLAS (TECLA "TAB") ---
function toggleInstruccionesTab() {
  const panel = document.getElementById("controlsHelpPanel");
  if (!panel) return;

  const isHidden = panel.style.display === "none";
  panel.style.display = isHidden ? "block" : "none";
  labelsVisible = isHidden;
}

// --- EVENTOS DE USUARIO ---
function alternarZoom() {
  zoomIndex = (zoomIndex + 1) % ZOOM_LEVELS.length;
  actualizarZoom();
}

function actualizarRotulosConstelaciones() {
  const zoom = ZOOM_LEVELS[zoomIndex];
  const cameraPosition = activeCamera.position;
  const world = new THREE.Vector3();
  const viewPosition = new THREE.Vector3();
  constellationLabels.forEach(({ sprite, group, star }) => {
    group.getWorldPosition(world);
    const distance = world.distanceTo(cameraPosition);
    sprite.visible = hudVisible && labelsVisible
      && (!star || distance < DISTANCIA_DETALLE_CONSTELACION);
    if (!sprite.visible) return;
    sprite.getWorldPosition(viewPosition);
    viewPosition.applyMatrix4(activeCamera.matrixWorldInverse);
    const unitsPerPixel = 2 * Math.max(1, -viewPosition.z)
      * Math.tan(THREE.MathUtils.degToRad(activeCamera.fov / 2)) / window.innerHeight / zoom;
    const height = (star ? 34 : 50) * unitsPerPixel;
    sprite.scale.set(height * (star ? 4 : 8), height, 1);
    sprite.material.depthTest = false;
    sprite.renderOrder = 100;
  });
}

function miraActiva() {
  return isFirstPerson ? cabinReticleVisible : generalReticleVisible;
}

function actualizarVisibilidadHUD() {
  const root = document.getElementById("uiRoot");
  if (root) root.style.visibility = hudVisible ? "visible" : "hidden";
  const general = document.getElementById("generalReticle");
  if (general) general.style.display = hudVisible && !isFirstPerson && generalReticleVisible ? "block" : "none";
  const cabin = document.getElementById("cabinReticle");
  if (cabin) cabin.style.display = hudVisible && isFirstPerson && cabinReticleVisible ? "block" : "none";
  if (!hudVisible || !miraActiva()) actualizarMiraYObjetivos();
  actualizarRotulosConstelaciones();
}

function centroVisorNDC() {
  return isFirstPerson ? new THREE.Vector2(CABIN_SIGHT.x * 2 - 1, 1 - CABIN_SIGHT.y * 2)
    : new THREE.Vector2(0, 0);
}

function actualizarZoom() {
  const factor = ZOOM_LEVELS[zoomIndex];
  const w = window.innerWidth, h = window.innerHeight;
  if (factor === 1 && !isFirstPerson) activeCamera.clearViewOffset();
  else {
    const sight = isFirstPerson ? CABIN_SIGHT : { x: 0.5, y: 0.5 };
    // El eje frontal aparece en la mira, incluso al ampliar o cambiar de FOV.
    activeCamera.setViewOffset(w, h, w * 0.5 - w / factor * sight.x,
      h * 0.5 - h / factor * sight.y, w / factor, h / factor);
  }
}

function objetivoBajoCursor(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const sight = isFirstPerson ? CABIN_SIGHT : { x: 0.5, y: 0.5 };
  const clickOnReticle = miraActiva()
    && Math.abs(event.clientX - (rect.left + rect.width * sight.x)) <= 12
    && Math.abs(event.clientY - (rect.top + rect.height * sight.y)) <= 12;
  const useReticle = isPointerLocked || clickOnReticle;
  const ndc = useReticle ? centroVisorNDC()
    : new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1);
  scene.updateMatrixWorld();
  activeCamera.updateMatrixWorld();
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, activeCamera);
  if (!hudVisible) return { point: ray.ray.at(5000, new THREE.Vector3()), mesh: null };
  if (useReticle) {
    const marked = detectarObjetivoVisor();
    if (marked) return { point: marked.target.mesh.getWorldPosition(new THREE.Vector3()), mesh: marked.target.mesh };
  }
  const hit = ray.intersectObjects(obtenerCuerposColision(celestialTargets).map(body => body.mesh), false)[0];
  if (hit) return { point: hit.object.getWorldPosition(new THREE.Vector3()), mesh: hit.object };
  const target = detectarObjetivo(activeCamera, celestialTargets, ndc);
  if (target) {
    const mesh = target.target.mesh;
    const solid = mesh.isMesh && mesh.geometry && mesh.geometry.type === "SphereGeometry" && mesh.material.visible !== false;
    return { point: mesh.getWorldPosition(new THREE.Vector3()), mesh: solid ? mesh : null };
  }
  return { point: ray.ray.at(5000, new THREE.Vector3()), mesh: null };
}

function cancelarSeguimiento() {
  orientationTransition = null;
  followedPlanet = null;
}

function orientarHaciaPunto(event) {
  if (currentViewMode !== VIEW_MODES.GENERAL) return;
  const cursorHit = objetivoBajoCursor(event);
  const cachedHit = hudVisible && lastClickPoint && performance.now() - lastClickTime < 700
    ? { point: lastClickPoint.clone(), mesh: lastClickPlanet } : null;
  // Un nuevo objeto bajo el cursor tiene prioridad sobre el objetivo bloqueado
  // o una selección anterior conservada durante el cambio de captura.
  const newCursorTarget = followedPlanet && !isPointerLocked && cursorHit.mesh
    && cursorHit.mesh !== followedPlanet.mesh;
  const hit = newCursorTarget ? cursorHit : cachedHit || cursorHit;
  if (followedPlanet && !hit.mesh) return;
  generalMousePending.set(0, 0);
  generalVelocity.set(0, 0, 0);
  if (hit.mesh) {
    cancelarSeguimiento();
    for (const key of ["KeyW", "KeyA", "KeyS", "KeyD"]) keys[key] = false;
  }
  const startQuat = activeCamera.quaternion.clone();
  const startDistance = Math.max(10, activeCamera.position.distanceTo(cameraTarget));
  orientationTransition = {
    startQuat, point: hit.point.clone(), elapsed: 0,
    startDistance, endDistance: hit.mesh ? activeCamera.position.distanceTo(hit.point) : startDistance
  };
  followedPlanet = currentViewMode === VIEW_MODES.GENERAL && hit.mesh
    ? { mesh: hit.mesh, lastPosition: hit.point.clone() } : null;
  if (followedPlanet) mostrarMensajeHUD(`Siguiendo ${hit.mesh.name} · Ratón para orbitar · WASD para salir`, 2300);
  lastClickPoint = null;
  lastClickPlanet = null;
}

function actualizarOrientacionYSeguimiento(delta) {
  // Invariante: la cabina nunca hereda ni actualiza un seguimiento.
  if (currentViewMode !== VIEW_MODES.GENERAL) followedPlanet = null;
  if (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD) {
    cancelarSeguimiento();
    return;
  }
  let target = null;
  if (followedPlanet) {
    target = followedPlanet.mesh.getWorldPosition(new THREE.Vector3());
    const displacement = target.clone().sub(followedPlanet.lastPosition);
    if (isFirstPerson) {
      ship.position.add(displacement);
      cameraShip.position.copy(ship.position);
    } else {
      cameraGeneral.position.add(displacement);
      cameraTarget.add(displacement);
    }
    followedPlanet.lastPosition.copy(target);
  }
  if (!orientationTransition && !followedPlanet) return;
  const desired = new THREE.PerspectiveCamera();
  desired.position.copy(activeCamera.position);
  desired.lookAt(target || orientationTransition.point);
  if (orientationTransition) {
    orientationTransition.elapsed += delta;
    const t = Math.min(1, orientationTransition.elapsed / POINT_TURN_DURATION);
    const ease = THREE.MathUtils.smootherstep(t, 0, 1);
    activeCamera.quaternion.slerpQuaternions(orientationTransition.startQuat, desired.quaternion, ease);
    if (!isFirstPerson) {
      const distance = THREE.MathUtils.lerp(orientationTransition.startDistance,
        orientationTransition.endDistance, ease);
      cameraTarget.copy(activeCamera.position).addScaledVector(
        activeCamera.getWorldDirection(new THREE.Vector3()), distance);
    }
    if (t === 1) orientationTransition = null;
  } else {
    if (!isFirstPerson) cameraTarget.copy(target);
    activeCamera.quaternion.copy(desired.quaternion);
  }
  if (isFirstPerson) {
    ship.quaternion.copy(cameraShip.quaternion);
    ship.rotation.setFromQuaternion(ship.quaternion, "YXZ");
    ship.yaw = ship.rotation.y;
    ship.pitch = ship.rotation.x;
  } else {
    sincronizarGiroGeneral();
  }
}

function sincronizarGiroGeneral() {
  const rotation = new THREE.Euler().setFromQuaternion(cameraGeneral.quaternion, "YXZ");
  generalLook.yaw = rotation.y;
  generalLook.pitch = rotation.x;
}

function orbitarObjetoSeguido(deltaX, deltaY, sensitivity = ship.turnSpeed / ZOOM_LEVELS[zoomIndex]) {
  if (currentViewMode !== VIEW_MODES.GENERAL) { followedPlanet = null; return; }
  const center = followedPlanet.mesh.getWorldPosition(new THREE.Vector3());
  activeCamera.position.add(center.clone().sub(followedPlanet.lastPosition));
  const offset = activeCamera.position.clone().sub(center);
  const orbit = new THREE.Spherical().setFromVector3(offset);
  orbit.theta -= deltaX * sensitivity;
  orbit.phi = THREE.MathUtils.clamp(orbit.phi - deltaY * sensitivity, 0.03, Math.PI - 0.03);
  offset.setFromSpherical(orbit);
  activeCamera.position.copy(center).add(offset);
  activeCamera.lookAt(center);
  orientationTransition = null;
  followedPlanet.lastPosition.copy(center);
  if (isFirstPerson) {
    ship.position.copy(activeCamera.position);
    ship.quaternion.copy(activeCamera.quaternion);
    ship.rotation.setFromQuaternion(ship.quaternion, "YXZ");
    ship.yaw = ship.rotation.y; ship.pitch = ship.rotation.x;
    ship.velocity.set(0, 0, 0);
    ship.speed = 0;
  } else {
    cameraTarget.copy(center);
    sincronizarGiroGeneral();
  }
}

// Mismo giro de primera persona, sin alabeo, para nave y vista general.
function aplicarGiroRaton(look, deltaX, deltaY, sensitivity = ship.turnSpeed / ZOOM_LEVELS[zoomIndex]) {
  look.yaw -= deltaX * sensitivity;
  look.pitch = THREE.MathUtils.clamp(look.pitch - deltaY * sensitivity, -Math.PI / 2.1, Math.PI / 2.1);
}

function solicitarCapturaRaton() {
  if (pointerLockPending || document.pointerLockElement === renderer.domElement
    || !renderer.domElement.requestPointerLock) return;
  pointerLockPending = true;
  const failed = () => {
    pointerLockPending = false;
    pointerLockWanted = false;
  };
  try {
    // También admite navegadores donde requestPointerLock no devuelve una promesa.
    const request = renderer.domElement.requestPointerLock();
    if (request && request.catch) request.catch(failed);
  } catch (error) { failed(); }
}

let fullscreenPending = false;
async function alternarPantallaCompleta() {
  if (fullscreenPending) return;
  fullscreenPending = true;
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen({ keyboardLock: "browser" });
    if (navigator.keyboard?.lock) {
      try {
        await navigator.keyboard.lock(["KeyW", "KeyA", "KeyS", "KeyD", "Escape", "F11"]);
      } catch (error) {
        mostrarMensajeHUD("Pantalla completa activa; el navegador no ha permitido proteger los atajos.", 3000);
      }
    }
  } catch (error) {
    mostrarMensajeHUD("No se pudo cambiar a pantalla completa.", 2500);
  } finally {
    fullscreenPending = false;
  }
}

function setupEvents() {
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) return;
    navigator.keyboard?.unlock?.();
    Object.keys(keys).forEach((key) => { keys[key] = false; });
  });
  // El botón derecho amplía el visor sin desplazar la cámara orbital.
  renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  renderer.domElement.addEventListener("auxclick", (e) => {
    if (e.button === 1) e.preventDefault();
  });
  renderer.domElement.addEventListener("mousedown", (e) => {
    if (e.button !== 2) return;
    e.preventDefault();
    e.stopPropagation();
    alternarZoom();
  });
  renderer.domElement.addEventListener("dblclick", orientarHaciaPunto);
  window.addEventListener("keydown", (e) => {
    if (e.code === "F11") {
      e.preventDefault();
      if (!e.repeat) void alternarPantallaCompleta();
      return;
    }
    if (e.code === "Escape" && isFirstPerson) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Tecla TAB: Ocultar o mostrar panel de teclas e instrucciones.
    if (e.code === "Tab") {
      e.preventDefault();
      if (!e.repeat) toggleInstruccionesTab();
      return;
    }

    if (keys.hasOwnProperty(e.code)) {
      keys[e.code] = true;
      if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
        cancelarSeguimiento();
        if (keys.AltLeft || keys.AltRight || e.altKey) e.preventDefault?.();
      }
    }
    if (e.code === "KeyV" && !e.repeat) cambiarVista();
    if (e.code === "KeyZ" && !e.repeat) alternarZoom();
    if (e.code === "KeyT" && !e.repeat) {
      if (isFirstPerson) cabinReticleVisible = !cabinReticleVisible;
      else generalReticleVisible = !generalReticleVisible;
      actualizarVisibilidadHUD();
      if (miraActiva() && hudVisible) actualizarMiraYObjetivos();
    }
    if (e.code === "KeyF" && !e.repeat) {
      hudVisible = !hudVisible;
      if (hudVisible) {
        generalReticleVisible = true;
        cabinReticleVisible = true;
      }
      actualizarVisibilidadHUD();
      if (hudVisible) actualizarMiraYObjetivos();
    }
    if (e.code === "KeyP" && !e.repeat) {
      isPaused = !isPaused;
      actualizarEstadoTiempo();
      mostrarMensajeHUD(isPaused ? "⏸️ Órbitas Pausadas" : "▶️ Órbitas Reanudadas", 1500);
    }
    const speedKey = /^Digit[1-5]$/.test(e.code) ? Number(e.code.slice(-1)) : Number(e.key);
    if (speedKey >= 1 && speedKey <= 5) setVelocidadAnimacion(VELOCIDADES_SIMULACION[speedKey - 1]);
    if (e.code === "Digit0" || e.key === "0") setTiempoReal();
  });

  window.addEventListener("blur", () => {
    Object.keys(keys).forEach((key) => { keys[key] = false; });
    isMouseDown = false;
    generalVelocity.set(0, 0, 0);
    generalMousePending.set(0, 0);
  });

  window.addEventListener("keyup", (e) => {
    if (keys.hasOwnProperty(e.code)) {
      keys[e.code] = false;
    }
  });

  window.addEventListener("mousedown", (e) => {
    if (e.button === 1 && e.target === renderer.domElement) {
      e.preventDefault?.();
      isMouseDown = false;
      if (pointerLockWanted || isPointerLocked || pointerLockPending) {
        pointerLockWanted = false;
        generalMousePending.set(0, 0);
        if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      } else {
        if (!followedPlanet) orientationTransition = null;
        if (currentViewMode === VIEW_MODES.GENERAL) sincronizarGiroGeneral();
        pointerLockWanted = true;
        solicitarCapturaRaton();
      }
      return;
    }
    if (e.button === 0 && e.target === renderer.domElement) {
      if (!e.detail || e.detail === 1) {
        const sight = isFirstPerson ? CABIN_SIGHT : { x: 0.5, y: 0.5 };
        const hit = objetivoBajoCursor(isPointerLocked
          ? { clientX: sight.x * window.innerWidth, clientY: sight.y * window.innerHeight } : e);
        lastClickPoint = hit.point;
        lastClickPlanet = hit.mesh;
        lastClickTime = performance.now();
      }
      if (currentViewMode === VIEW_MODES.GENERAL) return;
      orientationTransition = null;
      isMouseDown = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  });

  window.addEventListener("mouseup", () => {
    isMouseDown = false;
  });

  document.addEventListener("pointerlockchange", () => {
    const wasLocked = isPointerLocked;
    isPointerLocked = document.pointerLockElement === renderer.domElement;
    pointerLockPending = false;
    if (isPointerLocked && !pointerLockWanted) {
      document.exitPointerLock();
      return;
    }
    if (wasLocked && !isPointerLocked) { isMouseDown = false; generalMousePending.set(0, 0); }
    if (!isPointerLocked) pointerLockWanted = false;
    renderer.domElement.style.cursor = isPointerLocked ? "none" : "default";
  });
  document.addEventListener("pointerlockerror", () => {
    pointerLockPending = false;
    pointerLockWanted = false;
  });

  window.addEventListener("mousemove", (e) => {
    const general = currentViewMode === VIEW_MODES.GENERAL;
    if (general && !isPointerLocked) return;

    let deltaX = 0;
    let deltaY = 0;

    if (isPointerLocked) {
      deltaX = e.movementX || 0;
      deltaY = e.movementY || 0;
    } else if (isMouseDown) {
      deltaX = e.clientX - previousMousePosition.x;
      deltaY = e.clientY - previousMousePosition.y;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }

    if (deltaX !== 0 || deltaY !== 0) {
      if (general) {
        generalMousePending.x += deltaX / ZOOM_LEVELS[zoomIndex];
        generalMousePending.y += deltaY / ZOOM_LEVELS[zoomIndex];
        if (!followedPlanet) orientationTransition = null;
        return;
      }
      if (followedPlanet) { orbitarObjetoSeguido(deltaX, deltaY); return; }
      cancelarSeguimiento();
      aplicarGiroRaton(ship, deltaX, deltaY);
    }
  });

  window.addEventListener("resize", () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    cameraGeneral.aspect = w / h;
    cameraGeneral.updateProjectionMatrix();
    cameraShip.aspect = w / h;
    cameraShip.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}

let hudTimeout = null;
function mostrarMensajeHUD(texto, duracion = 3500) {
  const msgEl = document.getElementById("hudMessage");
  if (!msgEl) return;
  msgEl.textContent = texto;
  msgEl.style.opacity = "1";
  if (hudTimeout) clearTimeout(hudTimeout);
  hudTimeout = setTimeout(() => {
    msgEl.style.opacity = "0";
  }, duracion);
}

// --- CONSTRUCCIÓN DE LA INTERFAZ DE USUARIO ---
// Croma limitado a los cristales, con el panel de instrumentos protegido.
function aplicarCromaCristales(data, width, height) {
  for (let y = 0; y < height; y++) {
    const imageY = y * 941 / height;
    if (imageY >= 703) continue;
    for (let x = 0; x < width; x++) {
      const imageX = x * 1672 / width;
      if (imageY >= 659 && imageX >= 610 && imageX <= 994) continue;
      if (imageY >= 650 && ((imageX >= 635 && imageX <= 685)
        || (imageX >= 850 && imageX <= 905))) continue;
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const maxRB = Math.max(r, b);
      const diff = g - maxRB;
      if ((diff > 25 && g > 75) || (g > 150 && r < 70 && b < 70)) {
        data[i + 3] = 0;
      } else if (diff > 10 && g > 60) {
        data[i + 3] = Math.round(data[i + 3] * (1 - (diff - 10) / 15));
        data[i + 1] = maxRB;
      }
    }
  }
}

function procesarCromaHalcon(url, overlay) {
  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      aplicarCromaCristales(pixels.data, canvas.width, canvas.height);
      ctx.putImageData(pixels, 0, 0);
      overlay.style.backgroundImage = `url('${canvas.toDataURL("image/png")}')`;
    } catch (error) {
      console.error("Error al aplicar el croma de los cristales", error);
    }
  };
  img.src = url;
}

function setupUI() {
  const uiContainer = document.createElement("div");
  uiContainer.id = "uiRoot";

  const inSrc = window.location.pathname.includes("/src/");
  const initialCockpitBg = inSrc ? "../img/Halcon_Milenario.png" : "img/Halcon_Milenario.png";

  uiContainer.innerHTML = `
    <!-- TEXTURA INTERIOR DEL HALCÓN MILENARIO (CABINA 1ª PERSONA) -->
    <div id="cockpitOverlay">
      <canvas id="solarRadar" width="180" height="208" role="img" aria-label="Radar de dirección del Sol respecto a la nave" style="left:${CABIN_RADAR.x * 100}%;top:${CABIN_RADAR.y * 100}%;width:${CABIN_RADAR.width * 100}%;height:${CABIN_RADAR.height * 100}%;"></canvas>
    </div>

    <div id="cabinReticle" aria-hidden="true" style="display:none;left:${CABIN_SIGHT.x * 100}%;top:${CABIN_SIGHT.y * 100}%;"></div>
    <div id="generalReticle" aria-hidden="true" style="display:none;left:50%;top:50%;"></div>

    <section id="animationSpeedPanel" class="scifi-target-box" aria-labelledby="animationSpeedTitle">
      <div id="animationSpeedTitle">VELOCIDAD DE ANIMACIÓN</div>
      <div id="simulationTimeLabel">Animación ×1 (0,25 días/s)</div>
    </section>

    <!-- Información del objetivo bajo la mira. -->
    <div id="scifiTargetLabel" class="scifi-target-box">
      <div style="
        display: flex; justify-content: space-between; align-items: center;
        font-family: 'Orbitron', monospace; font-size: 10px; color: #00ffaa;
        letter-spacing: 1.5px; border-bottom: 1px solid rgba(0, 229, 255, 0.3);
        padding-bottom: 4px; margin-bottom: 6px;
      ">
        <span id="scifiTargetStatus">⟪ VISOR ACTIVO ⟫</span>
        <span id="scifiTargetDist" style="color: #ffe082; font-weight: bold;">-</span>
      </div>

      <div id="scifiTargetName" style="
        font-family: 'Orbitron', monospace; font-weight: 900; font-size: 18px;
        color: #00e5ff; text-shadow: 0 0 10px rgba(0, 229, 255, 0.7);
        letter-spacing: 1px; line-height: 1.2;
      ">SOL</div>

      <div id="scifiTargetType" style="
        font-size: 13px; font-weight: 700; color: #80deea;
        letter-spacing: 0.8px; margin-top: 3px;
      ">ESTRELLA (G2V)</div>

      <div id="scifiTargetCategory" style="
        font-size: 11.5px; color: #b0bec5; margin-top: 4px;
      ">Centro del Sistema Solar</div>

      <div id="scifiTargetData" style="
        font-size: 11px; color: #81d4fa; margin-top: 5px;
        border-top: 1px dashed rgba(255, 255, 255, 0.15); padding-top: 4px;
      ">Telemetría astronómica</div>
      <div id="planetHistory" style="display:none;" aria-label="Historia y curiosidades del planeta seguido"></div>
    </div>

    <!-- Mensaje HUD central -->
    <div id="hudMessage"></div>

    <!-- RECORDATORIO DISCRETO DE INSTRUCCIONES TAB -->
    <div id="controlsReminder">
      [TAB] Controles y nombres de constelaciones
    </div>

    <!-- PANEL DE INSTRUCCIONES / TECLAS (TECLA TAB) -->
    <div id="controlsHelpPanel">
      <div style="font-family: 'Orbitron', monospace; color: #ffd54f; font-weight: bold; font-size: 12px; margin-bottom: 6px; letter-spacing: 1px;">
        🎮 CONTROLES Y NAVEGACIÓN
        </div>
        <div class="controls-help-sections">
        <section>
        <div><b style="color: #fff;">[TAB]</b>: Mostrar / Ocultar controles y nombres de constelaciones</div>
        <div><b style="color: #fff;">[Clic rueda ratón]</b>: VISTA CON MOUSE On/Off</div>
        <div><b style="color: #fff;">[W,A,S,D]</b>: teclas de movimiento</div>
        <div><b style="color: #fff;">[V]</b>: Alternar vista libre / Cabina</div>
          <div><b style="color: #fff;">[F]</b>: Mostrar / ocultar información (instrucciones con Tab)</div>
          </section>
          <section>
        <h3>Modo vista libre</h3>
          <div><b style="color: #fff;">[Alt + WASD]</b>: Velocidad de paseo</div>
          <div><b style="color: #fff;">[Shift + WASD]</b>: Alta velocidad</div>
          <div><b style="color: #fff;">[Shift + Alt + WASD]</b>: Velocidad luz</div>
          <div><b style="color: #fff;">[Doble clic izquierdo]</b>: en vista libre On: seguir objeto; WASD para salir</div>
          </section>
          <section>
          <h3>Modo Halcón Milenario</h3>
          <div><b style="color: #fff;">[W + Shift]</b>: <span style="color: #00e5ff; font-weight: bold;">Hipervelocidad mientras mantienes Shift; suéltala para volver al vuelo lento</span></div>
          <div><b style="color: #fff;">[T]</b>: Mostrar / Ocultar punto de mira</div>
          </section>
          <section>
          <h3>Otras teclas</h3>
          <button id="keyboardProtectionBtn" type="button">Pantalla completa [F11]</button>
          <div><b style="color: #fff;">[1, 2, 3, 4, 5]</b>: Animación ×1, ×2, ×4, ×8, ×16 (0,25–4 días/s)</div>
          <div><b style="color: #fff;">[0]</b>: Tiempo real</div>
          <div><b style="color: #fff;">[Z / Clic derecho]</b>: Zoom del visor ×1 / ×2 / ×4 / ×8</div>
          <div><b style="color: #fff;">[P]</b>: Pausar / Reanudar órbitas</div>
          <div><b style="color: #fff;">[T]</b>: Mostrar / ocultar punto de mira</div>
        </section>
      </div>
    </div>
  `;
  document.body.appendChild(uiContainer);
  document.getElementById("cockpitOverlay").style.backgroundImage = `url('${initialCockpitBg}')`;
  document.getElementById("keyboardProtectionBtn").addEventListener("click", alternarPantallaCompleta);
  solarRadarContext = document.getElementById("solarRadar").getContext("2d");


  procesarCromaHalcon(initialCockpitBg, document.getElementById("cockpitOverlay"));
}

// Dinámica independiente del renderizado: animación en días/s o tiempo real en segundos/s.
function actualizarDinamica(delta) {
  if (!isPaused) {
    const days = simulationTimeMode === "real" ? diasSimulados(delta, 1) : diasAnimacion(delta, simSpeed);
    const turn = 2 * Math.PI * days;
    simulationDays += days;
    alphaOrbitTime += days;
    // Periodos ilustrativos para partículas y binaria; comparten el reloj físico.
    if (asteroidBelt) asteroidBelt.rotation.y += turn / (4.6 * 365.25);
    if (sunMesh) sunMesh.rotation.y += turn / 25.38;
    if (earthCloudsMesh) earthCloudsMesh.rotation.y += turn / (ROTACION_HORAS.Tierra / 24) * 1.08;

    // Actualizar rotaciones y traslaciones de todos los planetas del Sistema Solar
    planetasSistemaSolar.forEach((p) => {
      p.planetPivot.position.fromArray(posicionEnDias(p.elementos, simulationDays));
      if (p.ringAsteroids) p.ringAsteroids.rotation.y += turn / 0.5;
      if (p.mesh && ROTACION_HORAS[p.nombre]) {
        p.mesh.rotation.y += turn / (ROTACION_HORAS[p.nombre] / 24);
      }
      if (p.lunas) {
        p.lunas.forEach((l) => {
          if (l.pivot && PERIODOS_LUNAS[l.mesh.name]) {
            l.pivot.rotation.y += turn / PERIODOS_LUNAS[l.mesh.name];
          }
        });
      }
    });

    if (alphaStarB) {
      const alphaTime = alphaOrbitTime * 2 * Math.PI / (80 * 365.25);
      alphaStarB.position.x = Math.cos(alphaTime) * 38;
      alphaStarB.position.z = Math.sin(alphaTime) * 38;
    }
  }
}

function actualizarColisiones(inicio) {
  scene.updateMatrixWorld(true);
  const bodies = obtenerCuerposColision(celestialTargets, previousCollisionCenters);
  const destination = isFirstPerson ? ship.position : cameraGeneral.position;
  const result = resolverColisiones(inicio, destination, bodies);
  const correction = result.position.clone().sub(destination);
  lastCollision = result.contacts.length ? result.contacts[0] : null;
  if (isFirstPerson) {
    ship.position.copy(result.position);
    for (const contact of result.contacts) {
      const inwardSpeed = ship.velocity.dot(contact.normal);
      if (inwardSpeed < 0) ship.velocity.addScaledVector(contact.normal, -inwardSpeed);
    }
    ship.speed = ship.velocity.length();
    cameraShip.position.copy(ship.position);
  } else {
    cameraGeneral.position.copy(result.position);
    cameraTarget.add(correction);
    for (const contact of result.contacts) {
      const inwardSpeed = generalVelocity.dot(contact.normal);
      if (inwardSpeed < 0) generalVelocity.addScaledVector(contact.normal, -inwardSpeed);
    }
  }
  previousCollisionCenters = new Map(bodies.map(body => [body.mesh, body.center.clone()]));
}

// --- BUCLE PRINCIPAL DE ANIMACIÓN Y RENDERIZADO ---
// Radar relativo a la cabina: arriba = delante, derecha = estribor.
// La elevación indica si el Sol está por encima o por debajo del plano de la nave.
function actualizarRadarSolar() {
  if (!isFirstPerson || !solarRadarContext || !sunMesh) return;
  sunMesh.getWorldPosition(radarSunPosition);
  cameraShip.getWorldPosition(radarShipPosition);
  cameraShip.getWorldQuaternion(radarInverseRotation).invert();
  radarSunPosition.sub(radarShipPosition).applyQuaternion(radarInverseRotation);
  const distance = radarSunPosition.length();
  if (distance > 0) radarSunPosition.divideScalar(distance);

  const ctx = solarRadarContext;
  const cx = 90, cy = 108, radius = 66;
  ctx.fillStyle = "#031b2c";
  ctx.fillRect(0, 0, 180, 208);
  ctx.strokeStyle = "#16768f";
  ctx.lineWidth = 2;
  for (const r of [radius / 2, radius]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();

  // Proyección sobre el plano horizontal local, independiente del zoom y la distancia.
  const x = cx + radarSunPosition.x * radius * 0.85;
  const y = cy + radarSunPosition.z * radius * 0.85;
  ctx.strokeStyle = "#ffd54f";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = "#ffd54f";
  ctx.shadowColor = "#ffb300";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#b5faff";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx - 5, cy + 5);
  ctx.lineTo(cx + 5, cy + 5);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = "center";
  ctx.font = "bold 22px monospace";
  ctx.fillStyle = "#ffd54f";
  ctx.fillText("SOL", cx, 27);
  const elevation = Math.round(THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(radarSunPosition.y, -1, 1))));
  ctx.font = "bold 18px monospace";
  ctx.fillStyle = "#b5faff";
  ctx.fillText(`EL ${elevation >= 0 ? "+" : ""}${elevation}°`, cx, 198);
}

function animate() {
  requestAnimationFrame(animate);
  const elapsedDelta = clock.getDelta();
  const delta = Math.min(elapsedDelta, 0.1);
  const collisionStart = (isFirstPerson ? ship.position : cameraGeneral.position).clone();
  // La física usa el tiempo transcurrido completo; los controles limitan los saltos de frame.
  actualizarDinamica(elapsedDelta);

  // 2. Control de vuelo de la nave o cámara general
  if (currentViewMode === VIEW_MODES.GENERAL) {
    actualizarCamaraGeneral(delta);
  } else {
    actualizarVueloNave(delta);
  }

  actualizarOrientacionYSeguimiento(delta);

  actualizarColisiones(collisionStart);
  efectoVelocidad.userData.update(delta,
    isFirstPerson && keys.KeyW && (keys.ShiftLeft || keys.ShiftRight), ship.speed, isFirstPerson);

  // 4. Telemetría y detección holográfica Sci-Fi arriba a la derecha
  actualizarZoom();
  activeCamera.updateMatrixWorld();
  actualizarRadarSolar();
  actualizarRotulosConstelaciones();
  actualizarMiraYObjetivos(delta);

  // 6. Renderizado de la escena
  renderer.render(scene, activeCamera);
}
