/**
 * Builds the third turbine -- a small-scale residential machine -- as real
 * lofted 3D geometry and exports it to public/models/small.glb.
 *
 * The other two turbines arrive as authored GLB files; this one is
 * generated so it is reproducible and editable from source. It is a
 * genuine GLB with a genuine node hierarchy, not runtime-only meshes and
 * certainly not a billboard: the app loads all three through the same
 * GLTF path and animates all three by the same rotor-pivot mechanism.
 *
 * Geometry is modelled on a typical 800 W / 1.8 m upwind machine with a
 * passive tail vane -- the type in the reference photograph.
 *
 * Node hierarchy produced (names are the contract with the runtime):
 *
 *   SmallWindTurbine
 *     Tower        guyed tubular mast, 9.6 m
 *     Nacelle      streamlined generator body with tail boom + vane
 *     Rotor        <- spun by the app about its local Z axis
 *       Hub
 *       NoseCone
 *       Blade_1..3 NACA 4412, tapered and twisted
 *
 * Run: npm run models:small
 */
import * as THREE from 'three';
import { mkdirSync, writeFileSync } from 'node:fs';
import { nacaSection } from './airfoil.mjs';

// GLTFExporter assembles the GLB binary chunk through a FileReader, which
// Node has no global for. Node's Blob already exposes arrayBuffer(), so the
// shim only needs to bridge that to the reader's callback contract. Must be
// installed before GLTFExporter is imported, hence the dynamic import below.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReaderShim {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        if (this.onloadend) this.onloadend();
      });
    }
  };
}

const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

// ---------------------------------------------------------------------------
// Machine geometry (metres). Matches SMALL_SCALE in src/physics/turbineSpecs.js
// ---------------------------------------------------------------------------
const ROTOR_RADIUS = 0.9;     // 1.8 m diameter
const HUB_RADIUS = 0.085;
const TOWER_HEIGHT = 9.6;
const HUB_HEIGHT = 9.85;
const ROOT_CHORD = 0.135;
const TIP_CHORD = 0.052;
const ROOT_TWIST = 24 * (Math.PI / 180);
const TIP_TWIST = 2.5 * (Math.PI / 180);
const SPAN_STATIONS = 16;

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
const bladeMaterial = new THREE.MeshStandardMaterial({
  name: 'BladeGRP', color: 0xf3f5f7, roughness: 0.32, metalness: 0.04, side: THREE.DoubleSide,
});
const shellMaterial = new THREE.MeshStandardMaterial({
  name: 'NacelleShell', color: 0xeef1f4, roughness: 0.28, metalness: 0.08,
});
const steelMaterial = new THREE.MeshStandardMaterial({
  name: 'GalvanisedSteel', color: 0xa8b0b8, roughness: 0.42, metalness: 0.85,
});
const darkMaterial = new THREE.MeshStandardMaterial({
  name: 'AnodisedAlloy', color: 0x2c3440, roughness: 0.45, metalness: 0.6,
});

// ---------------------------------------------------------------------------
// Blade: loft a twisted, tapered NACA 4412 along the span
// ---------------------------------------------------------------------------
function buildBlade() {
  const profile = nacaSection('4412', 22);
  const ringSize = profile.length;
  const positions = [];
  const indices = [];

  const rings = [];
  for (let i = 0; i < SPAN_STATIONS; i++) {
    const s = i / (SPAN_STATIONS - 1);
    const r = HUB_RADIUS + (ROTOR_RADIUS - HUB_RADIUS) * s;

    // Chord tapers non-linearly: real small blades hold chord through the
    // inboard third for starting torque, then taper hard.
    const chord = ROOT_CHORD + (TIP_CHORD - ROOT_CHORD) * Math.pow(s, 0.72);
    // Twist follows roughly 1/r, as blade-element theory requires to keep a
    // near-constant angle of attack along the span at a fixed tip-speed ratio.
    const twist = TIP_TWIST + (ROOT_TWIST - TIP_TWIST) * Math.pow(1 - s, 1.6);
    // Slight sweep gives the blade its recognisable outboard curve.
    const sweep = 0.055 * Math.pow(s, 2.1);

    const ring = [];
    for (const [cx, cy] of profile) {
      // Centre the profile on its quarter-chord, the usual pitch axis.
      const px = (cx - 0.25) * chord;
      const pz = cy * chord;
      const x = px * Math.cos(twist) - pz * Math.sin(twist);
      const z = px * Math.sin(twist) + pz * Math.cos(twist);
      // Span runs along +Y; the rotor spins about Z.
      ring.push([x + sweep, r, z]);
    }
    rings.push(ring);
  }

  rings.forEach((ring) => ring.forEach((p) => positions.push(p[0], p[1], p[2])));

  // Quad strips between adjacent stations
  for (let i = 0; i < SPAN_STATIONS - 1; i++) {
    for (let j = 0; j < ringSize; j++) {
      const a = i * ringSize + j;
      const b = i * ringSize + ((j + 1) % ringSize);
      const c = (i + 1) * ringSize + j;
      const d = (i + 1) * ringSize + ((j + 1) % ringSize);
      indices.push(a, c, b, b, c, d);
    }
  }

  // Fan-cap the root and tip so the blade is a closed solid
  const capRing = (ringIndex, flip) => {
    const base = ringIndex * ringSize;
    const centre = positions.length / 3;
    const cx = rings[ringIndex].reduce((s, p) => s + p[0], 0) / ringSize;
    const cy = rings[ringIndex].reduce((s, p) => s + p[1], 0) / ringSize;
    const cz = rings[ringIndex].reduce((s, p) => s + p[2], 0) / ringSize;
    positions.push(cx, cy, cz);
    for (let j = 0; j < ringSize; j++) {
      const a = base + j;
      const b = base + ((j + 1) % ringSize);
      if (flip) indices.push(centre, b, a);
      else indices.push(centre, a, b);
    }
  };
  capRing(0, true);
  capRing(SPAN_STATIONS - 1, false);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// ---------------------------------------------------------------------------
// Lathe helper: profile is [radius, axial] pairs; result has its axis on +Z
// ---------------------------------------------------------------------------
function latheAlongZ(profile, segments = 28) {
  const points = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y));
  const geometry = new THREE.LatheGeometry(points, segments);
  geometry.rotateX(Math.PI / 2);   // spin axis Y -> Z
  return geometry;
}

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------
const root = new THREE.Group();
root.name = 'SmallWindTurbine';

// --- Tower: tapered tubular mast on a small concrete pad ---
const tower = new THREE.Group();
tower.name = 'Tower';

const mast = new THREE.Mesh(
  new THREE.CylinderGeometry(0.048, 0.082, TOWER_HEIGHT, 20, 1, false),
  steelMaterial,
);
mast.name = 'Mast';
mast.position.y = TOWER_HEIGHT / 2;
tower.add(mast);

const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.12, 20), darkMaterial);
basePlate.name = 'BasePlate';
basePlate.position.y = 0.06;
tower.add(basePlate);

const pad = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 1.1), new THREE.MeshStandardMaterial({
  name: 'ConcretePad', color: 0xb9bcbf, roughness: 0.92, metalness: 0,
}));
pad.name = 'Foundation';
pad.position.y = 0.07;
tower.add(pad);

// Three guy wires -- characteristic of a guyed small-turbine mast
for (let i = 0; i < 3; i++) {
  const angle = (i / 3) * Math.PI * 2;
  const anchor = new THREE.Vector3(Math.cos(angle) * 3.4, 0.05, Math.sin(angle) * 3.4);
  const attach = new THREE.Vector3(Math.cos(angle) * 0.05, TOWER_HEIGHT * 0.72, Math.sin(angle) * 0.05);
  const length = anchor.distanceTo(attach);
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, length, 5), steelMaterial);
  wire.name = `GuyWire_${i + 1}`;
  wire.position.copy(anchor).add(attach).multiplyScalar(0.5);
  wire.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    attach.clone().sub(anchor).normalize(),
  );
  tower.add(wire);
}
root.add(tower);

// --- Nacelle: streamlined body, tail boom and yaw vane ---
const nacelle = new THREE.Group();
nacelle.name = 'Nacelle';
nacelle.position.y = HUB_HEIGHT;

// Body profile runs from just behind the hub (+Z) back to the boom root (-Z)
const body = new THREE.Mesh(latheAlongZ([
  [0.052, 0.30], [0.098, 0.20], [0.115, 0.06], [0.115, -0.12],
  [0.100, -0.26], [0.070, -0.36], [0.036, -0.42], [0.001, -0.44],
]), shellMaterial);
body.name = 'NacelleShell';
nacelle.add(body);

const yawCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.16, 16), darkMaterial);
yawCollar.name = 'YawBearing';
yawCollar.position.y = -0.11;
nacelle.add(yawCollar);

const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.026, 0.95, 12), steelMaterial);
boom.name = 'TailBoom';
boom.rotation.x = Math.PI / 2;
boom.position.z = -0.86;
nacelle.add(boom);

// Tail vane: a flat fin lying in the YZ plane, so it weathercocks the rotor
// into the wind. Shaped rather than rectangular.
const vaneShape = new THREE.Shape();
vaneShape.moveTo(-0.02, -0.15);
vaneShape.lineTo(0.30, -0.26);
vaneShape.lineTo(0.42, 0.06);
vaneShape.lineTo(0.30, 0.30);
vaneShape.lineTo(-0.02, 0.19);
vaneShape.closePath();
const vaneGeometry = new THREE.ExtrudeGeometry(vaneShape, {
  depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1,
});
vaneGeometry.rotateY(Math.PI / 2);
const vane = new THREE.Mesh(vaneGeometry, shellMaterial);
vane.name = 'TailVane';
vane.position.set(0, 0.02, -1.30);
vane.rotation.x = -Math.PI / 2;
nacelle.add(vane);
root.add(nacelle);

// --- Rotor: the node the app spins ---
const rotor = new THREE.Group();
rotor.name = 'Rotor';
// Local origin sits exactly on the rotor axis, so the runtime only has to
// increment rotor.rotation.z -- no pivot correction needed for this model.
rotor.position.set(0, HUB_HEIGHT, 0.34);

const hub = new THREE.Mesh(latheAlongZ([
  [0.030, 0.10], [0.070, 0.07], [0.086, 0.02], [0.086, -0.07], [0.055, -0.11], [0.001, -0.12],
]), darkMaterial);
hub.name = 'Hub';
rotor.add(hub);

const noseCone = new THREE.Mesh(latheAlongZ([
  [0.001, 0.20], [0.030, 0.16], [0.055, 0.11], [0.072, 0.05], [0.078, 0.02],
]), shellMaterial);
noseCone.name = 'NoseCone';
rotor.add(noseCone);

const bladeGeometry = buildBlade();
for (let i = 0; i < 3; i++) {
  const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
  blade.name = `Blade_${i + 1}`;
  blade.rotation.z = (i / 3) * Math.PI * 2;
  rotor.add(blade);
}
root.add(rotor);

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.add(root);

const exporter = new GLTFExporter();
const glb = await new Promise((resolve, reject) => {
  exporter.parse(scene, resolve, reject, { binary: true, onlyVisible: false });
});

mkdirSync('public/models', { recursive: true });
const buffer = Buffer.from(glb);
writeFileSync('public/models/small.glb', buffer);

let triangles = 0;
root.traverse((o) => {
  if (!o.isMesh) return;
  const index = o.geometry.getIndex();
  triangles += (index ? index.count : o.geometry.getAttribute('position').count) / 3;
});
console.log(
  `Small-scale turbine: ${(buffer.length / 1024).toFixed(1)} KB, `
  + `${Math.round(triangles).toLocaleString()} triangles -> public/models/small.glb`,
);
