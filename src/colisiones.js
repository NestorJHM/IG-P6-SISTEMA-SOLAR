import * as THREE from "three";

export const RADIO_EXPLORADOR = 0.18;
const SEPARACION_COLISION = 0.00001;

// Usar las superficies visibles, no los radios ampliados de selección de la mira.
export function obtenerCuerposColision(targets, previousCenters = new Map()) {
  const bodies = [];
  const seen = new Set();
  for (const target of targets) {
    const mesh = target.mesh;
    if (!mesh || seen.has(mesh) || !mesh.isMesh || !mesh.geometry
        || mesh.geometry.type !== "SphereGeometry" || mesh.material.visible === false) continue;
    let visible = true;
    for (let node = mesh; node; node = node.parent) {
      if (!node.visible || Math.abs(node.scale.x) < 0.01) { visible = false; break; }
    }
    if (!visible) continue;
    seen.add(mesh);
    const center = mesh.getWorldPosition(new THREE.Vector3());
    const scale = mesh.getWorldScale(new THREE.Vector3());
    const radius = mesh.geometry.parameters.radius * Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
    bodies.push({ mesh, name: target.name, center, radius,
      previousCenter: (previousCenters.get(mesh) || center).clone() });
  }
  return bodies;
}

// Barrido continuo de esfera contra esferas móviles: no se salta superficies
// aunque el movimiento de un frame cruce completamente un planeta o una luna.
export function resolverColisiones(inicio, destino, bodies, playerRadius = RADIO_EXPLORADOR) {
  const position = inicio.clone();
  let remaining = destino.clone().sub(inicio);
  let elapsed = 0;
  const contacts = [];
  const register = (body, normal) => {
    if (!contacts.some(contact => contact.mesh === body.mesh)) {
      contacts.push({ mesh: body.mesh, name: body.name, normal: normal.clone() });
    }
  };
  const normalAt = (center) => {
    const normal = position.clone().sub(center);
    // También se puede recuperar una cámara situada exactamente en el centro.
    if (normal.lengthSq() < 1e-16) normal.copy(remaining).negate();
    if (normal.lengthSq() < 1e-16) normal.set(0, 0, 1);
    return normal.normalize();
  };
  const separate = (atEnd) => {
    for (let pass = 0; pass < 6; pass++) {
      let corrected = false;
      for (const body of bodies) {
        const center = atEnd ? body.center : body.previousCenter;
        const radius = body.radius + playerRadius;
        if (position.distanceToSquared(center) >= radius * radius) continue;
        const normal = normalAt(center);
        position.copy(center).addScaledVector(normal, radius + SEPARACION_COLISION);
        register(body, normal);
        corrected = true;
      }
      if (!corrected) break;
    }
  };
  separate(false);
  for (let iteration = 0; iteration < 8; iteration++) {
    let hit = null;
    for (const body of bodies) {
      const center = body.previousCenter.clone().lerp(body.center, elapsed);
      const centerMotion = body.center.clone().sub(center);
      const relative = position.clone().sub(center);
      const motion = remaining.clone().sub(centerMotion);
      const radius = body.radius + playerRadius;
      const a = motion.lengthSq();
      const b = relative.dot(motion);
      const c = relative.lengthSq() - radius * radius;
      if (a < 1e-16 || b >= 0) continue;
      const discriminant = b * b - a * c;
      if (discriminant < 0) continue;
      const t = (-b - Math.sqrt(discriminant)) / a;
      if (t < 0 || t > 1 || (hit && t >= hit.t)) continue;
      hit = { body, t };
    }
    if (!hit) { position.add(remaining); break; }
    position.addScaledVector(remaining, hit.t);
    elapsed += (1 - elapsed) * hit.t;
    const center = hit.body.previousCenter.clone().lerp(hit.body.center, elapsed);
    const normal = normalAt(center);
    position.addScaledVector(normal, SEPARACION_COLISION);
    register(hit.body, normal);
    // Conservar la componente tangencial permite deslizarse sobre la superficie.
    const centerMotion = hit.body.center.clone().sub(center);
    remaining.multiplyScalar(1 - hit.t).sub(centerMotion);
    const inward = remaining.dot(normal);
    if (inward < 0) remaining.addScaledVector(normal, -inward);
    remaining.add(centerMotion);
  }
  separate(true);
  return { position, contacts };
}
