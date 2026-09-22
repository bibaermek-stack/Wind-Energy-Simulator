/**
 * Sunlight travelling from the sun to the array.
 *
 * The teaching job here is specific: make the *relationship* between the
 * beam and the panel visible. So the rays are a parallel bundle -- which is
 * what sunlight physically is at this distance -- aimed along the sun
 * vector at the array, and their brightness follows cos(theta). Turn the
 * panel away from the sun and the rays visibly dim and start to graze it
 * rather than striking it square.
 *
 * Instanced, with per-frame matrix writes and no allocation in the loop,
 * the same way WindParticles works.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { solarEngine } from '../../physics/solar/SolarEngine.js';
import { sunVector } from '../../physics/solar/sunPosition.js';
import { SOLAR_ARRAY } from '../../physics/solar/solarSpecs.js';

/**
 * Ray count.
 *
 * Deliberately small. A dense bundle renders as a glow that tells you
 * nothing about geometry; a handful of distinct, separated rays lets you
 * actually see the angle the beam makes with the panel, which is the only
 * reason this component exists.
 */
const COUNT = 26;

/** Length of the beam segment drawn, in metres. */
const RAY_LENGTH = 14;

/** Radius of the bundle around the array, in metres. */
const BUNDLE_RADIUS = 2.6;

export default function SunRays({ visible = true, spec = SOLAR_ARRAY }) {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  /** Fixed offsets within the bundle, so the rays do not shimmer. */
  const offsets = useMemo(() => Array.from({ length: COUNT }, (_, i) => {
    // Sunflower spiral: even coverage of the disc without clumping.
    const golden = Math.PI * (3 - Math.sqrt(5));
    const r = BUNDLE_RADIUS * Math.sqrt((i + 0.5) / COUNT);
    const a = i * golden;
    return {
      u: Math.cos(a) * r,
      v: Math.sin(a) * r,
      phase: (i % 17) / 17,
      length: 0.75 + ((i % 7) / 7) * 0.5,
    };
  }), []);

  const rampTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(255,240,200,0)');
    g.addColorStop(0.45, 'rgba(255,240,200,1)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1, 64);
    return new THREE.CanvasTexture(canvas);
  }, []);

  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#fff0c8',
    map: rampTexture,
    alphaMap: rampTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), [rampTexture]);

  const geometry = useMemo(() => {
    // Two crossed quads along Y, so a ray is visible from any angle.
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array([
      -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
      0, -0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, -0.5,
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]);
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    return g;
  }, []);

  useEffect(() => () => {
    rampTexture.dispose();
    material.dispose();
    geometry.dispose();
  }, [rampTexture, material, geometry]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || !visible) return;

    const sun = solarEngine.sun;
    const panel = solarEngine.activePanel;

    if (sun.altitude <= 0 || !panel) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    const v = sunVector(sun);
    direction.set(v[0], v[1], v[2]);

    // Brightness carries the physics: strong beam and square incidence make
    // bright rays; a grazing angle or a cloudy sky makes faint ones.
    const cosTheta = panel.cosTheta ?? 0;
    const beamStrength = Math.min((panel.beamIrradiance ?? 0) / 900, 1);
    material.opacity = 0.03 + 0.10 * beamStrength * (0.25 + 0.75 * cosTheta);

    // Orient one ray: its local +Y must lie along the sun direction.
    quaternion.setFromUnitVectors(up, direction);

    // Build a basis across the beam so the bundle is a disc facing the sun.
    const sideA = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const sideB = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);

    target.set(...spec.scene.position);
    target.y += spec.scene.labelHeight * 0.42;

    const travel = (state.clock.elapsedTime * 0.35) % 1;

    for (let i = 0; i < COUNT; i++) {
      const o = offsets[i];
      // Slide each ray along the beam so the bundle appears to flow inwards.
      //
      // The span is kept close to the array on purpose. Drawn further out
      // the bundle reaches past the camera -- which sits roughly on the
      // sun's side at midday -- and the rays vanish behind the viewer just
      // when the sun is strongest and they matter most.
      const along = 2.5 + RAY_LENGTH * 0.42 * ((o.phase + travel) % 1);

      dummy.position.copy(target)
        .addScaledVector(sideA, o.u)
        .addScaledVector(sideB, o.v)
        .addScaledVector(direction, along);
      dummy.quaternion.copy(quaternion);
      dummy.scale.set(0.035, RAY_LENGTH * 0.34 * o.length, 0.035);
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
      renderOrder={3}
    />
  );
}
