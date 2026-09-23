/**
 * Builds the three solar panel models from the array spec.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS AND NOT segment-solar.mjs
 * ---------------------------------------------------------------------------
 * segment-solar.mjs cuts assemblies out of the 65 MB manufacturer catalogue,
 * which is not in the repository. By the time the three panels shipped, the
 * only catalogue geometry any of them still used was the fixed panel's
 * ground frame: the glass was already generated, the tracker's pole was
 * generated, and the manual rack is drawn at runtime.
 *
 * So that one frame is kept as a small source asset,
 * models-source/solar-fixed-frame.glb, and everything else is built here
 * from `ARRAY` in solarSpecs.js. The glass on screen and the aperture the
 * physics integrates are therefore the same numbers, and changing the
 * module count is a one-line edit followed by `npm run models:solar`.
 *
 * ---------------------------------------------------------------------------
 * OUTPUT HIERARCHY (what SolarArray.jsx drives)
 * ---------------------------------------------------------------------------
 *   SolarPanelRoot                  azimuth, about Y
 *     SolarPanelBase                never tilts
 *     SolarPanelTrackingAssembly    tilt, about X; origin ON the tilt axis
 *       SolarPanelYoke              (tracker only) torque tube, brackets, rails
 *       SolarPanelBacking / Frame / Surface / Grid   the modules
 *
 * Run: node scripts/build-solar.mjs      (or npm run models:solar)
 */
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

import { ARRAY } from '../src/physics/solar/solarSpecs.js';

const FIXED_FRAME = 'models-source/solar-fixed-frame.glb';

// ---------------------------------------------------------------------------
// small vector helpers
// ---------------------------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalise = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/**
 * One flat-shaded triangle, wound so its normal points along `outward`.
 *
 * Every solid below is convex, so "away from its own centre" is the right
 * outward direction for each face, and nobody has to get a vertex order
 * right by hand.
 */
function tri(out, a, b, c, outward) {
  let n = normalise(cross(sub(b, a), sub(c, a)));
  if (dot(n, outward) < 0) {
    [b, c] = [c, b];
    n = [-n[0], -n[1], -n[2]];
  }
  out.push({ p: [a, b, c], n: [n, n, n] });
}

/** Axis-aligned box. */
function box(out, [x0, y0, z0], [x1, y1, z1]) {
  const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const v = (x, y, z) => [x, y, z];
  const faces = [
    [v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1)],
    [v(x0, y0, z0), v(x0, y1, z0), v(x0, y1, z1), v(x0, y0, z1)],
    [v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1)],
    [v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)],
    [v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)],
    [v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0)],
  ];
  for (const [a, b, d, e] of faces) {
    const fc = [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2, (a[2] + d[2]) / 2];
    const outward = sub(fc, c);
    tri(out, a, b, d, outward);
    tri(out, a, d, e, outward);
  }
}

/**
 * A frustum of revolution. `axis` 'y' stands it up; 'x' lays it along the
 * tilt axis, which is how the torque tube is drawn. Round on purpose: a
 * round tube looks the same at every tilt and every azimuth, so nothing
 * that is meant to be still appears to spin.
 */
function revolve(out, {
  a0, a1, r0, r1, axis = 'y', centre = [0, 0, 0], capStart = false, capEnd = false, segments = 40,
}) {
  const at = (along, angle, r) => {
    const u = Math.cos(angle) * r;
    const w = Math.sin(angle) * r;
    return add(centre, axis === 'y' ? [u, along, w] : [along, u, w]);
  };
  const radial = (angle) => (axis === 'y'
    ? [Math.cos(angle), 0, Math.sin(angle)]
    : [0, Math.cos(angle), Math.sin(angle)]);
  const axisDir = axis === 'y' ? [0, 1, 0] : [1, 0, 0];
  const minus = axisDir.map((c) => -c);
  const step = (Math.PI * 2) / segments;
  for (let i = 0; i < segments; i++) {
    const g0 = i * step;
    const g1 = (i + 1) * step;
    const out0 = radial((g0 + g1) / 2);
    tri(out, at(a0, g0, r0), at(a0, g1, r0), at(a1, g1, r1), out0);
    tri(out, at(a0, g0, r0), at(a1, g1, r1), at(a1, g0, r1), out0);
    if (capStart) tri(out, at(a0, 0, 0), at(a0, g0, r0), at(a0, g1, r0), minus);
    if (capEnd) tri(out, at(a1, 0, 0), at(a1, g0, r1), at(a1, g1, r1), axisDir);
  }
}

// ---------------------------------------------------------------------------
// the modules
// ---------------------------------------------------------------------------

/**
 * Layers of the module sandwich, metres above the module plane. Thin on
 * purpose: from the side the array should read as a sheet, not a slab.
 */
const LAYER = { backing: -0.009, frame: 0.004, cells: 0.014, grid: 0.020 };

/** Aluminium rim width, cell gap (the light lines between cells). */
const RIM = 0.03;
const CELL_GAP = 0.012;

/**
 * The glass: ARRAY.columns x ARRAY.rows portrait modules, each a 6 x 10
 * grid of cells inside an aluminium rim.
 *
 * @param {number} zStart  the array's -Z edge, in the tracking frame
 * @param {number} plane   height of the module plane above the tilt axis
 */
function buildGlass(zStart, plane) {
  const { columns, rows, moduleWidthM: mw, moduleDepthM: md, moduleGapM: gap } = ARRAY;
  const W = ARRAY.widthM;
  const D = ARRAY.depthM;
  const x0 = -W / 2;
  const up = [0, 1, 0];

  const rect = (out, xa, za, xb, zb, y) => {
    const Y = plane + y;
    tri(out, [xa, Y, za], [xb, Y, za], [xb, Y, zb], up);
    tri(out, [xa, Y, za], [xb, Y, zb], [xa, Y, zb], up);
  };

  const cells = [];
  const frames = [];
  const lines = [];
  const backing = [];
  rect(backing, x0, zStart, x0 + W, zStart + D, LAYER.backing);

  const innerW = mw - RIM * 2;
  const innerD = md - RIM * 2;
  const cw = (innerW - CELL_GAP * (ARRAY.cellsAcross - 1)) / ARRAY.cellsAcross;
  const cd = (innerD - CELL_GAP * (ARRAY.cellsAlong - 1)) / ARRAY.cellsAlong;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const mx = x0 + c * (mw + gap);
      const mz = zStart + r * (md + gap);
      const ix = mx + RIM;
      const iz = mz + RIM;
      const ixR = ix + innerW;
      const izR = iz + innerD;

      // Rim only. A solid plate would show through the cell gaps and hide
      // the light grid.
      rect(frames, mx, mz, mx + mw, iz, LAYER.frame);
      rect(frames, mx, izR, mx + mw, mz + md, LAYER.frame);
      rect(frames, mx, iz, ix, izR, LAYER.frame);
      rect(frames, ixR, iz, mx + mw, izR, LAYER.frame);

      for (let i = 0; i < ARRAY.cellsAlong; i++) {
        for (let j = 0; j < ARRAY.cellsAcross; j++) {
          const cx = ix + j * (cw + CELL_GAP);
          const cz = iz + i * (cd + CELL_GAP);
          rect(cells, cx, cz, cx + cw, cz + cd, LAYER.cells);
        }
      }
      // Horizontal strips span the module; vertical strips stop at each
      // cell so the two sets never overlap and z-fight.
      for (let i = 0; i < ARRAY.cellsAlong - 1; i++) {
        const gz = iz + (i + 1) * cd + i * CELL_GAP;
        rect(lines, ix, gz, ixR, gz + CELL_GAP, LAYER.grid);
      }
      for (let j = 0; j < ARRAY.cellsAcross - 1; j++) {
        const gx = ix + (j + 1) * cw + j * CELL_GAP;
        for (let i = 0; i < ARRAY.cellsAlong; i++) {
          const cz = iz + i * (cd + CELL_GAP);
          rect(lines, gx, cz, gx + CELL_GAP, cz + cd, LAYER.grid);
        }
      }
    }
  }
  return { cells, frames, lines, backing };
}

// ---------------------------------------------------------------------------
// the tracker's pole
// ---------------------------------------------------------------------------

/**
 * A two-axis pole tracker, built the way real ones are:
 *
 *   footing -> tapered column -> azimuth slew ring -> head
 *   head carries a horizontal torque tube (the elevation axis)
 *   brackets on the tube -> rafters running down the slope
 *   -> rails across the slope -> modules clamped on the rails
 *
 * THE MODULES SIT IN FRONT OF THE TILT AXIS, not on it. The previous model
 * put the glass exactly on the axis, so the head's cheek plates and the
 * torque tube passed straight through the laminate and stood proud of the
 * sunny face. Here the steel stack under the glass (bracket, rafter, rail)
 * is `standoff` deep, and the rafters' back face stays further from the
 * axis than the slew ring's radius -- so even at 90 degrees, when the lower
 * half of the array hangs down past the column, nothing intersects.
 *
 * Everything below the head is a surface of revolution: the runtime turns
 * the whole model in azimuth, and a round column and round footing look
 * planted while it does.
 */
const MAST = {
  padRadius: 0.80,
  padSkirt: 0.18,
  padHeight: 0.26,
  padTopRadius: 0.66,
  flangeRadius: 0.36,
  flangeHeight: 0.07,
  columnBottomRadius: 0.20,
  columnTopRadius: 0.15,
  collarRadius: 0.28,     // azimuth slew ring
  collarHeight: 0.22,
  neckRadius: 0.13,
  neckLength: 0.30,
  headHalfWidth: 0.24,    // elevation gearbox, straddles the torque tube
  headHalfDepth: 0.16,
  headDrop: 0.21,
  headRise: 0.14,
  torqueTubeRadius: 0.075,
  bracketWidth: 0.08,
  bracketDepth: 0.16,
  rafterWidth: 0.07,
  rafterHeight: 0.08,
  railWidth: 0.05,
  railHeight: 0.05,

  /** Module plane above the tilt axis. See the clearance check below. */
  standoff: 0.48,
  /** Under the array's lower edge at a full 90-degree tilt. */
  groundClearance: 0.45,
  minPivotHeight: 2.05,
};

function buildMast() {
  const W = ARRAY.widthM;
  const D = ARRAY.depthM;

  // The array swings about its own centre, so at 90 degrees its lower edge
  // hangs half a depth below the pivot.
  const pivotY = Math.max(MAST.minPivotHeight, D / 2 + MAST.groundClearance);

  const headBottom = pivotY - MAST.headDrop;
  const collarTop = headBottom - MAST.neckLength;
  const columnTop = collarTop - MAST.collarHeight;
  const flangeTop = MAST.padHeight + MAST.flangeHeight;

  const footing = [];
  revolve(footing, { a0: 0, a1: MAST.padSkirt, r0: MAST.padRadius, r1: MAST.padRadius, capStart: true });
  revolve(footing, {
    a0: MAST.padSkirt, a1: MAST.padHeight, r0: MAST.padRadius, r1: MAST.padTopRadius, capEnd: true,
  });

  const column = [];
  revolve(column, {
    a0: MAST.padHeight, a1: flangeTop, r0: MAST.flangeRadius, r1: MAST.flangeRadius, capEnd: true,
  });
  revolve(column, {
    a0: flangeTop, a1: columnTop, r0: MAST.columnBottomRadius, r1: MAST.columnTopRadius,
  });
  revolve(column, {
    a0: columnTop, a1: collarTop, r0: MAST.collarRadius, r1: MAST.collarRadius, capStart: true, capEnd: true,
  });
  revolve(column, {
    a0: collarTop, a1: headBottom + 0.02, r0: MAST.neckRadius, r1: MAST.neckRadius,
  });
  // Elevation gearbox. Turns in azimuth with the head, never tilts.
  box(column,
    [-MAST.headHalfWidth, headBottom, -MAST.headHalfDepth],
    [MAST.headHalfWidth, pivotY + MAST.headRise, MAST.headHalfDepth]);
  // Bearing bosses either side, round about the tilt axis.
  for (const sign of [-1, 1]) {
    const a = sign * MAST.headHalfWidth;
    const b = sign * (MAST.headHalfWidth + 0.06);
    revolve(column, {
      axis: 'x', centre: [0, pivotY, 0], a0: Math.min(a, b), a1: Math.max(a, b),
      r0: 0.115, r1: 0.115, capStart: true, capEnd: true,
    });
  }

  // --- what tilts: expressed relative to the pivot ------------------------
  const yoke = [];
  const tubeHalf = W / 2 - 0.35;
  revolve(yoke, {
    axis: 'x', a0: -tubeHalf, a1: tubeHalf,
    r0: MAST.torqueTubeRadius, r1: MAST.torqueTubeRadius, capStart: true, capEnd: true,
  });

  const railTop = MAST.standoff + LAYER.backing - 0.003;
  const railBottom = railTop - MAST.railHeight;
  const rafterTop = railBottom;
  const rafterBottom = rafterTop - MAST.rafterHeight;

  // Four rafters down the slope, each sitting on its own bracket.
  const rafterXs = [-0.37, -0.13, 0.13, 0.37].map((f) => f * W);
  const rafterHalf = D / 2 - 0.12;
  for (const x of rafterXs) {
    const hw = MAST.rafterWidth / 2;
    box(yoke, [x - hw, rafterBottom, -rafterHalf], [x + hw, rafterTop, rafterHalf]);
    const bw = MAST.bracketWidth / 2;
    const bd = MAST.bracketDepth / 2;
    box(yoke, [x - bw, 0, -bd], [x + bw, rafterBottom, bd]);
  }

  // Two rails per module row, at the quarter points where modules are clamped.
  const railHalf = W / 2 - 0.06;
  const zStart = -D / 2;
  for (let r = 0; r < ARRAY.rows; r++) {
    const centre = zStart + r * (ARRAY.moduleDepthM + ARRAY.moduleGapM) + ARRAY.moduleDepthM / 2;
    for (const s of [-1, 1]) {
      const z = centre + s * ARRAY.moduleDepthM * 0.28;
      box(yoke, [-railHalf, railBottom, z - MAST.railWidth / 2], [railHalf, railTop, z + MAST.railWidth / 2]);
    }
  }

  // The collision check that the old model silently failed. At 90 degrees
  // the rafters' back face is `rafterBottom` in front of the axis; the
  // widest thing on the column below it is the slew ring, and the head
  // above it is inside the rafters' reach only in XZ.
  const headCorner = Math.hypot(MAST.headHalfDepth, Math.max(MAST.headDrop, MAST.headRise));
  if (!(rafterBottom > MAST.collarRadius + 0.03 && rafterBottom > headCorner + 0.03)) {
    throw new Error(`tracker steel would pass through the column: rafters ${rafterBottom.toFixed(3)} m off axis`);
  }
  if (!(rafterXs.every((x) => Math.abs(x) - MAST.bracketWidth / 2 > MAST.headHalfWidth + 0.1))) {
    throw new Error('a bracket sits inside the gearbox');
  }

  return { pivotY, footing, column, yoke };
}

// ---------------------------------------------------------------------------
// the fixed panel's catalogue frame
// ---------------------------------------------------------------------------

/**
 * The fixed panel's ground frame, straight from the catalogue.
 *
 * It was built for a four-module-wide table. The array is now twice that,
 * so two of these tables stand side by side -- which is how a longer fixed
 * row is actually installed: identical tables bolted end to end, not one
 * frame stretched.
 */
async function loadFixedFrame(io) {
  const doc = await io.read(FIXED_FRAME);
  const node = doc.getRoot().listNodes().find((n) => n.getName() === 'SolarPanelBase');
  const pivot = node.getExtras().pivot;
  const triangles = [];
  let minX = Infinity;
  let maxX = -Infinity;
  for (const prim of node.getMesh().listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const nor = prim.getAttribute('NORMAL');
    const idx = prim.getIndices();
    const count = idx ? idx.getCount() : pos.getCount();
    for (let i = 0; i < count; i += 3) {
      const p = [];
      const n = [];
      for (let k = 0; k < 3; k++) {
        const vi = idx ? idx.getScalar(i + k) : i + k;
        const v = pos.getElement(vi, []);
        p.push(v);
        n.push(nor ? nor.getElement(vi, []) : [0, 1, 0]);
        minX = Math.min(minX, v[0]);
        maxX = Math.max(maxX, v[0]);
      }
      triangles.push({ p, n });
    }
  }
  const tableWidth = maxX - minX;
  const copies = Math.max(1, Math.round(ARRAY.widthM / tableWidth));
  const out = [];
  for (let c = 0; c < copies; c++) {
    const dx = (c - (copies - 1) / 2) * tableWidth - (minX + maxX) / 2;
    for (const t of triangles) out.push({ p: t.p.map((q) => [q[0] + dx, q[1], q[2]]), n: t.n });
  }
  return { pivot, triangles: out, copies };
}

// ---------------------------------------------------------------------------
// writing
// ---------------------------------------------------------------------------

const MATERIALS = {
  SolarPanelSurface: { name: 'PV_Laminate', color: [0.07, 0.16, 0.40, 1], metallic: 0.08, roughness: 0.34 },
  SolarPanelGrid: { name: 'PV_Grid', color: [0.90, 0.92, 0.94, 1], metallic: 0.04, roughness: 0.55 },
  SolarPanelFrame: { name: 'Aluminium_Rail', color: [0.70, 0.72, 0.745, 1], metallic: 0.9, roughness: 0.34 },
  SolarPanelBacking: { name: 'PV_Backsheet', color: [0.012, 0.016, 0.028, 1], metallic: 0, roughness: 0.85 },
  SolarPanelBase: { name: 'Galvanised_Post', color: [0.55, 0.575, 0.60, 1], metallic: 0.82, roughness: 0.46 },
  SolarPanelFooting: { name: 'Cast_Concrete', color: [0.615, 0.605, 0.585, 1], metallic: 0, roughness: 0.93 },
  SolarPanelYoke: { name: 'Painted_Steel', color: [0.46, 0.485, 0.515, 1], metallic: 0.78, roughness: 0.42 },
};

function writer(doc) {
  const buffer = doc.createBuffer();
  const materials = new Map();
  const material = (name) => {
    if (!materials.has(name)) {
      const m = MATERIALS[name];
      materials.set(name, doc.createMaterial(m.name)
        .setBaseColorFactor(m.color).setMetallicFactor(m.metallic).setRoughnessFactor(m.roughness));
    }
    return materials.get(name);
  };
  return (name, triangles, translation = [0, 0, 0]) => {
    const node = doc.createNode(name).setTranslation(translation);
    if (!triangles?.length) return node;
    const pos = new Float32Array(triangles.length * 9);
    const nor = new Float32Array(triangles.length * 9);
    triangles.forEach((t, i) => {
      for (let k = 0; k < 3; k++) {
        pos.set(t.p[k], i * 9 + k * 3);
        nor.set(t.n[k], i * 9 + k * 3);
      }
    });
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nor).setBuffer(buffer))
      .setMaterial(material(name));
    node.setMesh(doc.createMesh(name).addPrimitive(prim));
    return node;
  };
}

function bounds(node, parent = [0, 0, 0], acc = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }) {
  const t = add(parent, node.getTranslation());
  const mesh = node.getMesh();
  if (mesh) {
    for (const prim of mesh.listPrimitives()) {
      const a = prim.getAttribute('POSITION');
      const mn = a.getMin([]);
      const mx = a.getMax([]);
      for (let k = 0; k < 3; k++) {
        acc.min[k] = Math.min(acc.min[k], mn[k] + t[k]);
        acc.max[k] = Math.max(acc.max[k], mx[k] + t[k]);
      }
    }
  }
  for (const c of node.listChildren()) bounds(c, t, acc);
  return acc;
}

async function build(kind, io) {
  const doc = new Document();
  const scene = doc.createScene('SolarPanel');
  doc.getRoot().setDefaultScene(scene);
  const node = writer(doc);
  const root = doc.createNode('SolarPanelRoot');
  scene.addChild(root);

  let trackerAt;
  let zStart;
  let plane = 0;
  let yoke = null;
  let extra = {};

  if (kind === 'auto') {
    const mast = buildMast();
    const base = node('SolarPanelBase', mast.column);
    base.addChild(node('SolarPanelFooting', mast.footing));
    root.addChild(base);
    trackerAt = [0, mast.pivotY, 0];
    zStart = -ARRAY.depthM / 2;
    plane = MAST.standoff;
    yoke = mast.yoke;
    extra = { pivotHeightM: +mast.pivotY.toFixed(2) };
  } else if (kind === 'manual') {
    // Hinged along its front (+Z) edge; the rack is drawn at runtime.
    trackerAt = [0, 0.3, 0];
    zStart = -ARRAY.depthM;
  } else {
    const frame = await loadFixedFrame(io);
    root.addChild(node('SolarPanelBase', frame.triangles));
    trackerAt = frame.pivot;
    // The catalogue array sat 7 cm south of its pivot; keep it there so
    // it still lands on the frame's rails.
    zStart = -0.068 - ARRAY.depthM / 2;
    extra = { tables: frame.copies };
  }

  const tracker = node('SolarPanelTrackingAssembly', null, trackerAt);
  root.addChild(tracker);
  if (yoke) tracker.addChild(node('SolarPanelYoke', yoke));
  const glass = buildGlass(zStart, plane);
  tracker.addChild(node('SolarPanelBacking', glass.backing));
  tracker.addChild(node('SolarPanelFrame', glass.frames));
  tracker.addChild(node('SolarPanelSurface', glass.cells));
  tracker.addChild(node('SolarPanelGrid', glass.lines));

  const flat = bounds(root);
  await doc.transform(draco({ method: 'edgebreaker', quantizePositionBits: 14, quantizeNormalBits: 10 }));
  const path = `public/models/solar-${kind}.glb`;
  await io.write(path, doc);
  return {
    path,
    ...extra,
    standingHeightAtZeroTiltM: +flat.max[1].toFixed(2),
  };
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

console.log(
  `array: ${ARRAY.columns} x ${ARRAY.rows} = ${ARRAY.moduleCount} modules, `
  + `${ARRAY.widthM} x ${ARRAY.depthM} m, aperture ${ARRAY.apertureArea} m^2`,
);
for (const kind of ['auto', 'manual', 'fixed']) {
  console.log(JSON.stringify(await build(kind, io)));
}
