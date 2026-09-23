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
 * different products. scripts/build-solar.mjs emits each panel in the
 * structure this component drives:
 *
 *   SolarPanelRoot                 <- azimuth, rotated about Y
 *     SolarPanelBase               <- posts and footings: never rotated
 *     SolarPanelTrackingAssembly   <- tilt, origin ON the tilt axis
 *       SolarPanelYoke             <- tracker only: torque tube, rafters, rails
 *       SolarPanelSurface          <- the photovoltaic cells
 *       SolarPanelGrid             <- the light lines between those cells
 *       SolarPanelFrame            <- the aluminium rim around each module
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
      {spec.scene.rack && <AdjustableRack spec={spec} trackerRef={trackerRef} />}

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
 * The adjustable-tilt rack under Panel 2.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT IN THE MODEL FILE
 * ---------------------------------------------------------------------------
 * Everything else about these panels is baked geometry. This is not, and it
 * cannot be: the whole point of an adjustable rack is that its rear legs
 * CHANGE LENGTH. Set the tilt slider to 20 degrees and the legs are short;
 * set it to 60 and they telescope out. A mesh exported at one length can
 * only be rotated, so the visible link between the slider and the hardware
 * -- which is the thing the panel exists to teach -- has to be computed
 * every frame.
 *
 * So the segmenter gives this panel a hinge instead of a mount: it drops
 * the catalogue's own legs and moves the tilt axis to the array's front
 * edge, at `rack.hingeHeight` (scripts/build-solar.mjs puts the manual
 * panel's tilt axis there, and this must agree with it). The array's
 * modules, rails and laminate are still entirely the supplied geometry.
 *
 * ---------------------------------------------------------------------------
 * THE GEOMETRY
 * ---------------------------------------------------------------------------
 * The model's origin is on the ground directly under the hinge pin, with
 * the array reaching back in -Z. Each rear leg therefore runs between two
 * points this component can work out from the tilt alone:
 *
 *   anchor  (legX, 0, -attachDistance)           bolted to the ground
 *   attach  the same point transformed by the GLB tracker node
 *
 * The attach is read from the tracker mesh every frame, not recomputed
 * from an analytic formula. The array's module plane is a few centimetres
 * off y = 0 in the GLB; an analytic hinge would miss it as soon as the
 * slider moved, and the arms would look like they had broken off.
 */
function AdjustableRack({ spec, trackerRef }) {
  const rack = spec.scene.rack;
  const yawRef = useRef(null);
  const tiltRef = useRef(null);
  // One telescopic arm per entry in rack.legXs; refs are indexed alike.
  const legRefs = useRef([]).current;
  const rodRefs = useRef([]).current;
  const capRefs = useRef([]).current;
  const _attach = useMemo(() => new THREE.Vector3(), []);
  const _foot = useMemo(() => new THREE.Vector3(), []);

  // Mill-finish aluminium, same family as the catalogue rails. Shared so
  // the whole rack is one draw state.
  const metal = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#c8ccd1',
    metalness: 0.88,
    roughness: 0.28,
    side: THREE.DoubleSide,
  }), []);

  useFrame(() => {
    const orientation = solarEngine.orientationOf(spec.id);
    if (!orientation || !yawRef.current) return;

    yawRef.current.rotation.y = THREE.MathUtils.degToRad(180 - orientation.azimuth);

    const tilt = THREE.MathUtils.degToRad(orientation.tilt);
    if (tiltRef.current) tiltRef.current.rotation.x = tilt;

    const tracker = trackerRef?.current;
    if (tracker) tracker.updateWorldMatrix(true, false);

    const d = rack.attachDistance;
    for (let i = 0; i < rack.legXs.length; i++) {
      const x = rack.legXs[i];
      _foot.set(x, 0, -d);

      if (tracker) {
        // Underside of the back rail, in the tracker frame (module plane
        // sits a few cm above y = 0).
        _attach.set(x, -0.04, -d);
        tracker.localToWorld(_attach);
        yawRef.current.worldToLocal(_attach);
      } else {
        _attach.set(
          x,
          rack.hingeHeight + d * Math.sin(tilt),
          -d * Math.cos(tilt),
        );
      }

      const dy = _attach.y - _foot.y;
      const dz = _attach.z - _foot.z;
      const length = Math.hypot(dy, dz) || 1e-3;
      const angle = Math.atan2(dz, dy);

      if (legRefs[i]) legRefs[i].rotation.x = angle;
      if (rodRefs[i]) {
        rodRefs[i].scale.y = length;
        rodRefs[i].position.y = length / 2;
      }
      if (capRefs[i]) capRefs[i].position.y = length;
    }
  });

  const legReach = Math.max(...rack.legXs.map(Math.abs));

  return (
    <group ref={yawRef}>
      {/* Front L-brackets: the edge that does not move. Corner feet as in
          the reference photograph, plus mid-span feet on the 11.5 m array. */}
      {rack.hingeXs.map((x) => (
        <group key={`hinge${x}`} position={[x, 0, 0]}>
          <mesh material={metal} position={[0, 0.01, 0.02]} castShadow receiveShadow>
            <boxGeometry args={[0.18, 0.02, 0.22]} />
          </mesh>
          <mesh material={metal} position={[0, rack.hingeHeight / 2, 0]} castShadow>
            <boxGeometry args={[0.045, rack.hingeHeight, 0.09]} />
          </mesh>
          <mesh
            material={metal}
            position={[0, rack.hingeHeight, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.018, 0.018, 0.14, 12]} />
          </mesh>
        </group>
      ))}

      {/* Rear cross-rail: sits under the back edge of the array and tilts
          with it, so the telescopic arms have something visible to push
          against from the teaching camera. */}
      <group ref={tiltRef} position={[0, rack.hingeHeight, 0]}>
        <mesh
          material={metal}
          position={[0, -0.04, -rack.attachDistance]}
          castShadow
        >
          <boxGeometry args={[legReach * 2 + 0.1, 0.05, 0.06]} />
        </mesh>
      </group>

      {/* Rear telescopic arms. Square extrusion, like the photograph.
          The outer pair sits OUTBOARD of the modules so they read as silver
          posts flanking the array instead of hiding behind it. */}
      {rack.legXs.map((x, i) => (
        <group key={`leg${x}`} position={[x, 0, -rack.attachDistance]}>
          <mesh material={metal} position={[0, 0.01, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.16, 0.02, 0.16]} />
          </mesh>

          <group ref={(el) => { legRefs[i] = el; }}>
            <mesh material={metal} position={[0, rack.sleeveLength / 2, 0]} castShadow>
              <boxGeometry args={[0.07, rack.sleeveLength, 0.07]} />
            </mesh>
            <mesh ref={(el) => { rodRefs[i] = el; }} material={metal} castShadow>
              <boxGeometry args={[0.048, 1, 0.048]} />
            </mesh>
            <mesh ref={(el) => { capRefs[i] = el; }} material={metal} castShadow>
              <boxGeometry args={[0.11, 0.07, 0.09]} />
            </mesh>
          </group>
        </group>
      ))}
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
