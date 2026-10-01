/**
 * Turns the STEM box GLB and the assembly table into posed three.js parts.
 *
 * Pure three.js, no React: the scene component drives it, and so can a
 * test page. Every part becomes a `pivot` Object3D holding the printed
 * mesh at identity, so the pivot's transform IS the part's pose and the
 * animation only ever has to interpolate pivots.
 */
import * as THREE from 'three';
import { basisOf } from './boxAssembly.js';

export const MM = 0.001;

const _m = new THREE.Matrix4();
const _yaw = new THREE.Quaternion();
const _y = new THREE.Vector3(0, 1, 0);

/** Final pose of one table entry, in metres. */
export function poseOf(part) {
  const [a, b, c] = basisOf(part.basis).map((v) => new THREE.Vector3(...v));
  _m.makeBasis(a, b, c);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(_m);
  if (part.pre) quaternion.multiply(_yaw.setFromAxisAngle(_y, THREE.MathUtils.degToRad(part.pre)));
  return {
    position: new THREE.Vector3(...part.pos).multiplyScalar(MM),
    quaternion,
  };
}

/**
 * @param {THREE.Object3D} source  the loaded GLB scene (left untouched)
 * @param {Array} table            SOLAR_PARTS or WIND_PARTS
 * @returns {{ group: THREE.Group, items: Array }}
 */
export function buildBox(source, table) {
  const group = new THREE.Group();
  const items = [];
  for (const part of table) {
    const node = source.getObjectByName(part.id);
    if (!node) {
      console.warn(`[stem] part ${part.id} missing from stem-boxes.glb`);
      continue;
    }
    const mesh = node.clone(true);
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    const pivot = new THREE.Object3D();
    pivot.name = `pivot:${part.id}`;
    pivot.add(mesh);
    const pose = poseOf(part);
    pivot.position.copy(pose.position);
    pivot.quaternion.copy(pose.quaternion);
    group.add(pivot);
    items.push({
      ...part,
      pivot,
      final: pose,
      offset: new THREE.Vector3(...part.from).multiplyScalar(MM),
    });
  }
  return { group, items };
}
