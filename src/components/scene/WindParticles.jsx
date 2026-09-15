/**
 * Wind visualisation: streaks of air moving through the installation.
 *
 * One InstancedMesh of elongated quads, advected along -Z (the scene's wind
 * direction) and recycled at the downwind edge. The streaks carry two cues
 * that make the wind speed legible without reading the dashboard:
 *
 *   length   each streak stretches with speed, like a longer exposure
 *   opacity  faint in calm air, solid in a gale
 *
 * Both are driven off the live wind speed, and the whole field fades to
 * nothing below about 0.5 m/s so that "no wind" genuinely looks still.
 *
 * Instances are updated by writing directly into the instance matrix array
 * -- no per-particle objects, no allocation inside the frame loop.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { engine } from '../../physics/SimulationEngine.js';
import { WIND_SPEED_MAX } from '../../physics/constants.js';

const COUNT = 760;

/**
 * The streak billboard: two quads crossed at right angles along Z.
 *
 * A single quad would disappear whenever the camera looked along its
 * plane; a box has per-face UVs that run in inconsistent directions, so a
 * length-wise gradient cannot be mapped onto one. Crossed quads solve both
 * -- one face is always presented to the camera, and both carry the same
 * UV layout with v running along the streak's length, which is what the
 * fade-out ramp needs.
 */
function makeStreakGeometry() {
  const geometry = new THREE.BufferGeometry();

  // prettier-ignore
  const positions = new Float32Array([
    // horizontal quad, in the XZ plane
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5,
    // vertical quad, in the YZ plane
    0, -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5,
  ]);

  // v runs 0 -> 1 along +Z on both quads, so the alpha ramp fades the
  // streak in at its tail and out at its head.
  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
  ]);

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return geometry;
}

/** The volume the streaks occupy, centred on the installation strip. */
const FIELD = {
  minX: -190, maxX: 110,
  minY: 4, maxY: 96,
  minZ: -150, maxZ: 150,
};

export default function WindParticles({ visible = true }) {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  /** Per-instance state, laid out as flat typed arrays. */
  const particles = useMemo(() => {
    const x = new Float32Array(COUNT);
    const y = new Float32Array(COUNT);
    const z = new Float32Array(COUNT);
    const speedJitter = new Float32Array(COUNT);
    const sizeJitter = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      x[i] = FIELD.minX + Math.random() * (FIELD.maxX - FIELD.minX);
      // Bias the distribution towards rotor height: that is where the
      // interesting flow is, and it keeps streaks off the camera lens.
      y[i] = FIELD.minY + (FIELD.maxY - FIELD.minY) * Math.random() ** 0.72;
      z[i] = FIELD.minZ + Math.random() * (FIELD.maxZ - FIELD.minZ);
      speedJitter[i] = 0.75 + Math.random() * 0.55;
      sizeJitter[i] = 0.6 + Math.random() * 0.9;
    }
    return { x, y, z, speedJitter, sizeJitter };
  }, []);

  /**
   * A 1 x 64 gradient that fades each streak out towards both ends.
   *
   * Without it every streak terminates in a hard rectangular edge, and a
   * field of hard-edged bright rectangles reads as scratches on the lens
   * rather than as moving air. The ramp turns each one into a soft wisp
   * that is brightest at its middle -- the shape a motion-blurred particle
   * actually has. Generated rather than loaded, so there is no asset to
   * ship and no request to wait on.
   */
  const rampTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.65, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }, []);

  const geometry = useMemo(makeStreakGeometry, []);

  const material = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: '#ffffff',
      map: rampTexture,
      alphaMap: rampTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    [rampTexture],
  );

  useEffect(() => () => {
    rampTexture.dispose();
    material.dispose();
    geometry.dispose();
  }, [rampTexture, material, geometry]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !visible) return;

    const wind = engine.windSpeed;
    const dt = Math.min(delta, 0.1);

    // Fade in from a dead calm, and cap well short of saturation. These
    // streaks are additive over a green field, so anything stronger stops
    // reading as moving air and starts reading as falling rain.
    const intensity = Math.min(wind / 16, 1);
    material.opacity = intensity * 0.13;
    if (material.opacity < 0.004) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    // Streak geometry. The distinction between "wind" and "rain" is almost
    // entirely length-to-brightness: a short, bright, hard-edged streak
    // reads as a falling droplet, while a long, very faint one reads as a
    // motion-blurred trail of air. So the streaks are drawn long and thin
    // and kept near the threshold of visibility.
    const baseLength = 7 + (wind / WIND_SPEED_MAX) * 26;
    const thickness = 0.5;

    const { x, y, z, speedJitter, sizeJitter } = particles;
    const depth = FIELD.maxZ - FIELD.minZ;

    for (let i = 0; i < COUNT; i++) {
      // Wind blows towards -Z. Displayed motion is deliberately slowed
      // relative to the physical wind speed: at true scale the streaks
      // would cross the frame faster than the eye can track.
      z[i] -= wind * speedJitter[i] * dt * 0.55;

      if (z[i] < FIELD.minZ) {
        // Recycle at the upwind edge with a fresh lateral position, so the
        // field never settles into visible lanes.
        z[i] += depth;
        x[i] = FIELD.minX + Math.random() * (FIELD.maxX - FIELD.minX);
        y[i] = FIELD.minY + (FIELD.maxY - FIELD.minY) * Math.random() ** 0.72;
      }

      dummy.position.set(x[i], y[i], z[i]);
      const w = thickness * sizeJitter[i];
      dummy.scale.set(w, w, baseLength * sizeJitter[i]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!visible) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, COUNT]}
      frustumCulled={false}
      renderOrder={2}
    />
  );
}
