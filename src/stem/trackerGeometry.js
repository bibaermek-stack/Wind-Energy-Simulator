/**
 * The solar tracker that stands on the deck.
 *
 * It is not in the print file, so it is generated -- and because it is
 * generated it is defined once, here, as plain boxes: the scene draws these
 * boxes and scripts/verify-stem.mjs checks the same boxes for collisions,
 * both against the printed box and against the tracker's own parts.
 *
 * Three frames, millimetres:
 *
 *   base   origin on the deck's top face at its centre; never moves
 *   pan    origin on the pan servo's output, turns about Y
 *   tilt   origin on the tilt axis (along x), turns about X
 *
 * The layout follows real pan/tilt solar trackers: the U-bracket's arms
 * stand OUTSIDE the module's width, and the tilt servo sits on the outside
 * of one arm with its shaft on the tilt axis. An earlier version had the
 * arms and the tilt servo inside the module's footprint, so the servo body
 * stood up through the glass and the arms' tops cut into it as it tilted.
 */

/** Height of the pan servo's output above the deck. */
export const PAN_HEIGHT = 42;
/** Tilt axis above the pan output: high enough that the module clears the bracket at full tilt. */
export const TILT_AXIS = 60;
/** The module: aluminium frame, 130 x 84 mm, 6 mm above the axis. */
export const MODULE = { size: [130, 4, 84], y: 6 };
const ARM_X = 68;

/** @typedef {{ size: number[], pos: number[], look: 'grey'|'metal'|'dark'|'cell'|'ldr' }} Block */

/** @type {Block[]} */
export const BASE_BLOCKS = [
  { size: [64, 4, 64], pos: [0, 2, 0], look: 'dark' },               // base plate in the T-slots
  { size: [22, 38, 42], pos: [0, 4 + 19, 0], look: 'grey' },          // pan servo
];

/** @type {Block[]} */
export const PAN_BLOCKS = [
  { size: [28, 3, 28], pos: [0, 1.5, 0], look: 'dark' },              // servo horn plate
  { size: [2 * ARM_X + 3, 3, 22], pos: [0, 4.5, 0], look: 'metal' }, // U-bracket floor
  ...[-1, 1].map((s) => ({
    size: [3, TILT_AXIS + 3, 22], pos: [s * ARM_X, 3 + (TILT_AXIS + 3) / 2, 0], look: 'metal',
  })),                                                                  // U-bracket arms
  { size: [12, 22, 30], pos: [ARM_X + 1.5 + 6, TILT_AXIS, 0], look: 'dark' }, // tilt servo, outboard
];

/** @type {Block[]} */
export const TILT_BLOCKS = [
  { size: [2 * ARM_X, 6, 6], pos: [0, 0, 0], look: 'dark' },          // tilt shaft
  { size: MODULE.size, pos: [0, MODULE.y, 0], look: 'grey' },         // module frame
  // Light sensors: a board at the module's upper edge with a cross shade.
  { size: [22, 3, 14], pos: [0, 8, -48], look: 'dark' },
  { size: [1.6, 12, 14], pos: [0, 15, -48], look: 'dark' },
  { size: [22, 12, 1.6], pos: [0, 15, -48], look: 'dark' },
];

/** The 6 x 4 cells on the module's face, centred on it. */
export const CELLS = [];
for (let i = 0; i < 6; i++) {
  for (let j = 0; j < 4; j++) {
    CELLS.push({ size: [19.5, 0.6, 17], pos: [(i - 2.5) * 21, MODULE.y + 2.3, (j - 1.5) * 18.5], look: 'cell' });
  }
}

export const LDR_SPOTS = [[-5, -3.5], [5, -3.5], [-5, 3.5], [5, 3.5]]
  .map(([x, z]) => ({ pos: [x, 10, -48 + z], look: 'ldr' }));

/** The tilt axis above the deck top: where the engine's pivot sits. */
export const AXIS_ABOVE_DECK = PAN_HEIGHT + TILT_AXIS;
