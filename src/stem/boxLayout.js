/**
 * Where the boxes and their devices stand on the table.
 *
 * Shared by the scene and by scripts/verify-stem.mjs, so the checks run
 * against the same numbers the screen uses. Millimetres, box frame.
 */

/** The table top, in each box's own frame: the underside of the feet. */
export const TABLE_Y = -42.75;

/**
 * Where each device is set down when taken out, relative to where it
 * stands in the box. The y term drops it from the deck to the table top:
 * both the tracker's base plate and the turbine's clamp stand on the
 * deck's top face, y = -9.
 */
const DECK_TOP = -9;
export const OUT_OFFSETS = {
  solar: [-110, TABLE_Y - DECK_TOP, 230],
  wind: [230, TABLE_Y - DECK_TOP, 140],
};
