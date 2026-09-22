/**
 * The solar array in the 3D scene.
 *
 * ---------------------------------------------------------------------------
 * HOW THE TRACKING IS APPLIED
 * ---------------------------------------------------------------------------
 * The supplied catalogue model had no hierarchy at all -- 81 unnamed meshes
 * batched by material, with one mesh's triangles spread across several
 * different products. scripts/segment-solar.mjs rebuilds one assembly from
 * the triangles up into the structure this component drives:
 *
 *   SolarPanelRoot                 <- azimuth, rotated about Y
 *     SolarPanelBase               <- posts and footings: never rotated
 *     SolarPanelTrackingAssembly   <- tilt, rotated about its local X
 *       SolarPanelSurface          <- module faces
 *       SolarPanelFrame            <- rails and clamps in the module slab
 *
 * The tracking assembly's origin sits ON the tilt axis, so rotating it
 * swings the modules about their torque tube. That is the whole trick: an
 * earlier arrangement with the pivot at the panel's lower edge lifted the
 * array off its posts and left it visibly floating at steep tilts.
 *
 * Orientation comes from the engine, which slews at a finite rate, so the
 * array never teleports -- it is read here per frame and applied directly,
 * exactly as the turbine rotors are.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import { clone as cloneGltfScene } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';

import { solarEngine } from '../../physics/solar/SolarEngine.js';
import { SOLAR_ARRAY } from '../../physics/solar/solarSpecs.js';
import { useSimulation } from '../../state/simulationStore.js';
import { T } from '../../i18n/strings.js';
import { number } from '../../utils/format.js';

const DRACO_PATH = '/draco/';

export default function SolarArray({ spec = SOLAR_ARRAY, showLabel = true }) {
  const { scene: gltfScene } = useGLTF(spec.scene.modelUrl, DRACO_PATH);

  const rootRef = useRef(null);
  const trackerRef = useRef(null);
  const surfaceRef = useRef(null);

  const { model, nodes } = useMemo(() => {
    const root = cloneGltfScene(gltfScene);
    root.updateMatrixWorld(true);

    const found = {
      root: root.getObjectByName(spec.scene.rootNode) ?? root,
      tracker: root.getObjectByName(spec.scene.trackerNode),
      surface: root.getObjectByName(spec.scene.surfaceNode),
      base: root.getObjectByName(spec.scene.baseNode),
    };

    if (!found.tracker) {
      console.warn(
        `[SolarArray] "${spec.scene.trackerNode}" not found in ${spec.scene.modelUrl}. `
        + 'The array will render but will not track. Run: npm run models:solar',
      );
    }

    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material) return;
        // The modules are a solid with a back face, and the rack is thin
        // sheet: both read wrong single-sided at grazing angles.
        material.side = THREE.DoubleSide;
        material.envMapIntensity = 0.8;
      });
    });

    return { model: root, nodes: found };
  }, [gltfScene, spec]);

  useEffect(() => {
    rootRef.current = nodes.root;
    trackerRef.current = nodes.tracker;
    surfaceRef.current = nodes.surface;
  }, [nodes]);

  useFrame(() => {
    const panel = solarEngine.activePanel;
    if (!panel) return;

    // Azimuth: the model faces +Z at rotation zero, and scene azimuth is
    // measured clockwise from north (-Z). A panel facing due south (180)
    // must therefore sit at rotation 0.
    if (rootRef.current) {
      rootRef.current.rotation.y = THREE.MathUtils.degToRad(180 - panel.azimuth);
    }

    // Tilt is POSITIVE about X.
    //
    // three's rotX sends the resting normal (0,1,0) to (0, cos, sin), so a
    // positive angle leans the array towards +Z -- south, which is what the
    // azimuth convention above assumes. Negating it leans the array north
    // instead, putting the modules' faces exactly 180 degrees from the sun:
    // the dashboard still reads cos(theta) = 1 from the physics while the
    // array on screen is lit from behind and renders black.
    if (trackerRef.current) {
      trackerRef.current.rotation.x = THREE.MathUtils.degToRad(panel.tilt);
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
          <SolarTag spec={spec} />
        </Html>
      )}
    </group>
  );
}

/** The in-scene tag, mirroring the turbine tags. */
function SolarTag({ spec }) {
  const panel = useSimulation((s) => (s.solar.trackingEnabled ? s.solar.tracking : s.solar.fixed));
  const tracking = useSimulation((s) => s.solar.trackingEnabled);

  return (
    <span className="turbine-tag is-selected" style={{ '--tag-accent': spec.accent }}>
      <span className="turbine-tag__type">{spec.typeCode}</span>
      <span className="turbine-tag__name">{spec.name.kk}</span>
      <span className="turbine-tag__meta">
        {`${number(spec.apertureArea, 2)} m² · ${tracking ? T.trackingOn : T.trackingOff}`}
      </span>
      {panel && (
        <span className="turbine-tag__meta">
          {`cos θ = ${number(panel.cosTheta ?? 0, 3)}`}
        </span>
      )}
    </span>
  );
}

useGLTF.preload(SOLAR_ARRAY.scene.modelUrl, DRACO_PATH);
