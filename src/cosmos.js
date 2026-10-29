import * as THREE from "three";

// Un único material de puntos circulares, sin bordes cuadrados ni imagen de fondo.
let pointTexture;
export function materialPuntos(size, color = 0xffffff, opacity = 1) {
  if (!pointTexture) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 15);
    gradient.addColorStop(0, "white");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.95)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    pointTexture = new THREE.CanvasTexture(canvas);
  }
  return new THREE.PointsMaterial({
    size, color, opacity, map: pointTexture, transparent: true,
    depthWrite: false, alphaTest: 0.02, blending: THREE.AdditiveBlending,
    fog: false
  });
}

function nubePuntos(positions, material, name) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, material);
  points.name = name;
  return points;
}

export function crearViaLactea() {
  const positions = [];
  const rotation = new THREE.Euler(0.65, 0.2, -0.4);
  const p = new THREE.Vector3();
  for (let i = 0; i < 24000; i++) {
    const angle = Math.random() * Math.PI * 2;
    const latitude = (Math.random() + Math.random() + Math.random() - 1.5) * 0.14;
    const radius = 10000 + Math.random() * 2500;
    p.set(Math.cos(angle) * Math.cos(latitude), Math.sin(latitude),
      Math.sin(angle) * Math.cos(latitude)).multiplyScalar(radius).applyEuler(rotation);
    positions.push(p.x, p.y, p.z);
  }
  return nubePuntos(positions, materialPuntos(1.6, 0xabc5ee, 0.65), "ViaLacteaPuntos");
}

export function crearCampoInterestelar(destino) {
  const positions = [];
  // Volumen continuo que incluye ambos sistemas y el espacio que los separa.
  for (let i = 0; i < 10000; i++) {
    const t = Math.random();
    const x = (Math.random() - 0.5) * 9500;
    const y = (Math.random() - 0.5) * 7500 + destino.y * t;
    const z = destino.z * t + (Math.random() - 0.5) * 6500;
    if (Math.hypot(x, y, z) < 280 || Math.hypot(x - destino.x, y - destino.y, z - destino.z) < 220) continue;
    positions.push(x, y, z);
  }
  return nubePuntos(positions, materialPuntos(2.0, 0xe4edff, 0.9), "EstrellasInterestelares");
}

export function crearCinturonAsteroides() {
  const group = new THREE.Group();
  group.name = "CinturonAsteroides";
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0x93877b, roughness: 1 }), 2400);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < mesh.count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = (2.1 + Math.random() * 1.2) * 45;
    dummy.position.set(Math.cos(angle) * r, (Math.random() - 0.5) * 3.2, Math.sin(angle) * r);
    dummy.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    const size = 0.10 + Math.random() * 0.30;
    dummy.scale.set(size, size * (0.5 + Math.random()), size * (0.7 + Math.random()));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.08, 0.08, 0.25 + Math.random() * 0.35);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
  return group;
}

// Fragmentos de hielo y roca en el plano ecuatorial; una sola llamada de dibujo.
export function crearAsteroidesAnillosSaturno(radioInterno, radioExterno) {
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), 6000);
  mesh.name = "AsteroidesAnillosSaturno";
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const width = radioExterno - radioInterno;
  for (let i = 0; i < mesh.count; i++) {
    let fraction;
    // División de Cassini, alineada con la textura de los anillos.
    do { fraction = Math.random(); } while (fraction > 0.70 && fraction < 0.74);
    const r = radioInterno + fraction * width;
    const angle = Math.random() * Math.PI * 2;
    dummy.position.set(Math.cos(angle) * r, (Math.random() - 0.5) * 0.045, Math.sin(angle) * r);
    dummy.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    const size = 0.025 + Math.random() * 0.045;
    dummy.scale.set(size, size * (0.5 + Math.random() * 0.5), size * (0.6 + Math.random() * 0.4));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.10, 0.12 + Math.random() * 0.15, 0.48 + Math.random() * 0.4);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// Figuras reconocibles en una bóveda ilustrativa; no es un catálogo astrométrico.
export const CONSTELACIONES_EXTRA = [
  { nombre: "ORIÓN", centro: [-2300, -2100, -2800], info: "El cazador. Destacan Betelgeuse, Rigel y el cinturón de tres estrellas.",
    estrellas: [["Betelgeuse", -90, 100], ["Bellatrix", 70, 95], ["Alnitak", -45, 0], ["Alnilam", 0, 10], ["Mintaka", 45, 20], ["Saiph", -75, -120], ["Rigel", 100, -105]],
    conexiones: [[0,1],[0,2],[1,4],[2,3],[3,4],[2,5],[4,6],[5,6]] },
  { nombre: "CASIOPEA", centro: [1700, 3400, -1600], info: "Constelación boreal reconocible por su figura de W.",
    estrellas: [["Caph", -150, 60], ["Schedar", -75, -45], ["Navi", 0, 55], ["Ruchbah", 75, -30], ["Segin", 150, 75]],
    conexiones: [[0,1],[1,2],[2,3],[3,4]] },
  { nombre: "OSA MAYOR", centro: [-3300, 2300, 1100], info: "El Carro Mayor: siete estrellas forman el asterismo del gran cucharón.",
    estrellas: [["Dubhe", 120, 60], ["Merak", 110, -35], ["Phecda", 10, -55], ["Megrez", 0, 35], ["Alioth", -75, 55], ["Mizar", -145, 85], ["Alkaid", -220, 60]],
    conexiones: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]] },
  { nombre: "OSA MENOR", centro: [100, 4200, 700], info: "El Carro Menor. Polaris señala aproximadamente el polo norte celeste.",
    estrellas: [["Polaris", -160, 100], ["Yildun", -95, 65], ["Epsilon UMi", -30, 35], ["Zeta UMi", 35, 10], ["Kochab", 95, 40], ["Pherkad", 115, -35], ["Eta UMi", 45, -55]],
    conexiones: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]] },
  { nombre: "CISNE", centro: [3200, 2200, 1900], info: "La Cruz del Norte, con Deneb en la cola y Albireo en la cabeza.",
    estrellas: [["Deneb", 0, 150], ["Sadr", 0, 40], ["Albireo", 0, -145], ["Gienah", -130, 0], ["Delta Cygni", 125, 70]],
    conexiones: [[0,1],[1,2],[1,3],[1,4]] },
  { nombre: "ANDRÓMEDA", centro: [2900, 1900, -2500], info: "La princesa encadenada. En esta dirección se encuentra la galaxia de Andrómeda (M31).",
    estrellas: [["Alpheratz", -170, -70], ["Delta Andromedae", -85, -15], ["Mirach", 0, 30], ["Almach", 140, 100], ["Mu Andromedae", 0, 110], ["Nu Andromedae", 30, 170]],
    conexiones: [[0,1],[1,2],[2,3],[2,4],[4,5]] }
];

export function crearNebulosa(nombre, galaxia = false) {
  const positions = [], colors = [];
  const c = new THREE.Color();
  const count = galaxia ? 7000 : 4000;
  for (let i = 0; i < count; i++) {
    const r = Math.pow(Math.random(), 1.5);
    const a = Math.random() * Math.PI * 2;
    if (galaxia) {
      const arm = a + r * 10;
      positions.push(Math.cos(arm) * r * 145, (Math.random() - 0.5) * 12 * (1-r), Math.sin(arm) * r * 70);
      c.setHSL(0.11 + r * 0.48, 0.25, 0.7 - r * 0.2);
    } else {
      positions.push(Math.cos(a) * r * 85, Math.sin(a) * r * 65, (Math.random() - 0.5) * 60 * (1-r));
      c.setHSL(0.84 + Math.random() * 0.12, 0.65, 0.45 + Math.random() * 0.3);
    }
    colors.push(c.r, c.g, c.b);
  }
  const material = materialPuntos(galaxia ? 2.6 : 3.0, 0xffffff, 0.65);
  material.vertexColors = true;
  const points = nubePuntos(positions, material, nombre);
  points.geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  if (galaxia) points.rotation.x = 1.05;
  return points;
}
