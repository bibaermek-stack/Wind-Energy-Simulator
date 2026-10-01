/**
 * Converts the STEM box print file into a GLB the site can animate.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE SOURCE IS
 * ---------------------------------------------------------------------------
 * models-source/stem_boxes_X1E.3mf is the Bambu Studio project the boxes are
 * printed from. Every part in it is laid out for the PRINTER: centred on its
 * own origin, in the orientation it is printed in, scattered across fifteen
 * plates. Nothing in the file records where a part sits in the finished box.
 *
 * So this script does one thing: it turns each printed part into its own
 * node, untouched, in millimetres -> metres, coloured by the filament its
 * volume is printed in. Where each part goes -- and how it travels there --
 * lives in src/stem/boxAssembly.js, applied at runtime. That split is what
 * lets one GLB drive the exploded view, the assembly animation and the
 * finished box without baking three copies of the geometry.
 *
 * Node names are the part codes from the print file ("S01", "S13#2",
 * "W26#3"), so the assembly table can address every copy of a repeated part.
 *
 * Run: node scripts/build-stem-boxes.mjs     (or npm run models:stem)
 */
import { readFileSync } from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { unzipSync, strFromU8 } from 'three/examples/jsm/libs/fflate.module.js';

const SOURCE = 'models-source/stem_boxes_X1E.3mf';
const OUT = 'public/models/stem-boxes.glb';
const MM = 0.001;

const zip = unzipSync(new Uint8Array(readFileSync(SOURCE)));
const text = (path) => strFromU8(zip[path.replace(/^\//, '')]);

const settings = text('Metadata/model_settings.config');
const project = JSON.parse(text('Metadata/project_settings.config'));
const top = text('3D/3dmodel.model');

/** Filament colours, one per extruder: dark body, solar yellow, wind blue. */
const FILAMENT = project.filament_colour;

/** Object id -> { name, parts: [{ name, extruder }] } from the slicer config. */
const objects = new Map();
for (const m of settings.matchAll(/<object id="(\d+)">([\s\S]*?)<\/object>/g)) {
  const body = m[2];
  const name = body.match(/key="name" value="([^"]*)"/)[1];
  const objectExtruder = Number(body.match(/key="extruder" value="(\d+)"/)?.[1] ?? 1);
  const parts = [...body.matchAll(/<part id="\d+"[^>]*>([\s\S]*?)<\/part>/g)].map((p) => ({
    name: p[1].match(/key="name" value="([^"]*)"/)[1],
    extruder: Number(p[1].match(/key="extruder" value="(\d+)"/)?.[1] ?? objectExtruder),
  }));
  objects.set(m[1], { name, parts });
}

/** Object id -> component list (sub-file path, sub-object id). */
const components = new Map();
for (const m of top.matchAll(/<object id="(\d+)"[^>]*>\s*<components>([\s\S]*?)<\/components>/g)) {
  components.set(m[1], [...m[2].matchAll(/p:path="([^"]+)" objectid="(\d+)"/g)].map((c) => ({
    path: c[1], id: c[2],
  })));
}

const subFiles = new Map();
function meshOf(path, id) {
  if (!subFiles.has(path)) subFiles.set(path, text(path));
  const xml = subFiles.get(path);
  const start = xml.indexOf(`<object id="${id}"`);
  const end = xml.indexOf('</object>', start);
  const block = xml.slice(start, end);
  const vertices = [];
  for (const v of block.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)) {
    // 3MF is Z-up; three.js is Y-up. (x, y, z) -> (x, z, -y), in metres.
    vertices.push(Number(v[1]) * MM, Number(v[3]) * MM, -Number(v[2]) * MM);
  }
  const indices = [];
  for (const t of block.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g)) {
    indices.push(Number(t[1]), Number(t[2]), Number(t[3]));
  }
  return { vertices, indices };
}

/** Flat normals: these are CAD parts with hard edges, not organic surfaces. */
function unindex({ vertices, indices }) {
  const pos = new Float32Array(indices.length * 3);
  const nor = new Float32Array(indices.length * 3);
  for (let i = 0; i < indices.length; i += 3) {
    const p = [0, 1, 2].map((k) => [0, 1, 2].map((c) => vertices[indices[i + k] * 3 + c]));
    const u = [0, 1, 2].map((c) => p[1][c] - p[0][c]);
    const w = [0, 1, 2].map((c) => p[2][c] - p[0][c]);
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(...n) || 1;
    n = n.map((c) => c / l);
    for (let k = 0; k < 3; k++) {
      pos.set(p[k], (i + k) * 3);
      nor.set(n, (i + k) * 3);
    }
  }
  return { pos, nor };
}

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('StemBoxes');
doc.getRoot().setDefaultScene(scene);

const hex = (h) => [1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255) ** 2.2);
const materials = FILAMENT.map((colour, i) => doc.createMaterial(`PETG_${i + 1}`)
  .setBaseColorFactor([...hex(colour), 1])
  .setMetallicFactor(0)
  .setRoughnessFactor(0.55));

const seen = new Map();
const items = [...top.matchAll(/<item objectid="(\d+)"/g)].map((m) => m[1]);
let triangles = 0;

for (const id of items) {
  const object = objects.get(id);
  if (!object || seen.has(id)) continue;
  seen.set(id, true);

  // "S13 Anti-slip foot #3" -> "S13#3"; "S01 Base" -> "S01".
  const [code] = object.name.split(' ');
  const copy = object.name.match(/#(\d+)$/)?.[1];
  const nodeName = copy ? `${code}#${copy}` : code;

  const node = doc.createNode(nodeName).setExtras({ title: object.name });
  const comps = components.get(id) ?? [];
  comps.forEach((c, i) => {
    const part = object.parts[i] ?? object.parts[0];
    const { pos, nor } = unindex(meshOf(c.path, c.id));
    triangles += pos.length / 9;
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nor).setBuffer(buffer))
      .setMaterial(materials[part.extruder - 1]);
    const mesh = doc.createMesh(`${nodeName}:${part.name}`).addPrimitive(prim);
    if (comps.length === 1) node.setMesh(mesh);
    else node.addChild(doc.createNode(`${nodeName}:${part.name.split(' ').pop()}`).setMesh(mesh));
  });
  scene.addChild(node);
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });
await doc.transform(
  weld(),
  draco({ method: 'edgebreaker', quantizePositionBits: 14, quantizeNormalBits: 8 }),
);
await io.write(OUT, doc);
console.log(`${seen.size} parts, ${triangles} triangles -> ${OUT}`);
