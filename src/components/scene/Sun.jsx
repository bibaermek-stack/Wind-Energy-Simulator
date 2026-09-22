/**
 * The sun: a visible glowing disc and the directional light that casts the
 * scene's shadows, both driven from the computed solar position.
 *
 * In wind mode the scene keeps its original fixed sun, so the wind
 * simulation looks exactly as it did. In solar and hybrid modes this
 * component takes over the key light, which is what makes the shadows swing
 * round as the time slider moves.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { solarEngine } from '../../physics/solar/SolarEngine.js';
import { sunVector } from '../../physics/solar/sunPosition.js';

/** How far out the sun disc is drawn. Inside the fog's far plane. */
const SUN_DISTANCE = 620;

/** Where the shadow-casting light sits. Closer, for shadow-map resolution. */
const LIGHT_DISTANCE = 240;

export default function Sun({ target = [0, 0, 0], castShadow = true }) {
  const lightRef = useRef();
  const discRef = useRef();
  const glowRef = useRef();
  const targetRef = useRef();

  /**
   * Sun colour by altitude.
   *
   * Low sun travels through much more atmosphere, losing its blue -- the
   * same Rayleigh scattering that makes the beam weaker also makes it
   * redder. Tying the two together means the light *looks* like what the
   * irradiance model says it is.
   */
  const colour = useMemo(() => new THREE.Color(), []);
  const position = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const sun = solarEngine.sun;
    const v = sunVector(sun);

    position.set(v[0], v[1], v[2]);
    const below = sun.altitude <= 0;

    // Horizon warmth: white overhead through amber at the horizon.
    const t = Math.min(Math.max(sun.altitude / 25, 0), 1);
    colour.setHSL(
      THREE.MathUtils.lerp(0.075, 0.13, t),   // orange -> near-white
      THREE.MathUtils.lerp(0.85, 0.25, t),
      THREE.MathUtils.lerp(0.55, 0.96, t),
    );

    if (lightRef.current) {
      lightRef.current.position.copy(position).multiplyScalar(LIGHT_DISTANCE).add(
        new THREE.Vector3(...target),
      );
      lightRef.current.color.copy(colour);
      // Intensity follows the beam: full sun overhead, nothing below the
      // horizon, with a short twilight rather than a hard switch.
      lightRef.current.intensity = below ? 0 : 0.35 + 2.3 * Math.min(sun.altitude / 35, 1);
      lightRef.current.visible = !below;
    }

    if (targetRef.current) targetRef.current.position.set(...target);

    if (discRef.current) {
      discRef.current.position.copy(position).multiplyScalar(SUN_DISTANCE);
      discRef.current.visible = sun.altitude > -6;
      discRef.current.material.color.copy(colour);
      discRef.current.material.opacity = below ? 0.25 : 1;
    }

    if (glowRef.current) {
      glowRef.current.position.copy(discRef.current.position);
      glowRef.current.visible = discRef.current.visible;
      glowRef.current.material.color.copy(colour);
      glowRef.current.material.opacity = below ? 0.05 : 0.22;
      // The glow swells near the horizon, the way a low sun does.
      const swell = 1 + 0.8 * (1 - Math.min(Math.max(sun.altitude / 30, 0), 1));
      glowRef.current.scale.setScalar(swell);
    }
  });

  return (
    <group>
      <directionalLight
        ref={lightRef}
        castShadow={castShadow}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.4}
        shadow-camera-near={10}
        shadow-camera-far={620}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
      >
        <object3D ref={targetRef} attach="target" />
      </directionalLight>

      {/* The disc itself. toneMapped off so it stays the brightest thing
          on screen instead of being rolled off by the tone curve. */}
      <mesh ref={discRef} renderOrder={1}>
        <sphereGeometry args={[14, 24, 24]} />
        <meshBasicMaterial transparent toneMapped={false} fog={false} depthWrite={false} />
      </mesh>

      <mesh ref={glowRef} renderOrder={0}>
        <sphereGeometry args={[36, 20, 20]} />
        <meshBasicMaterial
          transparent
          toneMapped={false}
          fog={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
