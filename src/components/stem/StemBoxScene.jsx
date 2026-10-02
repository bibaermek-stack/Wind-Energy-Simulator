/**
 * The STEM box bench: two printed boxes on a classroom table.
 *
 * ---------------------------------------------------------------------------
 * WHAT MOVES, AND HOW
 * ---------------------------------------------------------------------------
 * Every printed part is a pivot built by src/stem/stemBoxes.js from the
 * print file and the assembly table. Each frame its pose is its finished
 * pose with up to four rigid motions laid on top, in this order:
 *
 *   spin      rotor parts turn about the hub axis
 *   yaw       nacelle and rotor turn about the tower axis
 *   out       the working device lifts out of the box onto the table
 *   explode   parts not yet assembled wait at their exploded offset
 *
 * so the turbine keeps turning while it is carried out, and an exploded
 * part is simply "the finished pose, displaced".
 *
 * The scene is in metres like the rest of the simulator, but at desk
 * scale: the boxes are about 25 cm long. It has its own Canvas rather than
 * sharing the 1.4 km landscape, because a box that size would be invisible
 * in it -- and because the lesson here is the build, not the site.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import {
  SOLAR_PARTS, WIND_PARTS, STEPS, WIND_PIVOTS, SOLAR_DECK,
} from '../../stem/boxAssembly.js';
import { buildBox, MM } from '../../stem/stemBoxes.js';
import {
  stemEngine, lampPosition, TRACKER, PAN_OFFSET,
} from '../../stem/stemEngine.js';
import { useBox } from '../../stem/boxStore.js';
import { OUT_OFFSETS, TABLE_Y } from '../../stem/boxLayout.js';
import { T } from '../../i18n/strings.js';

const MODEL_URL = '/models/stem-boxes.glb';
const DRACO_PATH = '/draco/';

/** Feet bottoms sit on the table top (y = 0). */
const BOX_LIFT = -TABLE_Y * MM;

export const BOX_LAYOUT = {
  solar: { position: [-0.2, BOX_LIFT, 0], table: SOLAR_PARTS },
  wind: { position: [0.22, BOX_LIFT, 0], table: WIND_PARTS },
};

/** Where each device is set down when taken out (see boxLayout.js). */
const OUT = {
  solar: new THREE.Vector3(...OUT_OFFSETS.solar),
  wind: new THREE.Vector3(...OUT_OFFSETS.wind),
};

/**
 * The reference rendering shows the working machine in light grey and
 * the solar deck as a pale plate. The print file colours these by
 * filament, which is what a printed box will look like; on screen the
 * device reads more clearly in the drawing's colours, so it gets them.
 */
const DEVICE_GREY = new Set(['W07T', 'W07S', 'W20', 'W21', 'W22', 'W23', 'W24', 'W25',
  'W26#1', 'W26#2', 'W26#3']);
const PALE_DECK = new Set(['S07']);

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

/** 0..1 progress of one step within a box's overall assembly value. */
function stepProgress(assembly, stepIndex, n) {
  return clamp01(assembly * n - stepIndex);
}

// ---------------------------------------------------------------------------
// the solar tracker (generated: the print file holds the box, not the
// electronics it carries)
// ---------------------------------------------------------------------------
function TrackerDevice({ panRef, tiltRef }) {
  const grey = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a7aeb6', roughness: 0.5 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b3038', roughness: 0.6 }), []);
  const cell = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1d3f8a', roughness: 0.25, metalness: 0.2,
  }), []);
  const ldr = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.4 }), []);
  const axisY = TRACKER.pivot[1] - SOLAR_DECK.centre[1];

  const cells = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 4; j++) {
      cells.push([-52.5 + i * 21 + 10, (j - 1.5) * 18.5]);
    }
  }

  return (
    <group>
      {/* Base plate bolted into the deck's T-slots, and the pan servo. */}
      <mesh material={dark} position={[0, 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[64, 4, 64]} />
      </mesh>
      <mesh material={grey} position={[0, 4 + 19, 0]} castShadow>
        <boxGeometry args={[22, 38, 42]} />
      </mesh>
      <group ref={panRef} position={[0, 42, 0]}>
        <mesh material={dark} position={[0, 1.5, 0]} castShadow>
          <cylinderGeometry args={[14, 14, 3, 32]} />
        </mesh>
        {/* U-bracket */}
        <mesh material={grey} position={[0, 4.5, 0]} castShadow>
          <boxGeometry args={[78, 3, 22]} />
        </mesh>
        {[-38, 38].map((x) => (
          <mesh key={x} material={grey} position={[x, 4.5 + (axisY - 42) / 2, 0]} castShadow>
            <boxGeometry args={[3, axisY - 42 + 6, 22]} />
          </mesh>
        ))}
        {/* Tilt servo on the bracket's right cheek. */}
        <mesh material={grey} position={[49, axisY - 42, 0]} castShadow>
          <boxGeometry args={[18, 22, 40]} />
        </mesh>
        <group ref={tiltRef} position={[0, axisY - 42, 0]}>
          <mesh material={dark} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[4, 4, 80, 16]} />
          </mesh>
          {/* The module: aluminium frame, 24 cells. */}
          <mesh material={grey} position={[0, 6, 0]} castShadow receiveShadow>
            <boxGeometry args={[130, 4, 84]} />
          </mesh>
          {cells.map(([x, z]) => (
            <mesh key={`${x}:${z}`} material={cell} position={[x, 8.3, z]}>
              <boxGeometry args={[19.5, 0.6, 17]} />
            </mesh>
          ))}
          {/* Four light sensors behind a cross-shaped shade: the eyes of the
              tracker. Unequal light on them is the error the servos null. */}
          <group position={[0, 8, -48]}>
            <mesh material={dark} position={[0, 0, 0]}>
              <boxGeometry args={[22, 3, 14]} />
            </mesh>
            <mesh material={dark} position={[0, 7, 0]}>
              <boxGeometry args={[1.6, 12, 14]} />
            </mesh>
            <mesh material={dark} position={[0, 7, 0]}>
              <boxGeometry args={[22, 12, 1.6]} />
            </mesh>
            {[[-5, -3.5], [5, -3.5], [-5, 3.5], [5, 3.5]].map(([x, z]) => (
              <mesh key={`${x}${z}`} material={ldr} position={[x, 2, z]}>
                <cylinderGeometry args={[2.2, 2.2, 1.5, 12]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// the lamp that plays the sun
// ---------------------------------------------------------------------------
function Lamp({ lightRef }) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[9, 24, 16]} />
        <meshStandardMaterial color="#fff2b0" emissive="#ffd34d" emissiveIntensity={2.4} />
      </mesh>
      <mesh>
        <sphereGeometry args={[16, 24, 16]} />
        <meshBasicMaterial color="#ffd34d" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <pointLight ref={lightRef} color="#ffe6a3" intensity={0.25} distance={0.6} decay={2} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// the desk fan that plays the wind
// ---------------------------------------------------------------------------
function Fan({ fanRef, bladesRef }) {
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e9edf2', roughness: 0.45 }), []);
  const blade = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#7fb8e6', roughness: 0.3, transparent: true, opacity: 0.85,
  }), []);
  const hubY = WIND_PIVOTS.hubHeight - TABLE_Y;
  return (
    <group ref={fanRef}>
      {/* Faces -z (towards the turbine) in its own frame. */}
      <mesh material={body} position={[0, 6, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[55, 62, 12, 40]} />
      </mesh>
      <mesh material={body} position={[0, hubY / 2, 0]} castShadow>
        <cylinderGeometry args={[7, 9, hubY, 16]} />
      </mesh>
      <group position={[0, hubY, 0]}>
        <mesh material={body} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 22]} castShadow>
          <cylinderGeometry args={[26, 30, 50, 24]} />
        </mesh>
        <mesh material={body} rotation={[0, 0, 0]} position={[0, 0, -8]}>
          <torusGeometry args={[118, 3, 8, 64]} />
        </mesh>
        <mesh material={body} position={[0, 0, -8]}>
          <torusGeometry args={[60, 1.6, 6, 48]} />
        </mesh>
        <group ref={bladesRef} position={[0, 0, -10]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} material={blade} rotation={[0, 0, (i * Math.PI) / 2]} position={[0, 0, 0]}>
              <boxGeometry args={[30, 200, 2]} />
            </mesh>
          ))}
          <mesh material={body} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[16, 16, 14, 24]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Air streaks from the fan to the rotor, speed with the wind. */
function Streaks({ streakRef }) {
  const count = 70;
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    return g;
  }, []);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    r: Math.sqrt(((i * 0.618) % 1)) * 105,
    a: i * 2.399,
    t: (i * 0.137) % 1,
  })), []);
  useEffect(() => {
    if (streakRef) streakRef.current = { geometry, seeds };
  }, [geometry, seeds, streakRef]);
  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial color="#5aa7e0" transparent opacity={0.55} />
    </lineSegments>
  );
}

// ---------------------------------------------------------------------------
// one box
// ---------------------------------------------------------------------------
const _q = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _qSpin = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);

function Box({ id }) {
  const { scene } = useGLTF(MODEL_URL, DRACO_PATH);
  const layout = BOX_LAYOUT[id];
  const steps = STEPS[id];
  const showLabels = useBox((s) => s.showLabels);
  // Re-render labels only at half-step resolution, not every frame.
  const coarse = useBox((s) => Math.round(s.assembly[id] * steps.length * 4));

  const { group, items } = useMemo(() => {
    const built = buildBox(scene, layout.table);
    built.items.forEach((it) => {
      it.stepIndex = steps.findIndex((s) => s.key === it.step);
      it.isDevice = Boolean(it.device || it.rotor || it.yaw);
      if (DEVICE_GREY.has(it.id) || PALE_DECK.has(it.id)) {
        it.pivot.traverse((o) => {
          if (!o.isMesh) return;
          o.material = o.material.clone();
          o.material.color.set(PALE_DECK.has(it.id) ? '#b9c0c8' : '#a7aeb6');
        });
      }
    });
    return built;
  }, [scene, layout.table, steps]);

  const deviceStep = steps.findIndex((s) => s.key === (id === 'solar' ? 'device' : 'tower'));

  // Solar tracker refs.
  const trackerRef = useRef();
  const panRef = useRef();
  const tiltRef = useRef();
  const lampRef = useRef();
  const lightRef = useRef();
  // Wind refs.
  const fanRef = useRef();
  const bladesRef = useRef();
  const streakRef = useRef();
  const labelRefs = useRef({});
  const outK = useRef(0);

  const hub = useMemo(() => new THREE.Vector3(...WIND_PIVOTS.hub), []);
  const tower = useMemo(() => new THREE.Vector3(...WIND_PIVOTS.tower), []);
  const rotorAxis = useMemo(() => new THREE.Vector3(...WIND_PIVOTS.rotorAxis), []);
  const fanAngle = useRef(0);

  useFrame((_, dt) => {
    const state = useBox.getState();
    const assembly = state.assembly[id];
    const n = steps.length;

    // Device in/out, eased, with a lift in the middle of the move.
    const wantOut = state.out[id] ? 1 : 0;
    outK.current += Math.sign(wantOut - outK.current) * Math.min(Math.abs(wantOut - outK.current), dt / 1.4);
    const k = ease(outK.current);
    const lift = Math.sin(Math.PI * k) * 110;
    const out = OUT[id];
    const outVec = [out.x * k, out.y * k + lift, out.z * k];

    const t = stemEngine.snapshot();
    const w = t.wind;
    const assembled = assembly >= 0.999;

    for (const it of items) {
      const e = ease(stepProgress(assembly, it.stepIndex, n));
      _q.copy(it.final.quaternion);
      _p.copy(it.final.position).multiplyScalar(1 / MM);

      if (id === 'wind' && (it.rotor || it.yaw)) {
        if (it.rotor && assembled) {
          _qSpin.setFromAxisAngle(rotorAxis, w.angle);
          _p.sub(hub).applyQuaternion(_qSpin).add(hub);
          _q.premultiply(_qSpin);
        }
        _qYaw.setFromAxisAngle(_Y, THREE.MathUtils.degToRad(w.yaw));
        _p.sub(tower).applyQuaternion(_qYaw).add(tower);
        _q.premultiply(_qYaw);
      }
      if (it.isDevice) _p.add(_v.set(...outVec));
      _p.addScaledVector(_v.copy(it.offset).multiplyScalar(1 / MM), 1 - e);

      it.pivot.position.copy(_p).multiplyScalar(MM);
      it.pivot.quaternion.copy(_q);
      const label = labelRefs.current[it.id];
      if (label) label.position.copy(it.pivot.position);
    }

    if (id === 'solar' && trackerRef.current) {
      const e = ease(stepProgress(assembly, deviceStep, n));
      const c = SOLAR_DECK.centre;
      trackerRef.current.position.set(
        (c[0] + outVec[0]) * MM,
        (c[1] + outVec[1] + 170 * (1 - e)) * MM,
        (c[2] + outVec[2]) * MM,
      );
      if (panRef.current) panRef.current.rotation.y = THREE.MathUtils.degToRad(t.solar.pan + PAN_OFFSET);
      if (tiltRef.current) tiltRef.current.rotation.x = THREE.MathUtils.degToRad(t.solar.tilt);
      if (lampRef.current) {
        const on = assembled && t.solar.lampOn;
        lampRef.current.visible = on;
        const lp = lampPosition(t.solar.lampAngle);
        lampRef.current.position.set(lp[0] * MM, lp[1] * MM, lp[2] * MM);
        if (lightRef.current) lightRef.current.intensity = 0.3 * t.solar.lampPower;
      }
    }

    if (id === 'wind' && fanRef.current) {
      const visible = assembled && w.fanOn;
      fanRef.current.visible = visible;
      // The fan stands 0.30 m upwind of the tower, wherever the tower is.
      const dir = THREE.MathUtils.degToRad(w.direction);
      const base = tower.clone().add(_v.set(...outVec));
      const r = 300;
      fanRef.current.position.set(
        (base.x + Math.sin(dir) * r) * MM,
        TABLE_Y * MM,
        (base.z + Math.cos(dir) * r) * MM,
      );
      fanRef.current.rotation.y = dir;
      fanAngle.current += (w.speed * 9) * dt;
      if (bladesRef.current) bladesRef.current.rotation.z = fanAngle.current;

      const streaks = streakRef.current;
      if (streaks) {
        const pos = streaks.geometry.attributes.position;
        const len = 18 + w.speed * 5;
        const show = visible && w.speed > 0.2;
        const hy = WIND_PIVOTS.hubHeight;
        for (let i = 0; i < streaks.seeds.length; i++) {
          const s = streaks.seeds[i];
          s.t = (s.t + dt * (0.25 + w.speed * 0.12)) % 1;
          const along = r - 40 - s.t * (r - 10);
          const lx = Math.cos(s.a) * s.r;
          const ly = Math.sin(s.a) * s.r;
          const px = base.x + Math.sin(dir) * along + Math.cos(dir) * lx;
          const pz = base.z + Math.cos(dir) * along - Math.sin(dir) * lx;
          const py = hy + ly;
          const tx = px - Math.sin(dir) * len;
          const tz = pz - Math.cos(dir) * len;
          if (show) {
            pos.setXYZ(i * 2, px * MM, py * MM, pz * MM);
            pos.setXYZ(i * 2 + 1, tx * MM, py * MM, tz * MM);
          } else {
            pos.setXYZ(i * 2, 0, -1, 0);
            pos.setXYZ(i * 2 + 1, 0, -1, 0);
          }
        }
        pos.needsUpdate = true;
      }
    }
  });

  const assemblyNow = coarse / (steps.length * 4);
  const unplaced = items.filter((it) => stepProgress(assemblyNow, it.stepIndex, steps.length) < 0.999);

  return (
    <group position={layout.position}>
      <primitive object={group} />

      {id === 'solar' && (
        <>
          <group ref={trackerRef} scale={MM}>
            <TrackerDevice panRef={panRef} tiltRef={tiltRef} />
          </group>
          <group ref={lampRef}>
            <group scale={MM}>
              <Lamp lightRef={lightRef} />
            </group>
          </group>
        </>
      )}

      {id === 'wind' && (
        <>
          <group ref={fanRef}>
            <group scale={MM}>
              <Fan bladesRef={bladesRef} />
            </group>
          </group>
          <Streaks streakRef={streakRef} />
        </>
      )}

      {showLabels && unplaced.map((it) => (
        <group key={it.id} ref={(el) => { labelRefs.current[it.id] = el; }}>
          <Html center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
            <span className="part-tag">{it.id.split('#')[0]}</span>
          </Html>
        </group>
      ))}

      {showLabels && assemblyNow >= 0.999 && (
        <Html position={[0, 0.33, 0]} center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
          <span className="box-tag" data-box={id}>{id === 'solar' ? T.boxSolarName : T.boxWindName}</span>
        </Html>
      )}
    </group>
  );
}

const _v = new THREE.Vector3();

// ---------------------------------------------------------------------------
// clock, camera, room
// ---------------------------------------------------------------------------
function Clock() {
  const acc = useRef(0);
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    const state = useBox.getState();
    state.advance(step);
    const solarOut = state.out.solar ? OUT.solar.toArray() : [0, 0, 0];
    stemEngine.update(step, {
      solarOffset: solarOut,
      solarActive: state.assembly.solar >= 0.999,
      windActive: state.assembly.wind >= 0.999,
    });
    acc.current += step;
    if (acc.current > 0.1) {
      acc.current = 0;
      state.refresh();
    }
  });
  return null;
}

const FRAMING = {
  both: { position: [0.02, 0.62, 1.3], target: [0.01, 0.13, 0] },
  solar: { position: [-0.05, 0.46, 0.78], target: [-0.2, 0.13, 0] },
  wind: { position: [0.38, 0.48, 0.8], target: [0.22, 0.15, 0] },
};

/** Wider shots once a device stands on the table beside its box. */
const FRAMING_OUT = {
  both: { position: [0.08, 0.72, 1.5], target: [0.06, 0.12, 0.08] },
  solar: { position: [-0.12, 0.5, 0.95], target: [-0.27, 0.11, 0.12] },
  wind: { position: [0.52, 0.52, 1.0], target: [0.35, 0.13, 0.08] },
};

function CameraRig() {
  const focus = useBox((s) => s.focus);
  const anyOut = useBox((s) => (s.focus === 'both'
    ? s.out.solar || s.out.wind
    : s.out[s.focus]));
  const controls = useRef();
  const { camera } = useThree();
  const flight = useRef(null);

  useEffect(() => {
    const goal = (anyOut ? FRAMING_OUT : FRAMING)[focus];
    flight.current = {
      t: 0,
      fromP: camera.position.clone(),
      fromT: controls.current ? controls.current.target.clone() : new THREE.Vector3(),
      toP: new THREE.Vector3(...goal.position),
      toT: new THREE.Vector3(...goal.target),
    };
  }, [focus, anyOut, camera]);

  useFrame((_, dt) => {
    const f = flight.current;
    if (!f || !controls.current) return;
    f.t = Math.min(1, f.t + dt / 1.2);
    const k = ease(f.t);
    camera.position.lerpVectors(f.fromP, f.toP, k);
    controls.current.target.lerpVectors(f.fromT, f.toT, k);
    controls.current.update();
    if (f.t >= 1) flight.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={0.18}
      maxDistance={2.2}
      maxPolarAngle={Math.PI * 0.49}
      onStart={() => { flight.current = null; }}
    />
  );
}

function Room() {
  return (
    <>
      {/* Table top: light birch laminate. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0005, 0]} receiveShadow>
        <planeGeometry args={[1.8, 1.1]} />
        <meshStandardMaterial color="#d9c7a6" roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.0205, 0]} receiveShadow>
        <boxGeometry args={[1.8, 0.04, 1.1]} />
        <meshStandardMaterial color="#c8b38c" roughness={0.85} />
      </mesh>
      {/* Floor far below, so the table edge reads as an edge. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.75, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#e4e7ec" roughness={1} />
      </mesh>
    </>
  );
}

function LoadingOverlay() {
  return (
    <Html center>
      <div className="scene-loader">
        <div className="scene-loader__spinner" />
        <p className="scene-loader__title">{T.loading}</p>
      </div>
    </Html>
  );
}

export default function StemBoxScene() {
  const focus = useBox((s) => s.focus);
  const showSolar = focus !== 'wind';
  const showWind = focus !== 'solar';

  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      gl={{ antialias: true }}
      camera={{ position: FRAMING.both.position, fov: 36, near: 0.01, far: 30 }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        scene.background = new THREE.Color('#eef1f5');
      }}
    >
      <hemisphereLight args={['#ffffff', '#c9b996', 1.1]} />
      <directionalLight
        position={[0.6, 1.4, 0.9]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-near={0.1}
        shadow-camera-far={4}
        shadow-camera-left={-0.9}
        shadow-camera-right={0.9}
        shadow-camera-top={0.9}
        shadow-camera-bottom={-0.9}
      />
      <directionalLight position={[-0.8, 0.6, -0.6]} intensity={0.45} />

      <Room />
      <Suspense fallback={<LoadingOverlay />}>
        {showSolar && <Box id="solar" />}
        {showWind && <Box id="wind" />}
      </Suspense>

      <Clock />
      <CameraRig />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL, DRACO_PATH);
