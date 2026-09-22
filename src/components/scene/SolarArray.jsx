/**
 * One solar panel in the 3D scene.
 *
 * Generic over all three: everything panel-specific comes from
 * `spec.scene`, and the orientation is read from the engine per frame by
 * panel id, so this component does not know or care whether the angles it
 * is applying came from a tracker, a slider or a bolt.
 *
 * ---------------------------------------------------------------------------
 * HOW THE ORIENTATION IS APPLIED
 * ---------------------------------------------------------------------------
 * The supplied catalogue had no hierarchy at all -- 81 unnamed meshes
 * batched by material, with one mesh's triangles spread across several
 * different products. scripts/segment-solar.mjs rebuilds each assembly
 * from the triangles up into the structure this component drives:
 *
 *   SolarPanelRoot                 <- azimuth, rotated about Y
 *     SolarPanelBase               <- posts and footings: never rotated
 *     SolarPanelTrackingAssembly   <- tilt, origin ON the tilt axis
 *       SolarPanelSurface          <- module faces
 *       SolarPanelFrame            <- rails and clamps in the module slab
 *
 * The tracking assembly's origin sits on the tilt axis, so rotating it
 * swings the modules about their torque tube while the posts stay planted.
 *
 * Tilt is POSITIVE about X: three's rotX sends the resting normal (0,1,0)
 * to (0, cos, sin), so a positive angle leans the array towards +Z, which
 * is south under this scene's compass convention. Negating it points the
 * modules 180 degrees away from the sun -- the dashboard still reads
 * cos(theta) = 1 from the physics while the array renders black.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import { clone as cloneGltfScene } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';

import { solarEngine } from '../../physics/solar/SolarEngine.js';
import { SOLAR_PANELS } from '../../physics/solar/solarSpecs.js';
import { useSimulation } from '../../state/simulationStore.js';
import { T } from '../../i18n/strings.js';
import { number, powerString } from '../../utils/format.js';

const DRACO_PATH = '/draco/';

export default function SolarArray({ spec, showLabel = true }) {
  const { scene: gltfScene } = useGLTF(spec.scene.modelUrl, DRACO_PATH);

  const rootRef = useRef(null);
  const trackerRef = useRef(null);

  const { model, nodes } = useMemo(() => {
    const root = cloneGltfScene(gltfScene);
    root.updateMatrixWorld(true);

    const found = {
      root: root.getObjectByName('SolarPanelRoot') ?? root,
      tracker: root.getObjectByName('SolarPanelTrackingAssembly'),
    };

    if (!found.tracker) {
      console.warn(
        `[SolarArray:${spec.id}] SolarPanelTrackingAssembly not found in `
        + `${spec.scene.modelUrl}. The panel will render but will not move. `
        + 'Run: npm run models:solar',
      );
    }

    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material) return;
        // Modules are solids and the rack is thin sheet: both read wrong
        // single-sided at grazing angles.
        material.side = THREE.DoubleSide;
        material.envMapIntensity = 0.8;
      });
    });

    return { model: root, nodes: found };
  }, [gltfScene, spec]);

  useEffect(() => {
    rootRef.current = nodes.root;
    trackerRef.current = nodes.tracker;
  }, [nodes]);

  useFrame(() => {
    const orientation = solarEngine.orientationOf(spec.id);
    if (!orientation) return;

    if (rootRef.current) {
      rootRef.current.rotation.y = THREE.MathUtils.degToRad(180 - orientation.azimuth);
    }
    if (trackerRef.current) {
      trackerRef.current.rotation.x = THREE.MathUtils.degToRad(orientation.tilt);
    }
  });

  return (
    <group position={spec.scene.position} rotation={[0, spec.scene.rotationY, 0]}>
      <primitive object={model} />

      {showLabel && (
        <Html
          position={[0, spec.scene.labelHeight, 0]}
          center
          zIndexRange={[8, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <PanelTag spec={spec} />
        </Html>
      )}
    </group>
  );
}

/**
 * The in-scene tag.
 *
 * Carries the live power and the alignment angle, because those two
 * numbers side by side are the whole comparison: you can read off that the
 * panel at 2 degrees is beating the one at 43 without looking away from
 * the 3D scene.
 */
function PanelTag({ spec }) {
  const panel = useSimulation((s) => s.solar.panels[spec.id]);
  const autoTracking = useSimulation((s) => s.solar.autoTracking);
  if (!panel) return null;

  const stalled = spec.mode === 'auto' && !autoTracking;

  return (
    <span className="turbine-tag is-selected" style={{ '--tag-accent': spec.accent }}>
      <span className="turbine-tag__type">
        {spec.typeCode}
        {stalled && ` · ${T.trackingOff}`}
      </span>
      <span className="turbine-tag__name">{powerString(panel.powerAc)}</span>
      <span className="turbine-tag__meta">
        {`θ = ${number(panel.incidenceDeg, 1)}°  ·  ${number(panel.specificYield, 0)} W/m²`}
      </span>
    </span>
  );
}

SOLAR_PANELS.forEach((panel) => useGLTF.preload(panel.scene.modelUrl, DRACO_PATH));
