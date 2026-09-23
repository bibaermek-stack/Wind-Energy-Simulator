/**
 * Camera control and the flight between turbines.
 *
 * OrbitControls handles free look. On top of it sits a scripted transition:
 * when the selection changes, the camera and the orbit target ease from
 * wherever they are to a framing of the new machine.
 *
 * The flight is driven by an eased parameter rather than a per-frame lerp
 * towards a moving goal. A naive lerp never quite arrives, decelerates
 * forever, and cannot be interrupted cleanly -- this version has a definite
 * duration, a symmetric ease, and hands control straight back to the user
 * the moment they touch the mouse.
 */

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import { TURBINE_BY_ID, TURBINES } from '../../physics/turbineSpecs.js';
import { SOLAR_VIEW } from '../../physics/solar/solarSpecs.js';
import { useSimulation } from '../../state/simulationStore.js';

const FLIGHT_DURATION = 1.5; // seconds

/** Cubic ease-in-out: gentle departure, gentle arrival. */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Where the camera should sit, and what it should look at, for one turbine.
 *
 * The look-at point is half the machine's overall height -- its visual
 * centre -- rather than the hub, which on a horizontal-axis turbine sits
 * well below the top of the upright blade and would frame the tower
 * generously while cropping the rotor.
 */
function framingFor(spec) {
  const [px, , pz] = spec.scene.position;
  const [ox, oy, oz] = spec.scene.cameraOffset;
  return {
    position: new THREE.Vector3(px + ox, oy, pz + oz),
    target: new THREE.Vector3(px, spec.scene.labelHeight * 0.5, pz),
  };
}

/** A wide shot that holds all three machines, used by comparison mode. */
function overviewFraming() {
  const box = new THREE.Box3();
  TURBINES.forEach((spec) => {
    const [x, , z] = spec.scene.position;
    box.expandByPoint(new THREE.Vector3(x, 0, z));
    box.expandByPoint(new THREE.Vector3(x, spec.scene.labelHeight, z));
  });
  const centre = box.getCenter(new THREE.Vector3());
  return {
    position: new THREE.Vector3(centre.x + 30, 112, centre.z + 305),
    target: new THREE.Vector3(centre.x, 40, centre.z),
  };
}

/** Framing that holds all three panels, at a person's-eye angle. */
function solarFraming() {
  const [tx, ty, tz] = SOLAR_VIEW.target;
  const [ox, oy, oz] = SOLAR_VIEW.cameraOffset;
  return {
    position: new THREE.Vector3(tx + ox, oy, tz + oz),
    target: new THREE.Vector3(tx, ty, tz),
  };
}

/**
 * Framing for hybrid mode: far enough back to hold a 92 m turbine and a
 * 11.5 m solar array in one frame. They are at true relative scale, so this
 * is necessarily a wide shot -- which is itself the point being made.
 */
function hybridFraming() {
  const [sx, , sz] = SOLAR_VIEW.target;
  return {
    position: new THREE.Vector3(sx + 74, 62, sz + 150),
    target: new THREE.Vector3((sx - 30) / 2, 26, (sz + 6) / 2),
  };
}

export default function CameraRig() {
  const controlsRef = useRef();
  const { camera } = useThree();

  const selectedId = useSimulation((s) => s.selectedId);
  const comparisonMode = useSimulation((s) => s.comparisonMode);
  const mode = useSimulation((s) => s.mode);

  /** Active flight, or null when the user is in control. */
  const flight = useRef(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    let goal;
    if (mode === 'solar') goal = solarFraming();
    else if (mode === 'hybrid') goal = hybridFraming();
    else if (comparisonMode) goal = overviewFraming();
    else goal = framingFor(TURBINE_BY_ID[selectedId]);

    flight.current = {
      elapsed: 0,
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPosition: goal.position,
      toTarget: goal.target,
    };
  }, [selectedId, comparisonMode, mode, camera]);

  // Any manual interaction cancels the flight immediately, rather than
  // fighting the user for the rest of the transition.
  const handleUserInput = () => { flight.current = null; };

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    const active = flight.current;
    if (!controls || !active) return;

    active.elapsed += delta;
    const t = Math.min(active.elapsed / FLIGHT_DURATION, 1);
    const eased = easeInOutCubic(t);

    camera.position.lerpVectors(active.fromPosition, active.toPosition, eased);
    controls.target.lerpVectors(active.fromTarget, active.toTarget, eased);
    controls.update();

    if (t >= 1) flight.current = null;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      rotateSpeed={0.55}
      zoomSpeed={0.8}
      panSpeed={0.7}
      minDistance={2.5}
      maxDistance={680}
      // Stop the camera dropping below the horizon and revealing the
      // underside of the terrain.
      maxPolarAngle={Math.PI * 0.495}
      target={[-95, 50, -18]}
      onStart={handleUserInput}
    />
  );
}
