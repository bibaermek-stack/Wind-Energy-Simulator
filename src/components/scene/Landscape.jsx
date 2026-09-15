/**
 * The outdoor environment: grass terrain, distant mountains, and the
 * installation pads the turbines stand on.
 *
 * Everything here is generated from a seeded pseudo-random sequence rather
 * than a noise library, so the landscape is byte-identical on every reload
 * -- which matters when the same scene is shown repeatedly in a lecture.
 */

import { useMemo } from 'react';
import * as THREE from 'three';

import { TURBINES } from '../../physics/turbineSpecs.js';

const TERRAIN_SIZE = 1400;
const TERRAIN_SEGMENTS = 160;

/** Mulberry32 -- small, fast, and deterministic from a single integer. */
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * Rolling grassland.
 *
 * Height is a sum of a few sine harmonics -- enough to read as gentle
 * terrain without the cost or the non-determinism of real noise. The
 * displacement is faded out across the installation strip so the turbines
 * stand on level ground and their towers meet the grass cleanly.
 */
function useTerrainGeometry() {
  return useMemo(() => {
    const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    geometry.rotateX(-Math.PI / 2);

    const position = geometry.attributes.position;
    const colour = new Float32Array(position.count * 3);

    const grassLow = new THREE.Color('#5c8c3a');
    const grassHigh = new THREE.Color('#87ad5b');
    const scrub = new THREE.Color('#9aa870');
    const temp = new THREE.Color();

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);

      const height =
        Math.sin(x * 0.0065) * Math.cos(z * 0.0051) * 11
        + Math.sin(x * 0.017 + 1.7) * Math.cos(z * 0.013 - 0.6) * 4.5
        + Math.sin(x * 0.041 - 2.2) * 1.4
        + Math.cos(z * 0.036 + 0.9) * 1.2;

      // Flatten the strip the turbines occupy, with a soft transition.
      const distanceFromStrip = Math.max(
        0,
        Math.max(Math.abs(z - 2) - 46, Math.abs(x + 20) - 130),
      );
      const flatten = smoothstep(0, 95, distanceFromStrip);

      // Keep the outer rim high so the horizon is terrain, not a hard edge.
      const radial = Math.sqrt(x * x + z * z);
      const rim = smoothstep(430, 690, radial) * 46;

      position.setY(i, height * flatten + rim);

      // Tint by height and by a little large-scale variation, so the grass
      // is not one flat colour across 1.4 km.
      const patch = 0.5 + 0.5 * Math.sin(x * 0.009 + 2.1) * Math.cos(z * 0.011 - 1.3);
      temp.copy(grassLow).lerp(grassHigh, patch);
      temp.lerp(scrub, smoothstep(18, 60, position.getY(i)));
      colour[i * 3] = temp.r;
      colour[i * 3 + 1] = temp.g;
      colour[i * 3 + 2] = temp.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colour, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);
}

/**
 * Two rings of mountains on the horizon. The far ring is paler and taller,
 * which -- together with the scene fog -- gives the aerial perspective that
 * makes the distance read correctly.
 */
function Mountains() {
  const ranges = useMemo(() => {
    const random = seededRandom(20260915);
    const build = (count, distance, minHeight, maxHeight, spread) =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + random() * 0.09;
        const r = distance + (random() - 0.5) * spread;
        const height = minHeight + random() * (maxHeight - minHeight);
        return {
          key: `${distance}-${i}`,
          position: [Math.cos(angle) * r, height * 0.34, Math.sin(angle) * r],
          radius: height * (0.72 + random() * 0.5),
          height,
          rotation: random() * Math.PI,
          segments: 5 + Math.floor(random() * 3),
        };
      });

    return {
      near: build(38, 880, 110, 240, 170),
      far: build(30, 1240, 200, 430, 240),
    };
  }, []);

  return (
    <group>
      {ranges.far.map((m) => (
        <mesh key={`far-${m.key}`} position={m.position} rotation={[0, m.rotation, 0]}>
          <coneGeometry args={[m.radius, m.height, m.segments]} />
          <meshStandardMaterial color="#b3c5d9" roughness={1} metalness={0} flatShading />
        </mesh>
      ))}
      {ranges.near.map((m) => (
        <mesh key={`near-${m.key}`} position={m.position} rotation={[0, m.rotation, 0]} castShadow={false}>
          <coneGeometry args={[m.radius, m.height, m.segments]} />
          <meshStandardMaterial color="#93aac4" roughness={1} metalness={0} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A gravel pad and access track under each machine, so the turbines look
 * installed rather than dropped onto a lawn.
 */
function InstallationPads() {
  return (
    <group>
      {TURBINES.map((spec) => {
        const padRadius = Math.max(spec.rotor.diameter * 0.22, 3.2);
        return (
          <group key={spec.id} position={[spec.scene.position[0], 0.03, spec.scene.position[2]]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <circleGeometry args={[padRadius, 48]} />
              <meshStandardMaterial color="#b9b2a4" roughness={0.98} metalness={0} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, padRadius * 2.4]} receiveShadow>
              <planeGeometry args={[padRadius * 0.5, padRadius * 3.6]} />
              <meshStandardMaterial color="#c0b9ab" roughness={0.98} metalness={0} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export default function Landscape() {
  const terrain = useTerrainGeometry();

  return (
    <group>
      <mesh geometry={terrain} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
      </mesh>
      <InstallationPads />
      <Mountains />
    </group>
  );
}
