/**
 * Audits the STEM box models and their assembly.
 *
 * The assembled poses in src/stem/boxAssembly.js were worked out by hand
 * from the parts' features. This checks them against the actual geometry
 * from the print file, so a wrong pose shows up as a number rather than as
 * something that merely looks odd from one camera angle.
 *
 *   1. coverage     every printed part has a pose, every pose a part, every
 *                   step a known key
 *   2. meshes       each printed shell is closed (every edge shared by
 *                   exactly two triangles) and has no degenerate triangles
 *   3. interference parts are voxelised at 0.5 mm in their assembled pose;
 *                   any two parts sharing solid volume are reported
 *   4. support      every part touches another part (within 1 mm) -- a part
 *                   touching nothing is floating, i.e. its pose is wrong
 *   5. ground       the feet stand on the table, nothing is below it
 *   6. motion       the rotor's swept disc over the whole yaw range, the
 *                   tracker's panel over its whole tilt range and the lamp
 *                   over its whole path are checked against the box
 *   7. out          a device lifted out onto the table lands on the table
 *                   and clear of its box
 *
 * Run: node scripts/verify-stem.mjs        (or npm run verify:stem)
 * Exits non-zero if any check fails.
 */
import * as THREE from 'three';
import { loadStemParts } from './lib/stem3mf.mjs';
import {
  SOLAR_PARTS, WIND_PARTS, STEPS, WIND_PIVOTS, SOLAR_DECK,
} from '../src/stem/boxAssembly.js';
import { basisOf } from '../src/stem/boxAssembly.js';
import {
  TRACKER, LAMP, PAN_OFFSET, lampPosition,
} from '../src/stem/stemEngine.js';
import { OUT_OFFSETS, TABLE_Y } from '../src/stem/boxLayout.js';

const RES = 0.5;                 // voxel edge, mm

/** `--dump A,B` writes the voxels A and B share to stem-overlap.json. */
const dumpArg = process.argv.indexOf('--dump');
const DUMP = dumpArg > 0 ? new Set(process.argv[dumpArg + 1].split(',')) : null;
const dumped = [];
const labelNames = new Map();
const OVERLAP_ERROR_MM3 = 2;     // shared solid volume that counts as a clash
const CONTACT_MM = 1.0;          // gap still counted as touching

let errors = 0;
let warnings = 0;
const fail = (msg) => { errors++; console.log(`  FAIL  ${msg}`); };
const warn = (msg) => { warnings++; console.log(`  warn  ${msg}`); };
const ok = (msg) => console.log(`  ok    ${msg}`);
const head = (msg) => console.log(`\n${msg}`);

// ---------------------------------------------------------------------------
// poses
// ---------------------------------------------------------------------------
function matrixOf(part) {
  const [a, b, c] = basisOf(part.basis).map((v) => new THREE.Vector3(...v));
  const m = new THREE.Matrix4().makeBasis(a, b, c);
  if (part.pre) m.multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(part.pre)));
  m.setPosition(...part.pos);
  return m;
}

function isRightHanded(part) {
  const m = matrixOf(part);
  return m.determinant() > 0.999 && Math.abs(m.determinant() - 1) < 1e-6;
}

/** All vertices of a part, assembled, as a flat array of Vector3. */
function assembledShells(source, part, extra = null) {
  const m = matrixOf(part);
  if (extra) m.premultiply(extra);
  const e = m.elements;
  return source.shells.map((shell) => {
    const v = shell.vertices;
    const out = new Float64Array(v.length);
    for (let i = 0; i < v.length; i += 3) {
      const x = v[i]; const y = v[i + 1]; const z = v[i + 2];
      out[i] = e[0] * x + e[4] * y + e[8] * z + e[12];
      out[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      out[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    }
    return { vertices: out, indices: shell.indices, name: shell.name };
  });
}

// ---------------------------------------------------------------------------
// mesh checks
// ---------------------------------------------------------------------------
function meshReport(shell) {
  const edges = new Map();
  const v = shell.vertices;
  const t = shell.indices;
  let degenerate = 0;
  // Weld by position: 3MF exporters may duplicate vertices along seams.
  const key = (i) => `${v[i * 3].toFixed(4)},${v[i * 3 + 1].toFixed(4)},${v[i * 3 + 2].toFixed(4)}`;
  const welded = new Map();
  const id = (i) => {
    const k = key(i);
    if (!welded.has(k)) welded.set(k, welded.size);
    return welded.get(k);
  };
  for (let f = 0; f < t.length; f += 3) {
    const a = id(t[f]); const b = id(t[f + 1]); const c = id(t[f + 2]);
    if (a === b || b === c || a === c) { degenerate++; continue; }
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const k = p < q ? `${p}_${q}` : `${q}_${p}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  let open = 0;
  let nonManifold = 0;
  for (const n of edges.values()) {
    if (n === 1) open++;
    else if (n > 2) nonManifold++;
  }
  return { triangles: t.length / 3, degenerate, open, nonManifold };
}

// ---------------------------------------------------------------------------
// voxels
// ---------------------------------------------------------------------------
class Grid {
  constructor(min, max) {
    this.min = min.map((c) => Math.floor(c / RES) * RES - 2 * RES);
    this.n = max.map((c, i) => Math.ceil((c - this.min[i]) / RES) + 3);
    this.owner = new Uint8Array(this.n[0] * this.n[1] * this.n[2]);
    this.overlap = new Map();
    this.where = new Map();
    this.count = [];
    this.parityErrors = [];
  }

  index(i, j, k) { return (i * this.n[1] + j) * this.n[2] + k; }

  cellOf(p) {
    return [0, 1, 2].map((a) => Math.floor((p[a] - this.min[a]) / RES));
  }

  ownerAt(p) {
    const [i, j, k] = this.cellOf(p);
    if (i < 0 || j < 0 || k < 0 || i >= this.n[0] || j >= this.n[1] || k >= this.n[2]) return 0;
    return this.owner[this.index(i, j, k)];
  }

  /**
   * Solid-fills one closed shell: rays along +y through every column
   * centre, crossings sorted, inside between pairs.
   */
  fill(shell, label) {
    const v = shell.vertices;
    const t = shell.indices;
    const cols = new Map();
    const [x0, , z0] = this.min;
    // A tiny irrational offset keeps column centres off triangle edges.
    const ox = RES * 0.5 + 1.37e-4;
    const oz = RES * 0.5 + 2.91e-4;
    for (let f = 0; f < t.length; f += 3) {
      const a = t[f] * 3; const b = t[f + 1] * 3; const c = t[f + 2] * 3;
      const ax = v[a]; const ay = v[a + 1]; const az = v[a + 2];
      const bx = v[b]; const by = v[b + 1]; const bz = v[b + 2];
      const cx = v[c]; const cy = v[c + 1]; const cz = v[c + 2];
      const det = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
      if (Math.abs(det) < 1e-12) continue;
      const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - x0 - ox) / RES));
      const i1 = Math.min(this.n[0] - 1, Math.floor((Math.max(ax, bx, cx) - x0 - ox) / RES));
      const k0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - z0 - oz) / RES));
      const k1 = Math.min(this.n[2] - 1, Math.floor((Math.max(az, bz, cz) - z0 - oz) / RES));
      for (let i = i0; i <= i1; i++) {
        const px = x0 + ox + i * RES;
        for (let k = k0; k <= k1; k++) {
          const pz = z0 + oz + k * RES;
          const u = ((px - ax) * (cz - az) - (cx - ax) * (pz - az)) / det;
          const w = ((bx - ax) * (pz - az) - (px - ax) * (bz - az)) / det;
          if (u < 0 || w < 0 || u + w > 1) continue;
          const y = ay + u * (by - ay) + w * (cy - ay);
          const key = i * this.n[2] + k;
          let list = cols.get(key);
          if (!list) cols.set(key, list = []);
          list.push(y);
        }
      }
    }
    const [, y0] = this.min;
    let odd = 0;
    for (const [key, ys] of cols) {
      ys.sort((p, q) => p - q);
      if (ys.length % 2) odd++;
      const i = Math.floor(key / this.n[2]);
      const k = key % this.n[2];
      for (let s = 0; s + 1 < ys.length; s += 2) {
        const j0 = Math.max(0, Math.ceil((ys[s] - y0) / RES - 0.5));
        const j1 = Math.min(this.n[1] - 1, Math.floor((ys[s + 1] - y0) / RES - 0.5));
        for (let j = j0; j <= j1; j++) this.mark(this.index(i, j, k), label);
      }
    }
    return odd;
  }

  mark(idx, label) {
    const o = this.owner[idx];
    if (o === 0) {
      this.owner[idx] = label;
      this.count[label] = (this.count[label] ?? 0) + 1;
    } else if (o !== label) {
      const key = o < label ? `${o}:${label}` : `${label}:${o}`;
      this.overlap.set(key, (this.overlap.get(key) ?? 0) + 1);
      const nz = this.n[2];
      const ny = this.n[1];
      const c = [Math.floor(idx / (ny * nz)), Math.floor(idx / nz) % ny, idx % nz]
        .map((q, a) => this.min[a] + (q + 0.5) * RES);
      if (DUMP && DUMP.has(labelNames.get(o)) && DUMP.has(labelNames.get(label))) dumped.push(c);
      const b = this.where.get(key);
      if (!b) this.where.set(key, { min: [...c], max: [...c] });
      else for (let a = 0; a < 3; a++) { b.min[a] = Math.min(b.min[a], c[a]); b.max[a] = Math.max(b.max[a], c[a]); }
    }
  }

  /** Which labels touch which, within `reach` cells along each axis. */
  contacts(reach) {
    const touch = new Map();
    const [nx, ny, nz] = this.n;
    const o = this.owner;
    const add = (a, b) => {
      if (!touch.has(a)) touch.set(a, new Set());
      if (!touch.has(b)) touch.set(b, new Set());
      touch.get(a).add(b);
      touch.get(b).add(a);
    };
    const strides = [ny * nz, nz, 1];
    const sizes = [nx, ny, nz];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        for (let k = 0; k < nz; k++) {
          const idx = (i * ny + j) * nz + k;
          const a = o[idx];
          if (!a) continue;
          const pos = [i, j, k];
          for (let ax = 0; ax < 3; ax++) {
            for (let r = 1; r <= reach; r++) {
              if (pos[ax] + r >= sizes[ax]) break;
              const b = o[idx + strides[ax] * r];
              if (b && b !== a) { add(a, b); break; }
            }
          }
        }
      }
    }
    return touch;
  }
}

// ---------------------------------------------------------------------------
// sweeps
// ---------------------------------------------------------------------------
/** Points on the surface of a box, every `step` mm. */
function boxPoints([sx, sy, sz], [cx, cy, cz], step = 1) {
  const pts = [];
  const range = (s) => {
    const n = Math.max(1, Math.round(s / step));
    return Array.from({ length: n + 1 }, (_, i) => -s / 2 + (i * s) / n);
  };
  for (const x of range(sx)) for (const y of range(sy)) for (const z of range(sz)) {
    const onFace = Math.abs(Math.abs(x) - sx / 2) < 1e-9
      || Math.abs(Math.abs(y) - sy / 2) < 1e-9
      || Math.abs(Math.abs(z) - sz / 2) < 1e-9;
    if (onFace) pts.push(new THREE.Vector3(x + cx, y + cy, z + cz));
  }
  return pts;
}

/**
 * The tracker's moving head, in the tilt frame (origin on the tilt axis),
 * mirroring TrackerDevice in StemBoxScene.jsx.
 */
function trackerHeadPoints() {
  return [
    ...boxPoints([130, 4, 84], [0, 6, 0], 1.5),           // module frame
    ...boxPoints([22, 3, 14], [0, 8, -48], 1),            // LDR board
    ...boxPoints([22, 12, 14], [0, 15, -48], 1),          // LDR cross shade
  ];
}

// ---------------------------------------------------------------------------
// one box
// ---------------------------------------------------------------------------
function auditBox(id, table, source) {
  head(`== ${id === 'solar' ? 'TRACKING SOLAR' : 'WIND GENERATOR'} (${table.length} parts)`);

  // 1. coverage --------------------------------------------------------------
  const prefix = id === 'solar' ? 'S' : 'W';
  const inFile = [...source.parts.keys()].filter((k) => k.startsWith(prefix));
  const posed = new Set(table.map((p) => p.id));
  const missingPose = inFile.filter((k) => !posed.has(k));
  const missingPart = table.filter((p) => !source.parts.has(p.id)).map((p) => p.id);
  // W07S25 is the alternative sleeve for a 25 mm tower; only one is fitted.
  const optional = new Set(['W07S25']);
  const realMissing = missingPose.filter((k) => !optional.has(k));
  if (missingPart.length) fail(`poses for parts not in the print file: ${missingPart.join(', ')}`);
  if (realMissing.length) fail(`printed parts with no pose: ${realMissing.join(', ')}`);
  else ok(`all ${inFile.length - missingPose.length} printed parts posed`
    + (missingPose.length ? ` (${missingPose.join(', ')} left out: alternative part)` : ''));
  const stepKeys = new Set(STEPS[id].map((s) => s.key));
  const badSteps = table.filter((p) => !stepKeys.has(p.step));
  if (badSteps.length) fail(`unknown step on ${badSteps.map((p) => `${p.id}:${p.step}`).join(', ')}`);
  const emptySteps = STEPS[id].filter((s) => !table.some((p) => p.step === s.key) && s.key !== 'device');
  if (emptySteps.length) fail(`steps with no parts: ${emptySteps.map((s) => s.key).join(', ')}`);
  const mirrored = table.filter((p) => !isRightHanded(p));
  if (mirrored.length) fail(`basis is not a rotation (mirrored or skewed): ${mirrored.map((p) => p.id).join(', ')}`);
  else ok('every basis is a proper rotation');

  // 2. meshes ----------------------------------------------------------------
  let meshProblems = 0;
  for (const p of table) {
    const part = source.parts.get(p.id);
    if (!part) continue;
    for (const shell of part.shells) {
      const r = meshReport(shell);
      if (r.open || r.nonManifold || r.degenerate) {
        meshProblems++;
        warn(`${p.id} ${shell.name}: ${r.open} open edges, ${r.nonManifold} non-manifold, `
          + `${r.degenerate} degenerate of ${r.triangles} triangles`);
      }
    }
  }
  if (!meshProblems) ok('every shell is closed and manifold');

  // 3. interference ------------------------------------------------------------
  const posedShells = table
    .filter((p) => source.parts.has(p.id))
    .map((p) => ({ part: p, shells: assembledShells(source.parts.get(p.id), p) }));
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const { shells } of posedShells) {
    for (const s of shells) {
      for (let i = 0; i < s.vertices.length; i += 3) {
        for (let a = 0; a < 3; a++) {
          min[a] = Math.min(min[a], s.vertices[i + a]);
          max[a] = Math.max(max[a], s.vertices[i + a]);
        }
      }
    }
  }
  const grid = new Grid(min, max);
  const labelOf = new Map();
  posedShells.forEach(({ part, shells }, i) => {
    const label = i + 1;
    labelOf.set(label, part.id);
    labelNames.set(label, part.id);
    let odd = 0;
    for (const s of shells) odd += grid.fill(s, label);
    if (odd) warn(`${part.id}: ${odd} rays crossed its surface an odd number of times (open mesh)`);
  });
  const voxelMm3 = RES ** 3;
  const clashes = [...grid.overlap]
    .map(([k, n]) => {
      const [a, b] = k.split(':').map(Number);
      const box = grid.where.get(k);
      const at = box
        ? ` at x ${box.min[0].toFixed(1)}..${box.max[0].toFixed(1)}, y ${box.min[1].toFixed(1)}..${box.max[1].toFixed(1)}, z ${box.min[2].toFixed(1)}..${box.max[2].toFixed(1)}`
        : '';
      return { a: labelOf.get(a), b: labelOf.get(b), mm3: n * voxelMm3, at };
    })
    .sort((p, q) => q.mm3 - p.mm3);
  const hard = clashes.filter((c) => c.mm3 >= OVERLAP_ERROR_MM3);
  const soft = clashes.filter((c) => c.mm3 < OVERLAP_ERROR_MM3);
  for (const c of hard) fail(`${c.a} and ${c.b} share ${c.mm3.toFixed(1)} mm³ of solid${c.at}`);
  for (const c of soft) warn(`${c.a} and ${c.b} touch with ${c.mm3.toFixed(2)} mm³ overlap (within tolerance)`);
  if (!hard.length) ok(`no two parts share more than ${OVERLAP_ERROR_MM3} mm³ (voxels ${RES} mm)`);

  // 4. support ----------------------------------------------------------------
  const touch = grid.contacts(Math.round(CONTACT_MM / RES));
  const floating = [...labelOf].filter(([label]) => !touch.get(label)?.size).map(([, pid]) => pid);
  if (floating.length) fail(`touching nothing (floating): ${floating.join(', ')}`);
  else ok(`every part touches another within ${CONTACT_MM} mm`);
  // Connected to the base through a chain of contacts?
  const baseLabel = [...labelOf].find(([, pid]) => pid.endsWith('01'))?.[0];
  const seen = new Set([baseLabel]);
  const queue = [baseLabel];
  while (queue.length) {
    for (const n of touch.get(queue.shift()) ?? []) {
      if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
  }
  const islands = [...labelOf].filter(([label]) => !seen.has(label)).map(([, pid]) => pid);
  if (islands.length) fail(`not connected to the base through other parts: ${islands.join(', ')}`);
  else ok('every part is connected to the base');

  // Assembly order: when a part arrives in the animation, something it
  // rests on must already be there (an earlier step, or its own step).
  const stepIndex = new Map(STEPS[id].map((st, i) => [st.key, i]));
  const order = (pid) => stepIndex.get(table.find((p) => p.id === pid)?.step) ?? 0;
  const early = [...labelOf].filter(([label, pid]) => {
    if (label === baseLabel) return false;
    const mine = order(pid);
    return ![...(touch.get(label) ?? [])].some((n) => order(labelOf.get(n)) <= mine);
  }).map(([, pid]) => `${pid} (${table.find((p) => p.id === pid).step})`);
  if (early.length) fail(`placed before anything it rests on: ${early.join(', ')}`);
  else ok('assembly order: every part lands on something already in place');

  // 5. ground -----------------------------------------------------------------
  const bottom = min[1];
  if (Math.abs(bottom - TABLE_Y) > 0.3) fail(`lowest point y = ${bottom.toFixed(2)} mm, table is at ${TABLE_Y}`);
  else ok(`stands on the table (lowest point ${bottom.toFixed(2)} mm)`);

  return { grid, labelOf, posedShells };
}

// ---------------------------------------------------------------------------
// motion: wind rotor
// ---------------------------------------------------------------------------
function auditRotor(wind) {
  head('-- rotor sweep');
  const hub = new THREE.Vector3(...WIND_PIVOTS.hub);
  const tower = new THREE.Vector3(...WIND_PIVOTS.tower);
  const axis0 = new THREE.Vector3(...WIND_PIVOTS.rotorAxis);

  // Blade envelope in the rotor frame: radius from the axis, axial extent.
  let tip = 0;
  let root = Infinity;
  let a0 = Infinity;
  let a1 = -Infinity;
  for (const { part, shells } of wind.posedShells) {
    if (!part.rotor) continue;
    const isBlade = part.id.startsWith('W26');
    for (const s of shells) {
      for (let i = 0; i < s.vertices.length; i += 3) {
        const p = new THREE.Vector3(s.vertices[i], s.vertices[i + 1], s.vertices[i + 2]).sub(hub);
        const along = p.dot(axis0);
        const r = p.clone().addScaledVector(axis0, -along).length();
        tip = Math.max(tip, r);
        if (!isBlade) continue;
        root = Math.min(root, r);
        a0 = Math.min(a0, along);
        a1 = Math.max(a1, along);
      }
    }
  }
  ok(`rotor tip radius ${tip.toFixed(1)} mm (blade roots from ${root.toFixed(1)} mm), blades ${a0.toFixed(1)}..${a1.toFixed(1)} mm along the axis from the hub`);

  // Everything that does not turn with the rotor, sampled by vertex.
  const still = wind.posedShells.filter(({ part }) => !part.rotor);
  const yaw = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0);
  let worst = { gap: Infinity };
  for (let deg = -90; deg <= 90; deg += 5) {
    yaw.setFromAxisAngle(Y, THREE.MathUtils.degToRad(deg));
    const h = hub.clone().sub(tower).applyQuaternion(yaw).add(tower);
    const ax = axis0.clone().applyQuaternion(yaw);
    for (const { part, shells } of still) {
      // The nacelle and tail yaw with the rotor: compare in the yawed frame.
      const turns = part.yaw;
      for (const s of shells) {
        for (let i = 0; i < s.vertices.length; i += 3) {
          let p = new THREE.Vector3(s.vertices[i], s.vertices[i + 1], s.vertices[i + 2]);
          if (turns) p = p.sub(tower).applyQuaternion(yaw).add(tower);
          const d = p.clone().sub(h);
          const along = d.dot(ax);
          if (along < a0 - 0.5 || along > a1 + 0.5) continue;
          const radial = d.addScaledVector(ax, -along).length();
          // Inside the hub radius nothing sweeps; the hub itself is a
          // separate (static-fit) check above.
          if (radial < root) continue;
          const gap = radial - tip;
          if (gap < worst.gap) worst = { gap, part: part.id, deg };
        }
      }
    }
  }
  if (worst.gap < 0) fail(`rotor sweeps through ${worst.part} at yaw ${worst.deg}° (${(-worst.gap).toFixed(1)} mm inside the blade circle)`);
  else if (worst.gap < 3) warn(`rotor clears ${worst.part} by only ${worst.gap.toFixed(1)} mm at yaw ${worst.deg}°`);
  else ok(`rotor clears everything over yaw -90..90° (closest: ${worst.part}, ${worst.gap.toFixed(1)} mm at ${worst.deg}°)`);
}

// ---------------------------------------------------------------------------
// motion: solar tracker and lamp
// ---------------------------------------------------------------------------
function auditTracker(solar, offset = [0, 0, 0], label = 'in the box') {
  const head0 = trackerHeadPoints();
  const pivot = new THREE.Vector3(...TRACKER.pivot).add(new THREE.Vector3(...offset));
  const hits = new Map();
  for (let pan = -40; pan <= 40; pan += 10) {
    for (let tilt = -TRACKER.tiltMax; tilt <= TRACKER.tiltMax; tilt += 5) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(tilt), THREE.MathUtils.degToRad(pan + PAN_OFFSET), 0, 'YXZ',
      ));
      for (const p of head0) {
        const w = p.clone().applyQuaternion(q).add(pivot);
        const o = solar.grid.ownerAt([w.x, w.y, w.z]);
        if (o) {
          const pid = solar.labelOf.get(o);
          const prev = hits.get(pid);
          if (!prev) hits.set(pid, { pan, tilt, n: 1 });
          else prev.n++;
        }
      }
    }
  }
  if (hits.size) {
    for (const [pid, h] of hits) fail(`tracker head ${label} hits ${pid} (e.g. pan ${h.pan}°, tilt ${h.tilt}°)`);
  } else ok(`tracker head ${label} clears the box over pan ±40°, tilt ±${TRACKER.tiltMax}°`);
}

function auditLamp(solar) {
  const r = 9;
  let clash = null;
  for (let a = 15; a <= 165; a += 1) {
    const c = lampPosition(a);
    for (let u = 0; u < 12 && !clash; u++) {
      for (let v = 0; v <= 6 && !clash; v++) {
        const th = (u / 12) * Math.PI * 2;
        const ph = (v / 6) * Math.PI;
        const p = [c[0] + r * Math.sin(ph) * Math.cos(th), c[1] + r * Math.cos(ph), c[2] + r * Math.sin(ph) * Math.sin(th)];
        const o = solar.grid.ownerAt(p);
        if (o) clash = { pid: solar.labelOf.get(o), a };
      }
    }
    if (clash) break;
  }
  if (clash) fail(`lamp (r ${r} mm) runs into ${clash.pid} at ${clash.a}° along its path`);
  else ok(`lamp clears the dome along its whole path (radius ${LAMP.radius} mm)`);
}

/** A device lifted out: does it stand on the table, clear of its box? */
function auditWindOut(wind) {
  const out = new THREE.Vector3(...OUT_OFFSETS.wind);
  let lowest = Infinity;
  const hits = new Map();
  for (const { part, shells } of wind.posedShells) {
    if (!(part.device || part.rotor || part.yaw)) continue;
    for (const s of shells) {
      for (let i = 0; i < s.vertices.length; i += 3) {
        const p = [s.vertices[i] + out.x, s.vertices[i + 1] + out.y, s.vertices[i + 2] + out.z];
        lowest = Math.min(lowest, p[1]);
        const o = wind.grid.ownerAt(p);
        if (o) {
          const pid = wind.labelOf.get(o);
          const target = wind.posedShells.find((x) => x.part.id === pid)?.part;
          if (target && !(target.device || target.rotor || target.yaw)) hits.set(pid, part.id);
        }
      }
    }
  }
  if (Math.abs(lowest - TABLE_Y) > 0.5) fail(`turbine taken out: lowest point ${lowest.toFixed(1)} mm, table at ${TABLE_Y}`);
  else ok(`turbine taken out stands on the table (${lowest.toFixed(2)} mm)`);
  if (hits.size) for (const [pid, by] of hits) fail(`turbine taken out overlaps the box (${by} in ${pid})`);
  else ok('turbine taken out is clear of the box');
}

// ---------------------------------------------------------------------------
// --fit: search for the nearest clash-free position of one part
// ---------------------------------------------------------------------------
/**
 * `--fit W22 --axes x --range 20` voxelises the box without W22, then
 * slides W22's solid voxels over a grid of offsets (box frame, 0.5 mm) and
 * prints the smallest offsets at which it shares no solid with anything
 * and still touches something. A tool for correcting a pose, not a check.
 */
function fitPart(id, table, source, axes, range) {
  const others = table.filter((p) => p.id !== id && source.parts.has(p.id));
  const self = table.find((p) => p.id === id);
  const all = others.map((p) => ({ part: p, shells: assembledShells(source.parts.get(p.id), p) }));
  const mine = assembledShells(source.parts.get(id), self);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const { shells } of [...all, { shells: mine }]) {
    for (const s of shells) {
      for (let i = 0; i < s.vertices.length; i += 3) {
        for (let a = 0; a < 3; a++) {
          min[a] = Math.min(min[a], s.vertices[i + a] - range);
          max[a] = Math.max(max[a], s.vertices[i + a] + range);
        }
      }
    }
  }
  const grid = new Grid(min, max);
  const names = new Map();
  all.forEach(({ part, shells }, i) => {
    names.set(i + 1, part.id);
    for (const s of shells) grid.fill(s, i + 1);
  });
  // The part's own solid, as voxel centres.
  const own = new Grid(min, max);
  for (const s of mine) own.fill(s, 1);
  const pts = [];
  const [nx, ny, nz] = own.n;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    if (own.owner[own.index(i, j, k)]) pts.push([i, j, k]);
  }
  const steps = Math.round(range / RES);
  const span = (ax) => (axes.includes(ax) ? Array.from({ length: 2 * steps + 1 }, (_, i) => i - steps) : [0]);
  const results = [];
  for (const di of span('x')) for (const dj of span('y')) for (const dk of span('z')) {
    let hits = 0;
    let touch = 0;
    for (const [i, j, k] of pts) {
      const ii = i + di; const jj = j + dj; const kk = k + dk;
      const o = grid.owner[grid.index(ii, jj, kk)];
      if (o) { hits++; if (hits > 0) break; }
      if (!touch) {
        for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          if (grid.owner[grid.index(ii + 2 * a, jj + 2 * b, kk + 2 * c)]) { touch = 1; break; }
        }
      }
    }
    if (!hits && touch) results.push({ d: [di * RES, dj * RES, dk * RES], dist: Math.hypot(di, dj, dk) * RES });
  }
  results.sort((p, q) => p.dist - q.dist);
  console.log(`fit ${id}: ${results.length} clash-free touching offsets within ±${range} mm on ${axes}`);
  for (const r of results.slice(0, 8)) console.log(`   offset ${r.d.map((c) => c.toFixed(1)).join(', ')}  (${r.dist.toFixed(2)} mm)`);
}

// ---------------------------------------------------------------------------
console.log('Loading models-source/stem_boxes_X1E.3mf …');
const source = loadStemParts();
console.log(`${source.parts.size} printed parts`);

const fitArg = process.argv.indexOf('--fit');
if (fitArg > 0) {
  const id = process.argv[fitArg + 1];
  const axes = process.argv[process.argv.indexOf('--axes') + 1] ?? 'xyz';
  const range = Number(process.argv[process.argv.indexOf('--range') + 1] ?? 10);
  fitPart(id, id.startsWith('S') ? SOLAR_PARTS : WIND_PARTS, source, axes, range);
  process.exit(0);
}

const solar = auditBox('solar', SOLAR_PARTS, source);
head('-- tracker and lamp');
auditTracker(solar);
auditTracker(solar, OUT_OFFSETS.solar, 'taken out');
const deckTop = SOLAR_DECK.centre[1] + OUT_OFFSETS.solar[1];
if (Math.abs(deckTop - TABLE_Y) > 0.3) fail(`tracker taken out: base at ${deckTop} mm, table at ${TABLE_Y}`);
else ok(`tracker taken out stands on the table (${deckTop} mm)`);
auditLamp(solar);

const wind = auditBox('wind', WIND_PARTS, source);
auditRotor(wind);
head('-- device out');
auditWindOut(wind);

if (DUMP) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(process.env.DUMP_OUT ?? 'stem-overlap.json', JSON.stringify(dumped));
  console.log(`dumped ${dumped.length} shared voxels`);
}
console.log(`\n${errors ? `${errors} check(s) FAILED` : 'All checks passed.'}${warnings ? ` ${warnings} warning(s).` : ''}`);
process.exit(errors ? 1 : 0);
