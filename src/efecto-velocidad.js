import * as THREE from "three";

// Efecto local a la cámara: acompaña al vuelo y no cambia de destino ni de sistema.
export function crearEfectoVelocidad() {
  const group = new THREE.Group();
  group.name = "EfectoVelocidad";
  group.visible = false;
  const depth = 420;
  const uniforms = { intensity: { value: 0 } };
  let envelope = 0;
  let lastRatio = 0;
  let lastSpeed = 0;
  const fadeOutSeconds = 1.4;
  const tunnel = new THREE.Mesh(
    new THREE.CylinderGeometry(58, 58, depth, 64, 1, true),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float intensity;
        varying vec2 vUv;
        void main() {
          float ends = sin(vUv.y * 3.14159265);
          gl_FragColor = vec4(vec3(0.3, 0.33, 0.36), intensity * ends * 0.035);
        }`,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false
    })
  );
  tunnel.name = "TunelVelocidad";
  tunnel.rotation.x = Math.PI / 2;
  tunnel.position.z = -depth / 2 - 4;
  tunnel.renderOrder = 10;
  group.add(tunnel);

  const count = 3000;
  const positions = new Float32Array(count * 6);
  const colors = new Float32Array(count * 6);
  const stars = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.sqrt(Math.random()) * 68;
    stars.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: -4 - Math.random() * depth });
    const color = new THREE.Color().setHSL(0.56, 0.04, 0.75 + Math.random() * 0.25);
    color.toArray(colors, i * 6);
    color.clone().multiplyScalar(0.25).toArray(colors, i * 6 + 3);
  }
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false
  });
  const streaks = new THREE.LineSegments(geometry, material);
  streaks.name = "EstelasVelocidad";
  streaks.frustumCulled = false;
  streaks.renderOrder = 11;
  group.add(streaks);

  group.userData.update = (delta, active, speed, enabled = true) => {
    if (!enabled) envelope = 0;
    else if (active) {
      envelope = Math.min(1, envelope + delta / 0.2);
      lastRatio = THREE.MathUtils.clamp(speed / 650, 0, 1);
      lastSpeed = speed;
    } else envelope = Math.max(0, envelope - delta / fadeOutSeconds);
    group.visible = envelope > 0;
    if (!group.visible) {
      uniforms.intensity.value = 0;
      material.opacity = 0;
      return;
    }
    // Conservar el impulso visual al soltar Shift evita un salto al bajar la velocidad real.
    const fade = THREE.MathUtils.smoothstep(envelope, 0, 1);
    uniforms.intensity.value = (0.35 + lastRatio * 0.65) * fade;
    material.opacity = (0.45 + lastRatio * 0.45) * fade;
    const length = (18 + lastRatio * 105) * fade;
    stars.forEach((star, i) => {
      star.z += delta * (90 + lastSpeed * 1.5) * fade;
      if (star.z > -4) star.z = -4 - ((-4 - star.z) % depth + depth) % depth;
      const offset = i * 6;
      positions[offset] = positions[offset + 3] = star.x;
      positions[offset + 1] = positions[offset + 4] = star.y;
      positions[offset + 2] = star.z;
      positions[offset + 5] = star.z - length;
    });
    attribute.needsUpdate = true;
  };
  return group;
}
