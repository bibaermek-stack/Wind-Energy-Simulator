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
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { loadStemParts } from './lib/stem3mf.mjs';

const OUT = 'public/models/stem-boxes.glb';
const MM = 0.001;

const { filament: FILAMENT, parts } = loadStemParts();

/** Flat normals: these are CAD parts with hard edges, not organic surfaces. */
function unindex({ vertices, indices }) {
  const pos = new Float32Array(indices.length * 3);
  const nor = new Float32Array(indices.length * 3);
  for (let i = 0; i < indices.length; i += 3) {
    const p = [0, 1, 2].map((k) => [0, 1, 2].map((c) => vertices[indices[i + k] * 3 + c] * MM));
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

let triangles = 0;

for (const [nodeName, part] of parts) {
  const node = doc.createNode(nodeName).setExtras({ title: part.title });
  part.shells.forEach((shell) => {
    const { pos, nor } = unindex(shell);
    triangles += pos.length / 9;
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nor).setBuffer(buffer))
      .setMaterial(materials[shell.extruder - 1]);
    const mesh = doc.createMesh(`${nodeName}:${shell.name}`).addPrimitive(prim);
    if (part.shells.length === 1) node.setMesh(mesh);
    else node.addChild(doc.createNode(`${nodeName}:${shell.name.split(' ').pop()}`).setMesh(mesh));
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
console.log(`${parts.size} parts, ${triangles} triangles -> ${OUT}`);
