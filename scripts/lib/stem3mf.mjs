/**
 * Reads the STEM box print file into plain arrays.
 *
 * Shared by build-stem-boxes.mjs (which writes the GLB the site loads) and
 * verify-stem.mjs (which checks the assembly), so both see exactly the same
 * geometry. Coordinates are converted from the 3MF's Z-up millimetres to
 * three.js Y-up millimetres: (x, y, z) -> (x, z, -y).
 */
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'three/examples/jsm/libs/fflate.module.js';

export const SOURCE = 'models-source/stem_boxes_X1E.3mf';

/**
 * @returns {{
 *   filament: string[],
 *   parts: Map<string, { title: string, shells: Array<{
 *     name: string, extruder: number, vertices: Float64Array, indices: Uint32Array
 *   }> }>
 * }}
 *   `parts` is keyed by the code printed on the part: "S01", "S13#2".
 */
export function loadStemParts(source = SOURCE) {
  const zip = unzipSync(new Uint8Array(readFileSync(source)));
  const text = (path) => strFromU8(zip[path.replace(/^\//, '')]);

  const settings = text('Metadata/model_settings.config');
  const project = JSON.parse(text('Metadata/project_settings.config'));
  const top = text('3D/3dmodel.model');

  const objects = new Map();
  for (const m of settings.matchAll(/<object id="(\d+)">([\s\S]*?)<\/object>/g)) {
    const body = m[2];
    const name = body.match(/key="name" value="([^"]*)"/)[1];
    const objectExtruder = Number(body.match(/key="extruder" value="(\d+)"/)?.[1] ?? 1);
    const shells = [...body.matchAll(/<part id="\d+"[^>]*>([\s\S]*?)<\/part>/g)].map((p) => ({
      name: p[1].match(/key="name" value="([^"]*)"/)[1],
      extruder: Number(p[1].match(/key="extruder" value="(\d+)"/)?.[1] ?? objectExtruder),
    }));
    objects.set(m[1], { name, shells });
  }

  const components = new Map();
  for (const m of top.matchAll(/<object id="(\d+)"[^>]*>\s*<components>([\s\S]*?)<\/components>/g)) {
    components.set(m[1], [...m[2].matchAll(/p:path="([^"]+)" objectid="(\d+)"/g)].map((c) => ({
      path: c[1], id: c[2],
    })));
  }

  const subFiles = new Map();
  const meshOf = (path, id) => {
    if (!subFiles.has(path)) subFiles.set(path, text(path));
    const xml = subFiles.get(path);
    const start = xml.indexOf(`<object id="${id}"`);
    const block = xml.slice(start, xml.indexOf('</object>', start));
    const v = [];
    for (const m of block.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)) {
      v.push(Number(m[1]), Number(m[3]), -Number(m[2]));
    }
    const t = [];
    for (const m of block.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g)) {
      t.push(Number(m[1]), Number(m[2]), Number(m[3]));
    }
    return { vertices: Float64Array.from(v), indices: Uint32Array.from(t) };
  };

  const parts = new Map();
  for (const [, id] of top.matchAll(/<item objectid="(\d+)"/g)) {
    const object = objects.get(id);
    if (!object) continue;
    const [code] = object.name.split(' ');
    const copy = object.name.match(/#(\d+)$/)?.[1];
    const key = copy ? `${code}#${copy}` : code;
    if (parts.has(key)) continue;
    const shells = (components.get(id) ?? []).map((c, i) => {
      const info = object.shells[i] ?? object.shells[0];
      return { ...info, ...meshOf(c.path, c.id) };
    });
    parts.set(key, { title: object.name, shells });
  }

  return { filament: project.filament_colour, parts };
}
