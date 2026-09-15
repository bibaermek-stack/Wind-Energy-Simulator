/**
 * One turbine in the 3D scene.
 *
 * Generic over all three machines: everything model-specific comes from
 * `spec.scene` in turbineSpecs.js, so adding a fourth turbine needs no
 * change here.
 *
 * ---------------------------------------------------------------------------
 * HOW THE ROTOR IS MADE TO TURN INDEPENDENTLY
 * ---------------------------------------------------------------------------
 * All three .glb files ship their rotor as its own node, so no mesh surgery
 * is needed -- but they do not agree on where that node's origin sits.
 *
 *   small.glb   Rotor's local origin is already on the rotor axis (it was
 *               authored that way), so rotating the node just works.
 *
 *   vawt.glb    PlanesHolder_27 carries a translation to the rotor centre
 *               and its blades are positioned relative to it. Also works
 *               directly -- rotate it about Y.
 *
 *   hawt.glb    Generator's node transform is identity and the blade
 *               vertices are baked in model coordinates. Rotating the node
 *               would swing the whole rotor around the model's origin,
 *               down at ground level, instead of spinning it about the hub.
 *
 * For that last case the fix is to insert an empty group at the hub and
 * re-parent the rotor into it with Object3D.attach(), which moves a node
 * between parents while preserving its world transform. The rotor does not
 * move a millimetre; it simply gains an ancestor whose origin is the hub,
 * and rotating that ancestor now spins it correctly.
 *
 * If a model ever arrives whose rotor is welded into a single mesh with the
 * tower, this approach cannot work -- the blades would have to be split off
 * in Blender first (select the blade faces, P > Selection, then set the new
 * object's origin to the hub with Object > Set Origin > Origin to 3D Cursor).
 * See README.md.
 */

import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import { clone as cloneGltfScene } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';

import { engine } from '../../physics/SimulationEngine.js';
import { useSimulation } from '../../state/simulationStore.js';
import { number } from '../../utils/format.js';

const DRACO_PATH = '/draco/';

const AXIS_INDEX = { x: 'x', y: 'y', z: 'z' };

export default function WindTurbine({ spec }) {
  const { scene: gltfScene } = useGLTF(spec.modelUrl, DRACO_PATH);

  const selectedId = useSimulation((s) => s.selectedId);
  const showLabels = useSimulation((s) => s.showLabels);
  const select = useSimulation((s) => s.select);
  const isSelected = selectedId === spec.id;

  const rotorRef = useRef(null);
  const auxRef = useRef(null);
  const ringRef = useRef(null);

  /**
   * Clone the loaded scene once per turbine, then rewire the rotor.
   *
   * useGLTF caches by URL and hands back a shared object; mutating it
   * directly would corrupt the cache for any other consumer, so the clone
   * is mandatory, not defensive. SkeletonUtils' clone is used rather than
   * Object3D.clone because it correctly rebinds skinned meshes, should a
   * future model have any.
   */
  const { model, rotor, aux, radius } = useMemo(() => {
    const root = cloneGltfScene(gltfScene);
    root.updateMatrixWorld(true);

    let rotorNode = root.getObjectByName(spec.scene.rotorNode);
    if (!rotorNode) {
      console.warn(
        `[WindTurbine] rotor node "${spec.scene.rotorNode}" not found in ${spec.modelUrl}. `
        + 'The turbine will render but will not spin. Node names present: '
        + collectNames(root).join(', '),
      );
    } else if (spec.scene.rotorPivot) {
      const pivot = new THREE.Group();
      pivot.name = `${spec.scene.rotorNode}__pivot`;
      pivot.position.fromArray(spec.scene.rotorPivot);
      root.add(pivot);
      // attach() preserves the world transform across the re-parenting,
      // so the rotor stays exactly where the artist put it.
      pivot.attach(rotorNode);
      rotorNode = pivot;
    }

    const auxNode = spec.scene.auxNode ? root.getObjectByName(spec.scene.auxNode) : null;

    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = true;
      // Sketchfab exports often ship single-sided materials that read as
      // holes at grazing angles on thin blade surfaces.
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material) return;
        material.side = THREE.FrontSide;
        material.envMapIntensity = 0.65;
      });
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);

    return { model: root, rotor: rotorNode, aux: auxNode, radius: Math.max(size.x, size.z) * 0.62 };
  }, [gltfScene, spec]);

  useEffect(() => {
    rotorRef.current = rotor;
    auxRef.current = aux;
  }, [rotor, aux]);

  useFrame((state) => {
    const runtime = engine.turbines[spec.id];
    if (!runtime) return;

    const axis = AXIS_INDEX[spec.scene.rotorAxis] ?? 'z';
    if (rotorRef.current) {
      rotorRef.current.rotation[axis] = runtime.angle;
    }
    if (auxRef.current) {
      const auxAxis = AXIS_INDEX[spec.scene.auxAxis] ?? 'z';
      auxRef.current.rotation[auxAxis] = runtime.angle * (spec.scene.auxRatio ?? 1);
    }
    if (ringRef.current && isSelected) {
      // A slow breathing pulse, so the selection marker reads as active
      // without becoming a distraction.
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.8) * 0.02;
      ringRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group
      position={spec.scene.position}
      rotation={[0, spec.scene.rotationY, 0]}
      scale={spec.scene.scale}
    >
      <primitive
        object={model}
        onClick={(event) => {
          event.stopPropagation();
          select(spec.id);
        }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
      />

      <SelectionRing ref={ringRef} radius={radius} colour={spec.accent} visible={isSelected} />

      {showLabels && (
        <Html
          position={[0, spec.scene.labelHeight, 0]}
          center
          // No distanceFactor: a tag scaled by distance is illegible on the
          // 66 m machine across the field and absurdly large on the 1.8 m
          // one a few metres away. Constant screen size is what a label
          // wants. zIndexRange stays below the rails' z-index of 10 so the
          // tags never paint over the instrument panels.
          zIndexRange={[8, 0]}
          style={{ pointerEvents: 'auto' }}
        >
          <button
            type="button"
            className={`turbine-tag ${isSelected ? 'is-selected' : ''}`}
            style={{ '--tag-accent': spec.accent }}
            onClick={() => select(spec.id)}
          >
            <span className="turbine-tag__type">{spec.typeCode}</span>
            <span className="turbine-tag__name">{spec.name.kk}</span>
            <span className="turbine-tag__meta">
              {`Ø ${number(spec.rotor.diameter, 2)} m`}
            </span>
          </button>
        </Html>
      )}
    </group>
  );
}

/**
 * Ground marker under the selected machine. Two concentric rings rather
 * than a filled disc, so it never hides the grass or the tower shadow.
 */
const SelectionRing = forwardRef(({ radius, colour, visible }, ref) => (
  <group ref={ref} visible={visible} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <mesh>
      <ringGeometry args={[radius * 0.97, radius, 96]} />
      <meshBasicMaterial color={colour} transparent opacity={0.85} depthWrite={false} />
    </mesh>
    <mesh>
      <ringGeometry args={[radius * 0.55, radius * 0.565, 96]} />
      <meshBasicMaterial color={colour} transparent opacity={0.35} depthWrite={false} />
    </mesh>
  </group>
));
SelectionRing.displayName = 'SelectionRing';

function collectNames(root) {
  const names = [];
  root.traverse((o) => { if (o.name) names.push(o.name); });
  return names.slice(0, 40);
}

useGLTF.preload('/models/hawt.glb', DRACO_PATH);
useGLTF.preload('/models/vawt.glb', DRACO_PATH);
useGLTF.preload('/models/small.glb', DRACO_PATH);
