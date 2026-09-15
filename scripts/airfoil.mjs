/**
 * NACA 4-digit aerofoil section generator.
 *
 * Used to loft the small-scale turbine's blades so they carry a real
 * aerofoil profile with camber, thickness distribution and spanwise
 * twist -- rather than the flat rectangles a "3D turbine" usually gets.
 *
 * Reference: Abbott & von Doenhoff, "Theory of Wing Sections", App. I.
 */

/**
 * Returns a closed contour of a NACA MPXX section, normalised to unit
 * chord, ordered counter-clockwise from the trailing edge over the
 * upper surface, round the leading edge, and back along the lower.
 *
 * @param {string} code      4-digit designation, e.g. '4412'
 * @param {number} nPoints   points per surface
 * @returns {Array<[number, number]>} [chordwise, thickness] pairs
 */
export function nacaSection(code = '4412', nPoints = 24) {
  const m = parseInt(code[0], 10) / 100;        // max camber
  const p = parseInt(code[1], 10) / 10;         // position of max camber
  const t = parseInt(code.slice(2), 10) / 100;  // max thickness

  // Cosine spacing clusters points at the leading edge, where curvature
  // is highest -- uniform spacing makes a visibly faceted nose.
  const xs = Array.from({ length: nPoints }, (_, i) => {
    const beta = (Math.PI * i) / (nPoints - 1);
    return 0.5 * (1 - Math.cos(beta));
  });

  const upper = [];
  const lower = [];

  for (const x of xs) {
    const yt = 5 * t * (
      0.2969 * Math.sqrt(x)
      - 0.1260 * x
      - 0.3516 * x * x
      + 0.2843 * x * x * x
      - 0.1036 * x * x * x * x   // closed trailing edge (-0.1036, not -0.1015)
    );

    let yc, dycdx;
    if (p === 0 || m === 0) {
      yc = 0;
      dycdx = 0;
    } else if (x < p) {
      yc = (m / (p * p)) * (2 * p * x - x * x);
      dycdx = ((2 * m) / (p * p)) * (p - x);
    } else {
      yc = (m / ((1 - p) ** 2)) * ((1 - 2 * p) + 2 * p * x - x * x);
      dycdx = ((2 * m) / ((1 - p) ** 2)) * (p - x);
    }

    const theta = Math.atan(dycdx);
    upper.push([x - yt * Math.sin(theta), yc + yt * Math.cos(theta)]);
    lower.push([x + yt * Math.sin(theta), yc - yt * Math.cos(theta)]);
  }

  // TE -> LE along the upper surface, then LE -> TE along the lower.
  // Drop the duplicated leading- and trailing-edge points so the
  // contour is a clean closed loop with no coincident vertices.
  return [...upper.reverse(), ...lower.slice(1, -1)];
}
