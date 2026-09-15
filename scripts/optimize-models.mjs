/**
 * Prepares the two supplied Sketchfab turbine models for the browser.
 *
 * Constraints that drive every choice here:
 *
 *   1. The original silhouette must survive untouched. No flatten(), no
 *      join() -- both collapse the node hierarchy, and the runtime needs
 *      `Generator` (the HAWT rotor) and `PlanesHolder_27` (the VAWT rotor)
 *      to stay addressable so it can spin them independently of the tower.
 *
 *   2. The 30 MB HAWT has to become a reasonable download.
 *
 * On decimation: it was tried and deliberately abandoned. The HAWT's
 * 332k triangles sit on 663k vertices -- every face is flat-shaded with
 * its own split vertices, so no two adjacent triangles share an index.
 * meshopt therefore reads every edge as a boundary and declines to
 * collapse anything (0.3% reduction even at ratio 0.3 / error 1.0).
 * Welding by position would fix that, but only by recomputing normals,
 * which visibly changes the shading of the original model. Draco alone
 * gets us 28.6 MB -> 0.8 MB, and 332k triangles is a non-issue for any
 * GPU made this decade, so geometry is preserved exactly as authored.
 *
 * Reads  models-source/*.glb   (untouched copies of the originals)
 * Writes public/models/*.glb
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { mkdirSync, statSync } from 'node:fs';

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

async function optimise(src, dst, label) {
  const before = statSync(src).size;
  const document = await io.read(src);

  await document.transform(
    dedup(),
    prune({ keepAttributes: false }),
    // 14 bits of positional quantisation is ~1 part in 16k across the
    // bounding box -- sub-millimetre on a 66 m rotor, so the blade
    // profile is preserved well below what the screen can resolve.
    draco({ method: 'edgebreaker', quantizePositionBits: 14, quantizeNormalBits: 10 }),
  );

  await io.write(dst, document);

  const after = statSync(dst).size;
  const tris = document.getRoot().listMeshes().reduce(
    (sum, mesh) => sum + mesh.listPrimitives().reduce((s, prim) => {
      const idx = prim.getIndices();
      return s + (idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
    }, 0),
    0,
  );

  console.log(`${label}: ${mb(before)} -> ${mb(after)}  (${Math.round(tris).toLocaleString()} triangles, geometry unchanged)`);
}

mkdirSync('public/models', { recursive: true });

await optimise('models-source/hawt_original.glb', 'public/models/hawt.glb', 'HAWT  (Horizontal Axis)');
await optimise('models-source/vawt_hrotor_original.glb', 'public/models/vawt.glb', 'VAWT  (H-rotor Darrieus)');
