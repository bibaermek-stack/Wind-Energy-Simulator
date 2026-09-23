/**
 * Segments the supplied solar model into its individual assemblies.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * `solar pahels.glb` is a SketchUp -> Collada -> Sketchfab export of a
 * manufacturer's catalogue: roughly eighteen different mounting products
 * laid out on one site, 28.8 m x 16.1 m, 1.37M triangles.
 *
 * It has no usable hierarchy. All 81 meshes are unnamed siblings
 * (`Material2` / `Material3`), and -- the part that matters -- the exporter
 * batched geometry BY MATERIAL rather than by object. A single mesh
 * therefore holds triangles belonging to several different products: the
 * largest one (57,339 triangles of `0107_MidnightBlue`) has islands at
 * three separate sites on the plot.
 *
 * So the Base / TrackingAssembly / Surface split the simulation needs cannot
 * be recovered by re-parenting nodes, the way the HAWT's rotor could be.
 * It has to be rebuilt from the triangles up, which is what this does:
 *
 *   1. bake every triangle into world space (node transforms applied)
 *   2. cluster triangles into assemblies by spatial locality in XZ
 *   3. within an assembly, split panel surfaces from support structure
 *      by material, and find the tilt axis from the panel geometry
 *
 * Run with no arguments to list the assemblies found:
 *     node scripts/segment-solar.mjs
 *
 * Run with an index to extract one to public/models/solar.glb:
 *     node scripts/segment-solar.mjs --extract 1
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const SOURCE = process.env.SOLAR_SOURCE ?? 'models-source/solar_catalogue_original.glb';

/** Inches to metres. The model is authored in inches (SketchUp US template). */
export const INCH = 0.0254;

/**
 * Materials that are photovoltaic surface rather than structure.
 * `0107_MidnightBlue` and `0109_DarkSlateBlue` are SketchUp colour names for
 * the dark cell laminate; `2420x1200` is a module size in millimetres.
 */
const PANEL_MATERIALS = /MidnightBlue|DarkSlateBlue|2420x1200|Navy|DodgerBlue/i;

/**
 * Scale-figure people and interior props that came along with the SketchUp
 * scene. They are not part of any solar assembly.
 */
const PROP_MATERIALS = /^(Heather|Lily)_|Formica|Polished_Concrete|ForestGreen/i;

/** Grid cell for spatial clustering, in inches. 30in = 0.76 m. */
const CELL = 30;

/**
 * Triangles wider than this in the ground plane are excluded from
 * clustering, in inches. 120in = 3 m.
 *
 * SketchUp exports site planes, shadow catchers and stray construction
 * geometry that stretch across the whole plot. There are only a couple of
 * genuinely plot-spanning triangles, but roughly 1,700 span 2.5-10 m, and
 * every one of them bridges two products into a single cluster -- which is
 * why an unfiltered pass returns one assembly instead of eighteen. No real
 * bracket, rail or module face is 3 m across in a single triangle, so this
 * removes the bridges without touching any product geometry.
 */
const MAX_SPAN = 120;

/**
 * Half-thickness of the slab, in inches, that counts as "part of the module
 * sandwich" and therefore rotates with it. 14in = 0.36 m -- enough to catch
 * mounting rails, clamps and a torque tube directly under the laminate,
 * while leaving posts and braces behind.
 */
const FRAME_SLAB = 14;

/** SketchUp exports its display edges as near-degenerate triangles. */
const EDGE_MATERIAL = /^edge_color/i;

// ---------------------------------------------------------------------------
// matrix helpers
// ---------------------------------------------------------------------------
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function localMatrix(node) {
  const t = node.getTranslation();
  const q = node.getRotation();
  const s = node.getScale();
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

function multiply(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

/** Normal matrix for a rigid-ish transform: good enough without shear. */
function transformDirection(m, v) {
  const out = [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2],
  ];
  const len = Math.hypot(...out) || 1;
  return out.map((c) => c / len);
}

// ---------------------------------------------------------------------------
// load and bake every triangle into world space
// ---------------------------------------------------------------------------

/**
 * @returns {Promise<{triangles: Array, document: import('@gltf-transform/core').Document}>}
 *   each triangle: { p: [[x,y,z] x3], n: [[x,y,z] x3], uv, material, isPanel, isProp }
 */
export async function loadTriangles(source = SOURCE) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(source);

  const triangles = [];

  const visit = (node, parentMatrix) => {
    const matrix = multiply(parentMatrix, localMatrix(node));
    const mesh = node.getMesh();

    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const position = prim.getAttribute('POSITION');
        const normal = prim.getAttribute('NORMAL');
        const uv = prim.getAttribute('TEXCOORD_0');
        const indices = prim.getIndices();
        const count = indices ? indices.getCount() : position.getCount();
        const material = prim.getMaterial()?.getName() ?? '';
        const isPanel = PANEL_MATERIALS.test(material);
        const isProp = PROP_MATERIALS.test(material);

        for (let i = 0; i < count; i += 3) {
          const p = [];
          const n = [];
          const t = [];
          for (let k = 0; k < 3; k++) {
            const vi = indices ? indices.getScalar(i + k) : i + k;
            p.push(transformPoint(matrix, position.getElement(vi, [])));
            n.push(normal ? transformDirection(matrix, normal.getElement(vi, [])) : [0, 1, 0]);
            t.push(uv ? uv.getElement(vi, []) : [0, 0]);
          }
          triangles.push({ p, n, uv: t, material, isPanel, isProp });
        }
      }
    }

    for (const child of node.listChildren()) visit(child, matrix);
  };

  for (const scene of document.getRoot().listScenes()) {
    for (const node of scene.listChildren()) visit(node, IDENTITY);
  }

  return { triangles, document };
}

// ---------------------------------------------------------------------------
// cluster triangles into assemblies
// ---------------------------------------------------------------------------

/**
 * Groups triangles into spatially separate assemblies.
 *
 * Works on an occupancy grid in the ground plane: mark the cell each
 * triangle's centroid falls in, connect 8-adjacent occupied cells, and every
 * connected region of cells is one product on the plot. Clustering in XZ
 * rather than 3D is deliberate -- a panel sits directly above its own
 * supports, so they must land in the same assembly.
 */
export function clusterAssemblies(triangles, { cell = CELL, includeProps = false } = {}) {
  const spanXZ = (t) => {
    const xs = [t.p[0][0], t.p[1][0], t.p[2][0]];
    const zs = [t.p[0][2], t.p[1][2], t.p[2][2]];
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  };

  const usable = triangles.filter((t) => (
    (includeProps || !t.isProp)
    && !EDGE_MATERIAL.test(t.material)
    && spanXZ(t) <= MAX_SPAN
  ));

  const cellOf = (t) => {
    const cx = (t.p[0][0] + t.p[1][0] + t.p[2][0]) / 3;
    const cz = (t.p[0][2] + t.p[1][2] + t.p[2][2]) / 3;
    return `${Math.floor(cx / cell)},${Math.floor(cz / cell)}`;
  };

  const occupied = new Map();
  usable.forEach((t, i) => {
    const key = cellOf(t);
    let bucket = occupied.get(key);
    if (!bucket) occupied.set(key, bucket = []);
    bucket.push(i);
  });

  const keys = [...occupied.keys()];
  const indexOf = new Map(keys.map((k, i) => [k, i]));
  const parent = keys.map((_, i) => i);
  const find = (a) => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };

  for (const key of keys) {
    const [x, z] = key.split(',').map(Number);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const neighbour = `${x + dx},${z + dz}`;
        if (indexOf.has(neighbour)) union(indexOf.get(key), indexOf.get(neighbour));
      }
    }
  }

  const byRoot = new Map();
  for (const key of keys) {
    const root = find(indexOf.get(key));
    let group = byRoot.get(root);
    if (!group) byRoot.set(root, group = []);
    group.push(...occupied.get(key));
  }

  return [...byRoot.values()]
    .map((indices) => describeAssembly(indices.map((i) => usable[i])))
    .filter((a) => a.triangles.length > 40)
    .sort((a, b) => b.panelArea - a.panelArea);
}

/** Measures one assembly: bounds, panel area, tilt, and how tracker-like it is. */
function describeAssembly(triangles) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const t of triangles) {
    for (const p of t.p) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], p[k]);
        max[k] = Math.max(max[k], p[k]);
      }
    }
  }

  const panels = triangles.filter((t) => t.isPanel);

  // Panel area and mean normal, area-weighted so big faces dominate the
  // estimate of which way the array is pointing.
  let panelArea = 0;
  const meanNormal = [0, 0, 0];
  const panelMin = [Infinity, Infinity, Infinity];
  const panelMax = [-Infinity, -Infinity, -Infinity];

  for (const t of panels) {
    const [a, b, c] = t.p;
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const area = Math.hypot(...cross) / 2;
    // Only count upward-facing area: a panel has a back as well as a front,
    // and the back must not cancel the front out.
    if (cross[1] < 0) continue;
    panelArea += area;
    for (let k = 0; k < 3; k++) meanNormal[k] += cross[k] / 2;
    for (const p of t.p) {
      for (let k = 0; k < 3; k++) {
        panelMin[k] = Math.min(panelMin[k], p[k]);
        panelMax[k] = Math.max(panelMax[k], p[k]);
      }
    }
  }

  const nLen = Math.hypot(...meanNormal) || 1;
  const normal = meanNormal.map((c) => c / nLen);
  const tiltDeg = Math.acos(Math.min(Math.max(normal[1], -1), 1)) * (180 / Math.PI);

  const size = max.map((v, i) => v - min[i]);
  const footprint = size[0] * size[2];

  // A pole-mounted tracker is tall and narrow: its panel area is large
  // relative to the ground it stands on, and the panel sits well above it.
  const panelHeight = Number.isFinite(panelMin[1]) ? (panelMin[1] + panelMax[1]) / 2 : 0;
  const compactness = footprint > 0 ? panelArea / footprint : 0;
  const elevation = size[1] > 0 ? (panelHeight - min[1]) / size[1] : 0;

  return {
    triangles,
    min,
    max,
    size,
    panelArea,
    panelCount: panels.length,
    normal,
    tiltDeg,
    panelMin,
    panelMax,
    compactness,
    elevation,
    materials: [...new Set(triangles.map((t) => t.material))].filter((m) => !m.startsWith('edge_')),
  };
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

const m = (inches) => (inches * INCH);

async function report() {
  console.log(`reading ${SOURCE} …`);
  const { triangles } = await loadTriangles();
  const props = triangles.filter((t) => t.isProp).length;
  console.log(`${triangles.length.toLocaleString()} triangles (${props.toLocaleString()} are people/furniture, excluded)\n`);

  const assemblies = clusterAssemblies(triangles);
  console.log(`${assemblies.length} assemblies found\n`);
  console.log(
    ' #  tris      panel m²  tilt°  size (m)            pole?  centre XZ (in)',
  );
  assemblies.forEach((a, i) => {
    const pole = a.compactness > 0.55 && a.elevation > 0.35 ? ' yes ' : '  -  ';
    console.log(
      String(i).padStart(2),
      String(a.triangles.length).padStart(8),
      (m(1) * m(1) * a.panelArea).toFixed(1).padStart(9),
      a.tiltDeg.toFixed(0).padStart(6),
      ` ${m(a.size[0]).toFixed(1)} x ${m(a.size[2]).toFixed(1)} x ${m(a.size[1]).toFixed(1)}`.padEnd(21),
      pole,
      `(${((a.min[0] + a.max[0]) / 2).toFixed(0)}, ${((a.min[2] + a.max[2]) / 2).toFixed(0)})`,
    );
  });
}

/**
 * Measures the array's true collecting aperture, in square metres.
 *
 * Summing triangle areas does not work on this model. Each module is a
 * solid, so it has a back face as well as a front; the modules are built
 * in two coincident layers 6 and 9 inches off the array's mid-plane; and
 * there is a large backing panel behind them. Adding up face areas
 * therefore counts the same square metre three or four times, which would
 * inflate every power reading in the simulation by the same factor.
 *
 * So the aperture is measured as COVERAGE instead: project every module
 * triangle onto the array plane, mark the cells it lands in on a fine
 * grid, and count the marked cells once each. Overlapping layers land in
 * the same cells and are counted once, which is the physically meaningful
 * answer -- two stacked laminates collect the light of one.
 */
export function measureAperture(assembly, { cellInches = 2 } = {}) {
  const n = assembly.normal;

  // Orthonormal basis in the array plane.
  const helper = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normalise(cross(helper, n));
  const v = normalise(cross(n, u));

  const origin = [0, 1, 2].map((k) => (assembly.panelMin[k] + assembly.panelMax[k]) / 2);
  const covered = new Set();

  const mark = (p) => {
    const d = [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]];
    const a = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
    const b = d[0] * v[0] + d[1] * v[1] + d[2] * v[2];
    covered.add(`${Math.floor(a / cellInches)},${Math.floor(b / cellInches)}`);
  };

  for (const t of assembly.triangles) {
    if (!t.isPanel || EDGE_MATERIAL.test(t.material)) continue;
    // Only faces lying in the array plane: a module's edge strips point
    // sideways and would smear coverage beyond the real outline.
    const fn = t.n[0];
    if (Math.abs(fn[0] * n[0] + fn[1] * n[1] + fn[2] * n[2]) < Math.cos((30 * Math.PI) / 180)) continue;

    for (const p of t.p) mark(p);
    mark([0, 1, 2].map((k) => (t.p[0][k] + t.p[1][k] + t.p[2][k]) / 3));
  }

  return covered.size * (cellInches * INCH) ** 2;
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalise(v) {
  const len = Math.hypot(...v) || 1;
  return v.map((c) => c / len);
}

/**
 * A sheet just behind the cells, filling the gaps between modules.
 *
 * The catalogue models each module as a separate solid, so the 2x4 array
 * has real slots of grass showing through. From the teaching camera that
 * reads as a transparent panel. One quad in the array plane, 2 inches
 * behind the collecting faces, closes those slots without covering the
 * cell grid.
 */
function panelBackingTriangles(assembly, planeOffset) {
  const n = normalise(assembly.normal);
  const min = assembly.panelMin;
  const max = assembly.panelMax;
  const centre = [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
  const back = centre.map((c, k) => c + n[k] * planeOffset);
  const helper = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = normalise(cross(n, helper));
  const v = normalise(cross(u, n));
  let umin = 1e9;
  let umax = -1e9;
  let vmin = 1e9;
  let vmax = -1e9;
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        const d = [x - back[0], y - back[1], z - back[2]];
        const uu = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
        const vv = d[0] * v[0] + d[1] * v[1] + d[2] * v[2];
        umin = Math.min(umin, uu);
        umax = Math.max(umax, uu);
        vmin = Math.min(vmin, vv);
        vmax = Math.max(vmax, vv);
      }
    }
  }
  const at = (uu, vv) => [
    back[0] + u[0] * uu + v[0] * vv,
    back[1] + u[1] * uu + v[1] * vv,
    back[2] + u[2] * uu + v[2] * vv,
  ];
  const c00 = at(umin, vmin);
  const c10 = at(umax, vmin);
  const c11 = at(umax, vmax);
  const c01 = at(umin, vmax);
  const tri = (p0, p1, p2) => {
    const nn = normalise(cross(
      [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]],
      [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]],
    ));
    const flip = nn[0] * n[0] + nn[1] * n[1] + nn[2] * n[2] < 0;
    const pts = flip ? [p0, p2, p1] : [p0, p1, p2];
    const nf = flip ? nn.map((x) => -x) : nn;
    return {
      p: pts,
      n: [nf, nf, nf],
      uv: [[0, 0], [1, 0], [0, 1]],
      material: 'GeneratedBacking',
      isPanel: true,
      isProp: false,
    };
  };
  return [tri(c00, c10, c11), tri(c00, c11, c01)];
}

/**
 * One triangle per patch of the array: the one closest to the sun.
 * Later, buildNode flattens whatever is left onto a single plane, so the
 * panel is thin from the side and complete from the front.
 */
/**
 * A flat 2×4 module face with a 10×6 cell grid.
 *
 * Coordinates are inches in the flattened pivot frame. `tiltBack` and
 * `pivot` turn them into the world-inch space the rest of the triangles
 * use, so un-tilting puts the glass back where the catalogue array sat.
 */
function generatedGlass(flat, tiltBack, pivot) {
  const x0 = flat.minX;
  const x1 = flat.maxX;
  const z0 = flat.minZ;
  const z1 = flat.maxZ;
  // Eight modules, two rows of four. Each module is portrait: the long
  // side runs in Z, so a 60-cell plate is 6 across and 10 along.
  const cols = 4;
  const rows = 2;
  const cellC = 6;
  const cellR = 10;
  const moduleGap = 2.2;
  const cellGap = 0.62;
  const margin = 1.4;
  const spanX = (x1 - x0) - margin * 2;
  const spanZ = (z1 - z0) - margin * 2;
  const modW = (spanX - moduleGap * (cols - 1)) / cols;
  const modD = (spanZ - moduleGap * (rows - 1)) / rows;
  const yGlass = 0.55;
  const yFrame = 0.15;
  const yLine = 0.78;
  const border = 0.7;
  const cw = (modW - cellGap * (cellC - 1)) / cellC;
  const cd = (modD - cellGap * (cellR - 1)) / cellR;
  if (!(cw > 1 && cd > 1)) {
    throw new Error(`cell size collapsed: ${cw.toFixed(2)} x ${cd.toFixed(2)} in`);
  }

  const nn = tiltBack([0, 1, 0]);
  const toWorld = (x, y, z) => {
    const spun = tiltBack([x, y, z]);
    return [spun[0] + pivot[0], spun[1] + pivot[1], spun[2] + pivot[2]];
  };
  const quad = (p00, p10, p11, p01) => {
    const tri = (p0, p1, p2) => ({
      p: [p0, p1, p2],
      n: [nn, nn, nn],
      uv: [[0, 0], [1, 0], [0, 1]],
      material: 'GeneratedCell',
      isPanel: true,
      isProp: false,
    });
    // p00, p01, p11 is CCW when viewed from +Y, so the face points up.
    return [
      tri(p00, p01, p11),
      tri(p00, p11, p10),
    ];
  };
  const rect = (xA, zA, xB, zB, y) => quad(
    toWorld(xA, y, zA),
    toWorld(xB, y, zA),
    toWorld(xB, y, zB),
    toWorld(xA, y, zB),
  );

  const cells = [];
  const frames = [];
  const lines = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const mx = x0 + margin + c * (modW + moduleGap);
      const mz = z0 + margin + r * (modD + moduleGap);
      const xR = mx + modW;
      const zR = mz + modD;
      // Aluminium rim only. A solid plate here would show through the
      // cell gaps and hide the light grid.
      frames.push(
        ...rect(mx - border, mz - border, xR + border, mz, yFrame),
        ...rect(mx - border, zR, xR + border, zR + border, yFrame),
        ...rect(mx - border, mz, mx, zR, yFrame),
        ...rect(xR, mz, xR + border, zR, yFrame),
      );
      for (let i = 0; i < cellR; i++) {
        for (let j = 0; j < cellC; j++) {
          const cx = mx + j * (cw + cellGap);
          const cz = mz + i * (cd + cellGap);
          cells.push(...rect(cx, cz, cx + cw, cz + cd, yGlass));
        }
      }
      // Light gaps. Horizontal strips span the module, including the
      // crossings; vertical strips stop at each cell so the two sets
      // share an edge and do not z-fight.
      for (let i = 0; i < cellR - 1; i++) {
        const gz = mz + (i + 1) * cd + i * cellGap;
        lines.push(...rect(mx, gz, xR, gz + cellGap, yLine));
      }
      for (let j = 0; j < cellC - 1; j++) {
        const gx = mx + (j + 1) * cw + j * cellGap;
        for (let i = 0; i < cellR; i++) {
          const cz = mz + i * (cd + cellGap);
          lines.push(...rect(gx, cz, gx + cellGap, cz + cd, yLine));
        }
      }
    }
  }

  const yBack = -0.35;
  const backing = rect(x0, z0, x1, z1, yBack);
  console.error(
    `[glass] cell ${(cw * INCH * 100).toFixed(1)}×${(cd * INCH * 100).toFixed(1)} cm, `
    + `gap ${(cellGap * INCH * 100).toFixed(1)} cm, `
    + `tris cells ${cells.length} lines ${lines.length} frame ${frames.length}`,
  );
  return { cells, backing, frames, lines };
}

function selectFrontSkin(tris, assembly) {
  const n = normalise(assembly.normal);
  const centre = [0, 1, 2].map((k) => (assembly.panelMin[k] + assembly.panelMax[k]) / 2);
  const helper = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = normalise(cross(n, helper));
  const v = normalise(cross(u, n));
  const cell = 4;

  const project = (p) => {
    const d = [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]];
    return [
      d[0] * u[0] + d[1] * u[1] + d[2] * u[2],
      d[0] * v[0] + d[1] * v[1] + d[2] * v[2],
    ];
  };
  const inside = (p, a, b, c) => {
    const sign = (p0, p1, p2) => (p0[0] - p2[0]) * (p1[1] - p2[1]) - (p1[0] - p2[0]) * (p0[1] - p2[1]);
    const d1 = sign(p, a, b);
    const d2 = sign(p, b, c);
    const d3 = sign(p, c, a);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  };

  const ranked = tris.map((t) => ({
    t,
    uv: t.p.map(project),
    off: t.planeOffset ?? 0,
  })).sort((a, b) => b.off - a.off);

  const mask = new Set();
  const kept = [];
  for (const item of ranked) {
    const [a, b, c] = item.uv;
    const minU = Math.min(a[0], b[0], c[0]);
    const maxU = Math.max(a[0], b[0], c[0]);
    const minV = Math.min(a[1], b[1], c[1]);
    const maxV = Math.max(a[1], b[1], c[1]);
    let fresh = false;
    const hits = [];
    for (let iu = Math.floor(minU / cell); iu <= Math.floor(maxU / cell); iu++) {
      for (let iv = Math.floor(minV / cell); iv <= Math.floor(maxV / cell); iv++) {
        const p = [(iu + 0.5) * cell, (iv + 0.5) * cell];
        if (!inside(p, a, b, c)) continue;
        const key = `${iu},${iv}`;
        hits.push(key);
        if (!mask.has(key)) fresh = true;
      }
    }
    if (!fresh) continue;
    kept.push(item.t);
    for (const key of hits) mask.add(key);
  }
  return kept;
}

// ---------------------------------------------------------------------------
// generated pole mount
// ---------------------------------------------------------------------------

/**
 * A pedestal for the automatic tracker.
 *
 * The supplied catalogue has no pole-mounted tracker in it. Every one of its
 * nine assemblies is a ground frame: an array sitting on legs, braces or a
 * low rack. Reference photograph 1 shows the other thing entirely -- a
 * single tapered steel column on a round concrete footing, with the array
 * carried high on a pivot head. There is nothing in the catalogue to cut
 * that from.
 *
 * So the MOUNT is generated here and nothing else. The modules, their
 * laminate, their rails and their proportions are still the supplied
 * geometry, lifted off whatever frame the catalogue gave them and set on
 * this column instead. Nothing about the panel itself is redrawn.
 *
 * Everything the generator emits is a surface of revolution about the
 * column's own axis, or is symmetric about it. That is not decoration: the
 * runtime turns the whole model in azimuth (see SolarArray.jsx), so any
 * feature that is not axially symmetric would visibly spin the footing as
 * the tracker follows the sun -- exactly the "do not rotate the ground
 * mount" failure. A round pad and a round column look identical at every
 * azimuth, so the base reads as planted while the array swings above it.
 *
 * Dimensions in metres, converted to the inch space the rest of the
 * pipeline works in so generated and catalogue triangles can share one
 * mesh builder.
 */
const MAST = {
  padRadius: 0.64,
  padSkirt: 0.17,        // vertical part of the footing
  padHeight: 0.25,       // total, including the chamfer on top
  padTopRadius: 0.52,
  flangeRadius: 0.31,
  flangeHeight: 0.07,
  columnBottomRadius: 0.165,
  columnTopRadius: 0.125,
  collarRadius: 0.265,   // azimuth bearing housing
  collarHeight: 0.21,
  neckRadius: 0.105,     // fixed stem from the bearing up to the pivot
  yokeHalfSpan: 0.36,
  yokePlateThickness: 0.11,
  yokeHalfDepth: 0.135,
  torqueTubeDepth: 0.17,

  /**
   * How far the elevation yoke reaches above and below the pivot, m.
   *
   * The cheek plates reach UP to the back of the modules (arrayStandoff)
   * and hang below the torque tube. They must stop short of the laminate
   * or they read as grey blocks on the glass.
   */
  yokeRise: 0.42,
  yokeDrop: 0.33,
  torqueTubeDrop: 0.11,

  /**
   * How far in front of the tilt axis the module plane sits, m.
   *
   * The array is 3.2 m deep and 4.1 m wide. If it is centred on the column,
   * a steep tilt (evening, ~83°) puts the module plane THROUGH the pole --
   * the column appears to punch out of the glass. Offsetting the modules
   * along the face normal keeps that plane in front of the column at every
   * angle the tracker uses. 0.48 m clears the 0.265 m collar with margin.
   */
  arrayStandoff: 0.48,

  /** Clearance under the array's lower edge at full 90-degree tilt, m. */
  groundClearance: 0.45,
  minPivotHeight: 2.05,
  segments: 40,
};

/**
 * The adjustable ground rack.
 *
 * Unlike the pole, none of this rack is generated INTO the model: its
 * hinge posts, feet and telescopic legs are drawn at runtime by
 * SolarArray.jsx, because the legs have to change length as the tilt
 * slider moves and baked geometry cannot. All the segmenter does for a
 * rack is drop the catalogue's own legs and move the tilt axis to the
 * array's front edge, at this height, so that the runtime rack has a hinge
 * to hang off.
 *
 * The number therefore has to agree with `scene.rack.hingeHeight` in
 * solarSpecs.js, and is the one thing the two files share.
 */
const RACK = {
  hingeHeight: 0.3,
};

/**
 * One triangle in the shape the mesh builder expects, from metres.
 *
 * The normal is derived from the winding rather than supplied, so every
 * caller below only has to get its vertex order right and the shading
 * follows.
 */
function generatedTriangle(a, b, c, material) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = normalise(cross(u, v));
  const toInches = (p) => [p[0] / INCH, p[1] / INCH, p[2] / INCH];
  return {
    p: [toInches(a), toInches(b), toInches(c)],
    n: [n, n, n],
    uv: [[0, 0], [1, 0], [0, 1]],
    material,
  };
}

/** A tube or cone of revolution about +Y, optionally capped. */
function revolve(out, {
  y0, y1, r0, r1, material,
  capTop = false, capBottom = false, segments = MAST.segments,
}) {
  const step = (Math.PI * 2) / segments;
  for (let i = 0; i < segments; i++) {
    const a0 = i * step;
    const a1 = (i + 1) * step;
    const p00 = [Math.cos(a0) * r0, y0, Math.sin(a0) * r0];
    const p10 = [Math.cos(a1) * r0, y0, Math.sin(a1) * r0];
    const p01 = [Math.cos(a0) * r1, y1, Math.sin(a0) * r1];
    const p11 = [Math.cos(a1) * r1, y1, Math.sin(a1) * r1];
    out.push(generatedTriangle(p00, p11, p10, material));
    out.push(generatedTriangle(p00, p01, p11, material));
    if (capTop) out.push(generatedTriangle([0, y1, 0], p01, p11, material));
    if (capBottom) out.push(generatedTriangle([0, y0, 0], p10, p00, material));
  }
}

/** An axis-aligned box, wound so every face points outward. */
function slab(out, [x0, y0, z0], [x1, y1, z1], material) {
  const quad = (a, b, c, d) => {
    out.push(generatedTriangle(a, b, c, material));
    out.push(generatedTriangle(a, c, d, material));
  };
  quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]); // +x
  quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]); // -x
  quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); // +z
  quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]); // -z
  quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]); // +y
  quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]); // -y
}

/**
 * Builds the column, and works out how high the pivot has to sit.
 *
 * The height is not a taste decision. The array rotates about its own
 * centre, so at the slider's maximum 90 degrees its lower edge hangs a full
 * half-depth below the pivot. Put the pivot too low and the panel scythes
 * into the ground at steep tilt -- which is what the geometry would
 * actually do, and looks like a bug. Half the array's slope length plus a
 * fixed clearance is the shortest column that never collides.
 *
 * @param {number} arrayDepthM  the array's depth in its own plane (slope length)
 * @param {number} arrayWidthM  the array's width along the tilt axis
 */
function buildMast(arrayDepthM, arrayWidthM) {
  const pivotY = Math.max(
    MAST.minPivotHeight,
    arrayDepthM / 2 + MAST.groundClearance,
  );

  // The fixed neck runs all the way up to the pivot; the yoke's cheek
  // plates straddle it either side, so the two never intersect however far
  // the array tilts.
  const neckTop = pivotY;
  const collarTop = neckTop - 0.42;
  const columnTop = collarTop - MAST.collarHeight;
  const flangeTop = MAST.padHeight + MAST.flangeHeight;

  /** Stays planted: footing, column, azimuth bearing, fixed neck. */
  const footing = [];
  revolve(footing, {
    y0: 0, y1: MAST.padSkirt, r0: MAST.padRadius, r1: MAST.padRadius,
    material: 'GeneratedConcrete', capBottom: true,
  });
  revolve(footing, {
    y0: MAST.padSkirt, y1: MAST.padHeight, r0: MAST.padRadius, r1: MAST.padTopRadius,
    material: 'GeneratedConcrete', capTop: true,
  });

  const column = [];
  revolve(column, {
    y0: MAST.padHeight, y1: flangeTop,
    r0: MAST.flangeRadius, r1: MAST.flangeRadius,
    material: 'GeneratedSteel', capTop: true,
  });
  revolve(column, {
    y0: flangeTop, y1: columnTop,
    r0: MAST.columnBottomRadius, r1: MAST.columnTopRadius,
    material: 'GeneratedSteel',
  });
  revolve(column, {
    y0: columnTop, y1: collarTop,
    r0: MAST.collarRadius, r1: MAST.collarRadius,
    material: 'GeneratedSteel', capTop: true, capBottom: true,
  });
  revolve(column, {
    y0: collarTop, y1: neckTop,
    r0: MAST.neckRadius, r1: MAST.neckRadius,
    material: 'GeneratedSteel', capTop: true,
  });

  /**
   * Swings with the array, so it is expressed relative to the pivot.
   *
   * Two cheek plates either side of the neck and a torque tube running the
   * width of the array underneath it -- the elevation drive of a real
   * two-axis tracker, and the part that makes the tilt legible from a
   * distance because it visibly rotates with the modules.
   */
  const yoke = [];
  const halfSpan = MAST.yokeHalfSpan;
  const inner = halfSpan - MAST.yokePlateThickness;
  for (const sign of [-1, 1]) {
    slab(yoke,
      [Math.min(sign * halfSpan, sign * inner), -MAST.yokeDrop, -MAST.yokeHalfDepth],
      [Math.max(sign * halfSpan, sign * inner), MAST.yokeRise, MAST.yokeHalfDepth],
      'GeneratedSteel');
  }
  const tubeHalfWidth = Math.max(halfSpan, arrayWidthM * 0.42);
  slab(yoke,
    [-tubeHalfWidth, -MAST.torqueTubeDrop, -MAST.torqueTubeDepth / 2],
    [tubeHalfWidth, -MAST.torqueTubeDrop + MAST.torqueTubeDepth, MAST.torqueTubeDepth / 2],
    'GeneratedSteel');

  return { pivotY, footing, column, yoke };
}

// ---------------------------------------------------------------------------
// extraction
// ---------------------------------------------------------------------------

/**
 * Rebuilds one assembly as a clean glTF with the hierarchy the simulation
 * needs:
 *
 *   SolarPanelRoot
 *     SolarPanelBase                fixed: mast, footing, anything below the
 *                                   tilt axis
 *     SolarPanelTrackingAssembly    rotates; its ORIGIN IS ON THE TILT AXIS,
 *                                   so it swings rather than orbiting
 *       SolarPanelSurface           the photovoltaic faces
 *       SolarPanelFrame             rails and brackets that move with them
 *
 * Two corrections are baked in so the runtime can treat its angles as
 * absolute rather than relative to however the model happened to be posed:
 *
 *   - the assembly is recentred so its base sits at the origin with Y = 0
 *     on the ground;
 *   - the authored tilt is removed, so the tracking assembly at rotation
 *     zero lies flat and `tilt = 35` really means 35 degrees from horizontal.
 *
 * Geometry is converted from inches to metres but otherwise untouched: no
 * decimation, no re-topology, no recomputed normals.
 */
export async function extractAssembly(assembly, outputPath, { flatten = true, mast = false, rack = false } = {}) {
  const { Document } = await import('@gltf-transform/core');

  // Tilt axis: horizontal, perpendicular to the direction the panel faces.
  const n = assembly.normal;
  const facing = Math.hypot(n[0], n[2]) > 1e-6 ? [n[0], 0, n[2]] : [0, 0, 1];
  const fLen = Math.hypot(facing[0], facing[2]) || 1;
  const face = [facing[0] / fLen, 0, facing[2] / fLen];
  const axis = [-face[2], 0, face[0]];
  const authoredTilt = flatten ? (assembly.tiltDeg * Math.PI) / 180 : 0;

  // Pivot: the centre of the module plane, in all three axes.
  //
  // Putting it at the panel's lower edge instead -- which is where a torque
  // tube physically sits on some single-axis racks -- makes the array swing
  // upward and away from its supports as it tilts, leaving it visibly
  // floating at 60 degrees. Rotating about the centre keeps the modules over
  // their posts through the full range, which is what a real two-axis
  // tracker does and what reads correctly on screen.
  const pivot = [
    (assembly.panelMin[0] + assembly.panelMax[0]) / 2,
    Number.isFinite(assembly.panelMin[1])
      ? (assembly.panelMin[1] + assembly.panelMax[1]) / 2
      : assembly.min[1],
    (assembly.panelMin[2] + assembly.panelMax[2]) / 2,
  ];

  const groundY = assembly.min[1];
  const baseOrigin = [(assembly.min[0] + assembly.max[0]) / 2, groundY, (assembly.min[2] + assembly.max[2]) / 2];

  /**
   * Rodrigues rotation of v about `axis` by +authoredTilt.
   *
   * The sign is what flattens rather than doubles the tilt. `axis` is
   * cross(panelNormal, +Y) normalised, and rotating the normal about that
   * axis by +acos(n·Y) is exactly the rotation that carries the normal onto
   * +Y. Negating it tilts the panel the other way instead, which is how an
   * earlier pass turned a 47-degree array into a near-vertical one.
   */
  const tiltBack = (v) => {
    if (!authoredTilt) return v;
    const c = Math.cos(authoredTilt);
    const s = -Math.sin(authoredTilt);
    const k = axis;
    const dot = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
    const cr = [
      k[1] * v[2] - k[2] * v[1],
      k[2] * v[0] - k[0] * v[2],
      k[0] * v[1] - k[1] * v[0],
    ];
    return [
      v[0] * c + cr[0] * s + k[0] * dot * (1 - c),
      v[1] * c + cr[1] * s + k[1] * dot * (1 - c),
      v[2] * c + cr[2] * s + k[2] * dot * (1 - c),
    ];
  };

  const unTilt = (v) => {
    if (!authoredTilt) return v;
    const c = Math.cos(authoredTilt);
    const s = Math.sin(authoredTilt);
    const k = axis;
    const dot = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
    const cross = [
      k[1] * v[2] - k[2] * v[1],
      k[2] * v[0] - k[0] * v[2],
      k[0] * v[1] - k[1] * v[0],
    ];
    return [
      v[0] * c + cross[0] * s + k[0] * dot * (1 - c),
      v[1] * c + cross[1] * s + k[1] * dot * (1 - c),
      v[2] * c + cross[2] * s + k[2] * dot * (1 - c),
    ];
  };

  /**
   * Sorts the assembly's triangles into the three groups.
   *
   * Material alone is not enough to tell a module from its mounting: this
   * catalogue paints legs and rails with the same SketchUp colours as the
   * laminate, so a material test puts the legs in with the cells. Geometry
   * decides it instead -- a module face is a triangle that both points the
   * way the array points and lies in the thin slab the modules occupy.
   * Everything else is structure, split at the tilt axis into the part that
   * swings (frame) and the part that stays planted (base).
   */
  /**
   * Half-thickness of the slab counted as module surface, in inches.
   *
   * 12in rather than 6: this array's modules are built in two layers, one
   * about 6 inches off the mid-plane and one about 9, and a tighter slab
   * catches only the nearer row. The far row then falls through to the
   * frame group and renders in aluminium -- visible on screen as an array
   * whose top half is grey and bottom half blue. Still under FRAME_SLAB,
   * so rails and clamps are unaffected.
   */
  const slabHalfThickness = 12;
  const normalTolerance = Math.cos((22 * Math.PI) / 180);

  const groups = { SolarPanelBase: [], SolarPanelSurface: [], SolarPanelFrame: [] };
  for (const t of assembly.triangles) {
    if (EDGE_MATERIAL.test(t.material) || t.isProp) continue;

    const centroid = [0, 1, 2].map((k) => (t.p[0][k] + t.p[1][k] + t.p[2][k]) / 3);
    const faceNormal = t.n[0];

    // SIGNED, not absolute.
    //
    // Each module is modelled as a solid, so its underside is a second face
    // in the same plane pointing the opposite way. Matching on |dot| keeps
    // both: they end up coincident, z-fight, and the downward-facing half
    // wins often enough that the array renders black in full sun. Keeping
    // only the faces that look the way the array looks leaves one clean
    // collecting surface -- and halves its triangle count.
    const alignment = faceNormal[0] * n[0] + faceNormal[1] * n[1] + faceNormal[2] * n[2];

    // Signed distance from the plane through the panel centre.
    const panelCentre = [0, 1, 2].map((k) => (assembly.panelMin[k] + assembly.panelMax[k]) / 2);
    const offset = [0, 1, 2].reduce((sum, k) => sum + (centroid[k] - panelCentre[k]) * n[k], 0);

    const isSurface = t.isPanel
      && alignment >= normalTolerance
      && Math.abs(offset) <= slabHalfThickness;
    t.planeOffset = offset;

    // What moves is decided by proximity to the module plane, not by height.
    // Rails, clamps and the torque tube sit within the panel sandwich and
    // must swing with it; posts, braces and footings reach down to the
    // ground and must stay planted, or the array lifts off its supports as
    // soon as it tilts.
    if (isSurface) {
      groups.SolarPanelSurface.push(t);
    } else if (Math.abs(offset) <= FRAME_SLAB) {
      groups.SolarPanelFrame.push(t);
    } else {
      groups.SolarPanelBase.push(t);
    }
  }
  // The catalogue glass is a thick, torn solid. The visible face is
  // rebuilt as a flat 2×4 cell grid in the same outline; see generatedGlass.

  const document = new Document();
  const buffer = document.createBuffer();
  const scene = document.createScene('SolarPanel');
  const root = document.createNode('SolarPanelRoot');
  scene.addChild(root);

  /**
   * Materials are assigned by GROUP, not by the source material name.
   *
   * The SketchUp catalogue paints rails, posts and laminate with the same
   * handful of colours, so keying off the original material made the whole
   * assembly one shade -- it rendered as a single black slab with no
   * readable structure. Grouping instead gives each part the surface it
   * physically has: dark blue glass for the modules, mill-finish aluminium
   * for the rails, galvanised steel for the posts.
   */
  const GROUP_MATERIALS = {
    SolarPanelSurface: {
      name: 'PV_Laminate',
      // Silicon blue, dark enough to read as a module and light enough
      // that the white grid lines on top of it stay visible.
      baseColor: [0.07, 0.16, 0.40, 1],
      metallic: 0.08,
      roughness: 0.34,
    },
    SolarPanelGrid: {
      name: 'PV_Grid',
      baseColor: [0.90, 0.92, 0.94, 1],
      metallic: 0.04,
      roughness: 0.55,
    },
    SolarPanelFrame: {
      name: 'Aluminium_Rail',
      baseColor: [0.70, 0.72, 0.745, 1],
      metallic: 0.9,
      roughness: 0.34,
    },
    SolarPanelBase: {
      name: 'Galvanised_Post',
      baseColor: [0.55, 0.575, 0.60, 1],
      metallic: 0.82,
      roughness: 0.46,
    },
    // The two surfaces of the generated pedestal. Concrete is deliberately
    // fully rough and non-metallic so it never competes with the steel or
    // the glass for highlights -- it should read as the dullest thing in
    // the scene, which is what makes the column above it look like metal.
    SolarPanelFooting: {
      name: 'Cast_Concrete',
      baseColor: [0.615, 0.605, 0.585, 1],
      metallic: 0.0,
      roughness: 0.93,
    },
    SolarPanelYoke: {
      name: 'Painted_Steel',
      baseColor: [0.46, 0.485, 0.515, 1],
      metallic: 0.78,
      roughness: 0.42,
    },
    SolarPanelBacking: {
      name: 'PV_Backsheet',
      baseColor: [0.012, 0.016, 0.028, 1],
      metallic: 0.0,
      roughness: 0.85,
    },
  };

  const materials = new Map();
  const materialFor = (group) => {
    let mat = materials.get(group);
    if (!mat) {
      const def = GROUP_MATERIALS[group] ?? GROUP_MATERIALS.SolarPanelFrame;
      mat = document.createMaterial(def.name)
        .setBaseColorFactor(def.baseColor)
        .setMetallicFactor(def.metallic)
        .setRoughnessFactor(def.roughness);
      materials.set(group, mat);
    }
    return mat;
  };

  const buildNode = (name, triangles, { relativeTo, applyUnTilt, offsetAfter = null }) => {
    const node = document.createNode(name);
    if (!triangles.length) return node;

    const byMaterial = new Map();
    for (const t of triangles) {
      let list = byMaterial.get(t.material);
      if (!list) byMaterial.set(t.material, list = []);
      list.push(t);
    }

    const mesh = document.createMesh(name);
    for (const [materialName, list] of byMaterial) {
      const positions = new Float32Array(list.length * 9);
      const normals = new Float32Array(list.length * 9);
      const uvs = new Float32Array(list.length * 6);

      list.forEach((t, ti) => {
        for (let k = 0; k < 3; k++) {
          let p = [
            t.p[k][0] - relativeTo[0],
            t.p[k][1] - relativeTo[1],
            t.p[k][2] - relativeTo[2],
          ];
          let nv = t.n[k];
          if (applyUnTilt) { p = unTilt(p); nv = unTilt(nv); }
          // Applied after un-tilting, in the array's own flat space, so a
          // mount can choose which edge of the array lands on its origin.
          if (offsetAfter) p = [p[0] - offsetAfter[0], p[1] - offsetAfter[1], p[2] - offsetAfter[2]];
          // Collapse the catalogue's stacked sheets onto one thin panel.
          // Inches, measured off the module plane. Glass on top, backing
          // 0.9 in under it -- about 2 cm, not the open 15 cm sandwich.
          if (applyUnTilt && name === 'SolarPanelSurface') {
            p[1] = 0.55;
          } else if (applyUnTilt && name === 'SolarPanelBacking') {
            p[1] = -0.35;
          } else if (applyUnTilt && name === 'SolarPanelGrid') {
            p[1] = 0.78;
          } else if (applyUnTilt && name === 'SolarPanelFrame') {
            p[1] = 0.15;
          }
          // The layers above are set absolutely, so a mount's Y offset (the
          // tracker's standoff) has to be re-applied after them or it is lost
          // and the glass lands back on the tilt axis.
          if (applyUnTilt && offsetAfter && /Surface|Backing|Grid|Frame/.test(name)) {
            p[1] -= offsetAfter[1];
          }
          const o = ti * 9 + k * 3;
          positions[o] = p[0] * INCH;
          positions[o + 1] = p[1] * INCH;
          positions[o + 2] = p[2] * INCH;
          normals[o] = nv[0];
          normals[o + 1] = nv[1];
          normals[o + 2] = nv[2];
          uvs[ti * 6 + k * 2] = t.uv[k][0];
          uvs[ti * 6 + k * 2 + 1] = t.uv[k][1];
        }
      });

      mesh.addPrimitive(document.createPrimitive()
        .setAttribute('POSITION', document.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
        .setAttribute('NORMAL', document.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer))
        .setAttribute('TEXCOORD_0', document.createAccessor().setType('VEC2').setArray(uvs).setBuffer(buffer))
        .setMaterial(materialFor(name)));
    }
    node.setMesh(mesh);
    return node;
  };

  /**
   * Measures the array flat, in metres, from the modules themselves.
   *
   * Taken after un-tilting and relative to the pivot, so these are the
   * array's true width and slope length rather than the footprint its
   * bounding box happens to cast while tilted. The mast generator needs
   * the real slope length to work out how high the pivot must sit.
   */
  /**
   * Un-tilted positions of a triangle's three vertices, relative to the
   * pivot. Inches, with Y measured off the module plane.
   */
  const flatVertices = (t) => t.p.map(
    (vertex) => unTilt([0, 1, 2].map((k) => vertex[k] - pivot[k])),
  );

  /** The modules' outline once laid flat, in inches, around the pivot. */
  const flatBounds = () => {
    const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const t of groups.SolarPanelSurface) {
      for (const q of flatVertices(t)) {
        if (q[0] < b.minX) b.minX = q[0];
        if (q[0] > b.maxX) b.maxX = q[0];
        if (q[2] < b.minZ) b.minZ = q[2];
        if (q[2] > b.maxZ) b.maxZ = q[2];
      }
    }
    return Number.isFinite(b.minX) ? b : { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
  };

  const flatExtent = () => {
    const b = flatBounds();
    return { widthM: (b.maxX - b.minX) * INCH, depthM: (b.maxZ - b.minZ) * INCH };
  };

  /**
   * Drops the catalogue mount's bracing from the moving assembly.
   *
   * Group membership is decided by where a triangle's CENTROID sits
   * relative to the module plane, which is the right test for the rails and
   * clamps it was written for -- they are small and local, so their
   * centroid describes them. It is the wrong test for a diagonal brace: the
   * catalogue draws a metre-long strut as one long thin triangle running
   * from under the array down towards the legs, and its midpoint lands
   * inside the frame slab even though the triangle itself leaves it
   * entirely. Those struts are therefore classed as frame, and once the
   * original mount is replaced they rotate with the array as thin spider
   * legs reaching out into empty air, bolted to nothing.
   *
   * So the cull tests all three VERTICES, not the midpoint: a triangle
   * survives only if the whole of it stays inside the box the modules and
   * their rails occupy -- their flat outline plus a rail's width, and the
   * frame slab's own depth below them. That is a statement about the part
   * rather than about its average position, which is what was missing.
   */
  const cullBracing = (label, { tightY = false } = {}) => {
    const xzMargin = tightY ? 3 : 8;
    // Tight XZ kills diagonal braces that leave the module outline.
    // Y stays at the frame slab so the backing behind the cells survives;
    // extra margin is dropped on a rack so the catalogue's own legs
    // (they hang ~19 in below the plane) still fall off.
    const yLimit = FRAME_SLAB + (tightY ? 0 : 8);
    const b = flatBounds();
    const before = groups.SolarPanelFrame.length;
    groups.SolarPanelFrame = groups.SolarPanelFrame.filter((t) => flatVertices(t).every(
      (q) => q[0] >= b.minX - xzMargin && q[0] <= b.maxX + xzMargin
        && q[2] >= b.minZ - xzMargin && q[2] <= b.maxZ + xzMargin
        && q[1] >= -yLimit && q[1] <= yLimit,
    ));
    console.error(`[${label}] frame triangles ${before} -> ${groups.SolarPanelFrame.length}`);
  };

  /**
   * Where the tilt axis is, and how the flat array sits on it.
   *
   * `translation` places the tracking node in the finished model, and
   * `offsetAfter` shifts the flat geometry inside it. Together they decide
   * which edge of the array stays put when it tilts, which is the whole
   * visible difference between a tracker and an adjustable rack.
   */
  let mount = null;

  if (mast) {
    // The catalogue's own ground frame is dropped here, and only here.
    // Its modules, laminate and rails carry straight through untouched --
    // what changes is the thing they are bolted to.
    cullBracing('mast');
    const flat = flatExtent();
    const pole = buildMast(flat.depthM, flat.widthM);

    const base = buildNode('SolarPanelBase', pole.column, {
      relativeTo: [0, 0, 0], applyUnTilt: false,
    });
    base.addChild(buildNode('SolarPanelFooting', pole.footing, {
      relativeTo: [0, 0, 0], applyUnTilt: false,
    }));
    root.addChild(base);

    // The array is centred on the column in XZ, but pushed FORWARD along
    // the face normal (local +Y) by arrayStandoff. Without that, a steep
    // tilt puts the glass through the pole. offsetAfter is in inches and
    // is subtracted from the un-tilted points, so a negative Y shifts the
    // modules up, in front of the torque tube.
    mount = {
      pole,
      translation: [0, pole.pivotY, 0],
      offsetAfter: [0, -MAST.arrayStandoff / INCH, 0],
    };
  } else if (rack) {
    /**
     * An adjustable rack hinges at its FRONT edge.
     *
     * This is the difference the reference photograph is about. A rack like
     * that is bolted down at the low, sun-facing edge and raised at the
     * back by a pair of telescopic legs, so changing the tilt lengthens the
     * legs while the hinge stays exactly where it is. Rotating about the
     * array's centre instead -- correct for a tracker -- would drive the
     * front edge into the ground and lift the hinge off its feet, and no
     * strut drawn against it could line up.
     *
     * Positive tilt leans the array towards +Z (see SolarArray.jsx), which
     * sends the +Z edge DOWN and the -Z edge up. So +Z is the front, and
     * the hinge line is the flat outline's maximum Z.
     *
     * The finished model is therefore built around the HINGE rather than
     * around the array: origin on the ground directly under the hinge pin,
     * array reaching back from it in -Z. That is what lets the rack's legs
     * be drawn at runtime from two fixed numbers -- see `scene.rack` in
     * solarSpecs.js.
     */
    cullBracing('rack', { tightY: true });
    const b = flatBounds();
    mount = {
      translation: [0, RACK.hingeHeight, 0],
      offsetAfter: [(b.minX + b.maxX) / 2, 0, b.maxZ],
    };
  } else {
    root.addChild(buildNode('SolarPanelBase', groups.SolarPanelBase, {
      relativeTo: baseOrigin, applyUnTilt: false,
    }));
  }

  // On a generated mount the tilt axis is where that mount puts it. On the
  // catalogue's own mounts it stays wherever their frame carried it.
  const tracker = document.createNode('SolarPanelTrackingAssembly').setTranslation(
    mount
      ? mount.translation
      : [
        (pivot[0] - baseOrigin[0]) * INCH,
        (pivot[1] - baseOrigin[1]) * INCH,
        (pivot[2] - baseOrigin[2]) * INCH,
      ],
  );
  root.addChild(tracker);
  if (mount?.pole) {
    tracker.addChild(buildNode('SolarPanelYoke', mount.pole.yoke, {
      relativeTo: [0, 0, 0], applyUnTilt: false,
    }));
  }
  const panelPlacement = { relativeTo: pivot, applyUnTilt: true, offsetAfter: mount?.offsetAfter };
  // Replace the catalogue's thick, torn glass with one flat 2×4 grid
  // in the same outline. tiltBack puts it into world inches so the
  // usual un-tilt lands it back on the module plane.
  const outline = flatBounds();
  const glass = generatedGlass(outline, tiltBack, pivot);
  tracker.addChild(buildNode('SolarPanelBacking', glass.backing, panelPlacement));
  tracker.addChild(buildNode('SolarPanelFrame', glass.frames, panelPlacement));
  tracker.addChild(buildNode('SolarPanelSurface', glass.cells, panelPlacement));
  tracker.addChild(buildNode('SolarPanelGrid', glass.lines, panelPlacement));

  // Draco, same as the wind models: lossless to the eye, and it takes this
  // assembly from ~11.8 MB to something a browser can fetch comfortably.
  // No decimation -- the geometry stays exactly as authored.
  const { draco } = await import('@gltf-transform/functions');
  const { default: draco3d } = await import('draco3dgltf');
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });

  await document.transform(
    draco({ method: 'edgebreaker', quantizePositionBits: 14, quantizeNormalBits: 10 }),
  );
  await io.write(outputPath, document);

  const apertureM2 = measureAperture(assembly);

  // Cross-check against the bounding box: width x slope length, the figure
  // you would get measuring the array by hand. The true aperture must come
  // in at or just under it -- modules do not cover their rack edge to edge.
  // A wild disagreement means the classification has gone wrong, and a
  // silently wrong aperture would corrupt every power figure downstream.
  const slopeLength = (assembly.size[2] * INCH) / Math.max(Math.cos(authoredTilt), 0.2);
  const boxEstimate = assembly.size[0] * INCH * slopeLength;

  // Once the catalogue's own mount is gone its bounding box describes a
  // frame that is no longer in the model, so the reported size is rebuilt
  // from what is actually there: the flat array on its generated mount.
  const flat = mount ? flatExtent() : null;
  const sizeM = mount
    ? [
      +Math.max(flat.widthM, mount.pole ? MAST.padRadius * 2 : 0).toFixed(2),
      +((mount.pole ? mount.pole.pivotY + MAST.yokeRise : RACK.hingeHeight + flat.depthM)).toFixed(2),
      +flat.depthM.toFixed(2),
    ]
    : assembly.size.map((v) => +(v * INCH).toFixed(2));

  return {
    path: outputPath,
    apertureM2: +apertureM2.toFixed(2),
    boxEstimateM2: +boxEstimate.toFixed(2),
    sizeM,
    pivotHeightM: mount?.pole ? +mount.pole.pivotY.toFixed(2) : null,
    hingeHeightM: mount && !mount.pole ? RACK.hingeHeight : null,
    authoredTiltDeg: +assembly.tiltDeg.toFixed(1),
    triangles: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
  };
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('segment-solar.mjs');

if (invokedDirectly && process.argv.includes('--extract')) {
  const index = Number(process.argv[process.argv.indexOf('--extract') + 1]);
  const outFlag = process.argv.indexOf('--out');
  const out = outFlag >= 0 ? process.argv[outFlag + 1] : 'public/models/solar.glb';
  const { triangles } = await loadTriangles();
  const assemblies = clusterAssemblies(triangles);
  if (!assemblies[index]) {
    console.error(`no assembly ${index}; there are ${assemblies.length}`);
    process.exit(1);
  }
  const mast = process.argv.includes('--mast');
  const rack = process.argv.includes('--rack');
  console.log(JSON.stringify(await extractAssembly(assemblies[index], out, { mast, rack })));
} else if (invokedDirectly) {
  await report();
}
