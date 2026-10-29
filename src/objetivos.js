import * as THREE from "three";

export const DISTANCIA_DETALLE_CONSTELACION = 900;

// Selección del panel de información sobre el eje óptico.
export function detectarObjetivo(camera, targets, sight) {
  let detected = null;
  const world = new THREE.Vector3();
  for (const item of targets) {
    if (!item.mesh) continue;
    let visible = true;
    for (let node = item.mesh; node; node = node.parent) {
      if (!node.visible || node.scale.x < 0.01) { visible = false; break; }
    }
    if (!visible) continue;
    if (item.constellation && !item.type.startsWith("CONSTELACIÓN")) {
      item.constellation.getWorldPosition(world);
      if (world.distanceTo(camera.position) >= DISTANCIA_DETALLE_CONSTELACION) continue;
    }
    item.mesh.getWorldPosition(world);
    const projected = world.clone().project(camera);
    if (projected.z <= 0 || projected.z >= 1) continue;
    const screenDist = Math.hypot(projected.x - sight.x, projected.y - sight.y);
    const worldDistance = world.distanceTo(camera.position);
    const radius = item.radius || (item.mesh.geometry && item.mesh.geometry.parameters.radius) || 4;
    if (screenDist < Math.max(0.09, radius / Math.max(1, worldDistance) * 1.8)
        && (!detected || screenDist < detected.screenDist)) {
      detected = { target: item, screenDist, worldDistance };
    }
  }
  return detected;
}

