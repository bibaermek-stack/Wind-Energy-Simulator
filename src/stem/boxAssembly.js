/**
 * Where every printed part of the two STEM boxes goes, and in what order.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS TABLE EXISTS
 * ---------------------------------------------------------------------------
 * The print file (models-source/stem_boxes_X1E.3mf) only knows how each part
 * lies on the PRINT BED: centred on its own origin, in its print
 * orientation. scripts/build-stem-boxes.mjs keeps it that way, one node per
 * part. This table is the missing half: the pose of each part in the
 * finished box, worked out from the parts' own features --
 *
 *   - wall panels sit in the 3.5 mm slots of the corner posts (slot centre
 *     lines at x = +-86.5 and z = +-120 mm in the solar base);
 *   - the top rim's locating holes match the post pins (+-82.7 mm);
 *   - a dome rib's tenon (local x 47.7..55.7) drops into a rim socket, and
 *     its upper end then lands at r = 8.6 mm, y = 192.5..203.3 -- exactly
 *     the 10.8 mm-deep cross slots on the underside of the sun hub;
 *   - the guard legs and arcs meet in half-lap joints, which is why one
 *     side of the guard is mirrored relative to the other.
 *
 * ---------------------------------------------------------------------------
 * CONVENTIONS
 * ---------------------------------------------------------------------------
 * Millimetres, three.js axes (Y up). Each box has its own frame with the
 * floor of the base at y = -34 and the base centred on the origin.
 *
 * `basis` says where the part's local x, y and z axes point in the box, as
 * three axis names or vectors -- the same thing as a rotation matrix's
 * columns, but readable. `pos` is where the part's origin (its print
 * centre) lands. `pre` is a yaw applied first, for the few copies that were
 * laid on the bed turned relative to their siblings.
 *
 * `from` is where the part waits in the exploded view, as an offset from
 * its final position. `step` groups parts into the assembly sequence.
 */

/** @typedef {[number, number, number]} Vec3 */

const AXES = {
  '+x': [1, 0, 0], '-x': [-1, 0, 0],
  '+y': [0, 1, 0], '-y': [0, -1, 0],
  '+z': [0, 0, 1], '-z': [0, 0, -1],
};
const axis = (a) => (typeof a === 'string' ? AXES[a] : a);
export const basisOf = (b) => b.map(axis);

/** Rib / arc helpers: a horizontal unit vector at an angle in the XZ plane. */
const dir = (x, z) => {
  const l = Math.hypot(x, z);
  return [x / l, 0, z / l];
};
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

// ---------------------------------------------------------------------------
// shared numbers
// ---------------------------------------------------------------------------
const PANEL_TALL_Y = 2.45;   // 65.4 mm panels standing in the 3.5 mm slots
const PANEL_SHORT_Y = 1.45;  // 63.4 mm panels
const RIM_Y = 45.5;          // rim plate rests on the post tops at y = 34
const DECK_Y = -12.5;        // deck rests on the floor bosses (top y = -16)
const TRAY_Y = -24.25;       // electronics tray on the floor (y = -28)
const FOOT_Y = -38;
const KNOB_Y = 44.5;
const COVER_Y = 37.5;

const UP = [0, 1, 0];
const DOWN = [0, -1, 0];

// ===========================================================================
// TRACKING SOLAR
// ===========================================================================
const SOLAR_RIM_Z = 33.15;   // rim centre: between the front and middle posts
const SOLAR_RIB_SOCKET = 117.0; // 82.7 * sqrt 2
const SOLAR_RIB_SHOULDER_Y = 57; // top of the rim sockets

function solarRib(i, sx, sz) {
  const d = dir(sx, sz);
  // local x -> outward along the diagonal, local z -> down, y completes it.
  const basis = [d, [-d[2], 0, d[0]], DOWN];
  // Tenon centre (51.7, 0, 69) lands on the socket.
  const socket = [d[0] * SOLAR_RIB_SOCKET, 0, SOLAR_RIM_Z + d[2] * SOLAR_RIB_SOCKET];
  const pos = add(add(socket, scale(d, -51.7)), [0, SOLAR_RIB_SHOULDER_Y + 69, 0]);
  return {
    id: `S10#${i}`, basis, pos, step: 'ribs',
    from: add(scale(d, 140), [0, 120, 0]),
  };
}

const SOLAR_HUB_Y = 201.7;

/** Deck centre and top, where the tracker stands. */
export const SOLAR_DECK = { centre: [0, -9, 33.5] };

export const SOLAR_PARTS = [
  { id: 'S01', basis: ['+x', '+y', '+z'], pos: [0, 0, 0], step: 'base', from: [0, 0, 0] },
  ...[[1, 82.7, 116.5], [2, -82.7, 116.5], [3, 82.7, -116.6], [4, -82.7, -116.6]].map(([n, x, z]) => ({
    id: `S13#${n}`, basis: ['+x', '+y', '+z'], pos: [x, FOOT_Y, z], step: 'feet', from: [0, -70, 0],
  })),
  { id: 'S06', basis: ['+z', '+y', '-x'], pos: [0, TRAY_Y, -85], step: 'inside', from: [0, 150, 0] },
  ...[1, 2, 3, 4].map((n, i) => ({
    id: `S12#${n}`, basis: ['+y', '-x', '+z'], pos: [-60 + i * 40, -28 + 3.7, -65], step: 'inside',
    from: [0, 130, 0],
  })),
  { id: 'S07', basis: ['+x', '+y', '+z'], pos: [0, DECK_Y, 33.5], step: 'deck', from: [0, 170, 0] },
  ...[
    [1, [0, 33.5 + 78], ['+x', '+y', '+z']],
    [2, [0, 33.5 - 78], ['-x', '+y', '-z']],
    [3, [78, 33.5], ['-z', '+y', '+x']],
    [4, [-78, 33.5], ['+z', '+y', '-x']],
  ].map(([n, [x, z], basis]) => ({
    id: `S07C#${n}`, basis, pos: [x, -15, z], step: 'deck', from: [0, 150, 0],
  })),

  // Walls. Outer face is local +y on every panel; lettering reads with
  // local -z up.
  { id: 'S04', basis: ['+x', '+z', '-y'], pos: [0, PANEL_TALL_Y, 120], step: 'walls', from: [0, 0, 110] },
  { id: 'S05', basis: ['-x', '-z', '-y'], pos: [0, PANEL_SHORT_Y, -120], step: 'walls', from: [0, 0, -110] },
  { id: 'S03A', basis: ['-z', '+x', '-y'], pos: [86.5, PANEL_TALL_Y, 33.5], step: 'walls', from: [110, 0, 0] },
  { id: 'S02A', basis: ['+y', '-x', '+z'], pos: [-86.5, PANEL_TALL_Y, 33.5], step: 'walls', from: [-110, 0, 0] },
  { id: 'S03B', basis: ['-z', '+x', '-y'], pos: [86.5, PANEL_SHORT_Y, -85], step: 'walls', from: [110, 0, 0] },
  { id: 'S02B', basis: ['+z', '-x', '-y'], pos: [-86.5, PANEL_SHORT_Y, -85], step: 'walls', from: [-110, 0, 0] },

  { id: 'S08', basis: ['+x', '+y', '+z'], pos: [0, RIM_Y, SOLAR_RIM_Z], step: 'rim', from: [0, 120, 0] },
  { id: 'S09', basis: ['+x', '-y', '-z'], pos: [0, COVER_Y, -90.1], step: 'cover', from: [0, 110, -30] },
  ...[[1, 82.7], [2, -82.7]].map(([n, x]) => ({
    id: `S14#${n}`, basis: ['+x', '-y', '-z'], pos: [x, KNOB_Y, -116.6], step: 'cover', from: [0, 90, 0],
  })),

  solarRib(1, 1, 1), solarRib(2, -1, 1), solarRib(3, 1, -1), solarRib(4, -1, -1),
  { id: 'S11', basis: ['+x', '+y', '+z'], pos: [0, SOLAR_HUB_Y, SOLAR_RIM_Z], step: 'hub', from: [0, 110, 0] },
];

// ===========================================================================
// WIND GENERATOR -- built in the base's own frame (front = +x), then the
// whole box is turned so its front faces the camera like the solar box.
// ===========================================================================
const WIND_RIM_X = 33.7;
const WIND_DECK = [32.5, DECK_Y, 0];
const LEG_X = 82.6;
const LEG_Z = 116.6;
const LEG_Y = 57 + 57;       // shoulder (local z 57) on the socket tops

/** Tower stack, bottom to top. */
const CLAMP_Y = -16 + 20;
const SLEEVE_Y = -11 + 18.5;
const TOWER_Y = -11 + 84.8;
const TOWER_TOP = TOWER_Y + 84.8;
const NACELLE_Y = TOWER_TOP + 12;
const NACELLE_X = WIND_DECK[0] + 11.2;
const HUB_X = NACELLE_X + 25.2;

function guardArc(n, side) {
  // side +1 rises from the +z leg, -1 from the -z leg. The arc's foot
  // (local 50, -2, 63) laps the top of its leg; mirroring the basis on the
  // far side keeps the two half-laps complementary.
  return {
    id: `W11#${n}`,
    basis: side > 0 ? ['+z', '-x', '-y'] : ['-z', '+x', '-y'],
    pos: [LEG_X, LEG_Y + 69 - 7.8 + 63, side * (LEG_Z - 50)],
    step: 'guard', from: [0, 140, side * 60],
  };
}

function blade(n, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  const r = [0, Math.cos(a), Math.sin(a)];
  const ax = [1, 0, 0];
  const t = [ax[1] * r[2] - ax[2] * r[1], ax[2] * r[0] - ax[0] * r[2], ax[0] * r[1] - ax[1] * r[0]];
  const hub = [HUB_X + 7.5, NACELLE_Y, 0];
  return {
    id: `W26#${n}`, basis: [t, ax, r], pre: n === 2 ? 90 : 0,
    pos: add(hub, scale(r, 46.4 + 9)), step: 'rotor', rotor: true,
    from: add(scale(r, 60), [80, 0, 0]),
  };
}

const WIND_PARTS_LOCAL = [
  { id: 'W01', basis: ['+x', '+y', '+z'], pos: [0, 0, 0], step: 'base', from: [0, 0, 0] },
  ...[[1, 82.7, 116.6], [2, 82.7, -116.6], [3, -82.7, 116.6], [4, -82.7, -116.6]].map(([n, x, z]) => ({
    id: `W13#${n}`, basis: ['+x', '+y', '+z'], pos: [x, FOOT_Y, z], step: 'feet', from: [0, -70, 0],
  })),
  { id: 'W06', basis: ['+x', '+y', '+z'], pos: [-52, TRAY_Y, 0], step: 'inside', from: [0, 150, 0] },
  ...[1, 2, 3, 4].map((n, i) => ({
    id: `W12#${n}`, basis: ['+y', '-x', '+z'], pos: [-8, -28 + 3.7, -75 + i * 50], step: 'inside',
    from: [0, 130, 0],
  })),
  { id: 'W07', basis: ['-z', '+y', '+x'], pos: WIND_DECK, step: 'deck', from: [0, 170, 0] },
  { id: 'W07C#1', basis: ['-z', '+y', '+x'], pre: 90, pos: [WIND_DECK[0], -15, 78], step: 'deck', from: [0, 150, 0] },
  { id: 'W07C#2', basis: ['+z', '+y', '-x'], pos: [WIND_DECK[0], -15, -78], step: 'deck', from: [0, 150, 0] },

  { id: 'W04', basis: ['-z', '+x', '-y'], pos: [86.5, PANEL_TALL_Y, 0], step: 'walls', from: [110, 0, 0] },
  { id: 'W05', basis: ['+y', '-x', '+z'], pos: [-86.5, PANEL_SHORT_Y, 0], step: 'walls', from: [-110, 0, 0] },
  { id: 'W02A', basis: ['+x', '+z', '-y'], pos: [34.7, PANEL_TALL_Y, 120], step: 'walls', from: [0, 0, 110] },
  { id: 'W03A', basis: ['-x', '-z', '-y'], pos: [34.7, PANEL_TALL_Y, -120], step: 'walls', from: [0, 0, -110] },
  { id: 'W02B', basis: ['+x', '+z', '-y'], pos: [-50.3, PANEL_SHORT_Y, 120], step: 'walls', from: [0, 0, 110] },
  { id: 'W03B', basis: ['-x', '-z', '-y'], pos: [-50.3, PANEL_SHORT_Y, -120], step: 'walls', from: [0, 0, -110] },

  { id: 'W08', basis: ['+x', '+y', '+z'], pos: [WIND_RIM_X, RIM_Y, 0], step: 'rim', from: [0, 120, 0] },
  { id: 'W09', basis: ['+x', '-y', '-z'], pos: [-55.6, COVER_Y, 0], step: 'cover', from: [-30, 110, 0] },
  ...[[1, 116.6], [2, -116.6]].map(([n, z]) => ({
    id: `W14#${n}`, basis: ['+x', '-y', '-z'], pos: [-82.7, KNOB_Y, z], step: 'cover', from: [0, 90, 0],
  })),

  // Generator: clamp and sleeve on the deck, tower, nacelle, rotor.
  { id: 'W07T', basis: ['+x', '+y', '+z'], pos: [WIND_DECK[0], CLAMP_Y, 0], step: 'tower', device: true, from: [0, 140, 0] },
  { id: 'W07S', basis: ['+x', '+y', '+z'], pos: [WIND_DECK[0], SLEEVE_Y, 0], step: 'tower', device: true, from: [0, 180, 0] },
  { id: 'W20', basis: ['+x', '+y', '+z'], pos: [WIND_DECK[0], TOWER_Y, 0], step: 'tower', device: true, from: [0, 230, 0] },
  // Nacelle: main axis (local y) along the wind, tower socket (local -z) down.
  { id: 'W21', basis: ['-z', '-x', '+y'], pos: [NACELLE_X, NACELLE_Y, 0], step: 'nacelle', device: true, yaw: true, from: [0, 120, 0] },
  { id: 'W22', basis: ['-z', '-x', '+y'], pos: [NACELLE_X - 25.2 - 10, NACELLE_Y, 0], step: 'nacelle', device: true, yaw: true, from: [-80, 0, 0] },
  // Hub stack along +x: rear half, blades, front half, spinner.
  { id: 'W23', basis: ['-y', '+x', '+z'], pos: [HUB_X + 3.8, NACELLE_Y, 0], step: 'rotor', rotor: true, from: [60, 0, 0] },
  blade(1, 90), blade(2, 210), blade(3, 330),
  { id: 'W24', basis: ['-y', '+x', '+z'], pos: [HUB_X + 11.3, NACELLE_Y, 0], step: 'rotor', rotor: true, from: [100, 0, 0] },
  { id: 'W25', basis: ['-y', '+x', '+z'], pos: [HUB_X + 18.7, NACELLE_Y, 0], step: 'rotor', rotor: true, from: [130, 0, 0] },

  // Guard: two legs in the front sockets, two arcs, the crown.
  { id: 'W10#1', basis: ['+z', '-x', '-y'], pos: [LEG_X, LEG_Y, LEG_Z], step: 'guard', from: [0, 120, 40] },
  { id: 'W10#2', basis: ['-z', '+x', '-y'], pos: [LEG_X, LEG_Y, -LEG_Z], step: 'guard', from: [0, 120, -40] },
  guardArc(1, 1), guardArc(2, -1),
  { id: 'W15', basis: ['+x', '+y', '+z'], pos: [LEG_X, LEG_Y + 69 - 7.8 + 63 + 65.2, 0], step: 'guard', from: [0, 120, 0] },
];

/** The wind base faces +x; turn it so its front faces +z like the solar box. */
const turn = (v) => [-v[2], v[1], v[0]];
const turnBasis = (b) => basisOf(b).map(turn);
/** Pivots the runtime animates about, in the turned (front = +z) frame, mm. */
export const WIND_PIVOTS = {
  tower: turn([WIND_DECK[0], 0, 0]),
  hub: turn([HUB_X, NACELLE_Y, 0]),
  rotorAxis: turn([1, 0, 0]),
  hubHeight: NACELLE_Y,
};

export const WIND_PARTS = WIND_PARTS_LOCAL.map((p) => ({
  ...p,
  basis: turnBasis(p.basis),
  pos: turn(p.pos),
  from: turn(p.from),
}));

// ===========================================================================
// assembly sequence
// ===========================================================================
export const STEPS = {
  solar: [
    { key: 'base', kk: 'Негіз (S01) үстелге қойылады', en: 'Base on the table' },
    { key: 'feet', kk: 'Төрт тайғанақ емес аяқ (S13) астына бекітіледі', en: 'Four anti-slip feet' },
    { key: 'inside', kk: 'Электроника науасы (S06) мен кабель қысқыштары (S12)', en: 'Electronics tray and cable clips' },
    { key: 'deck', kk: 'Т-ойықты монтаж тақтасы (S07) және 4 қысқыш (S07C)', en: 'T-slot deck and lip clamps' },
    { key: 'device', kk: 'Күн трекері тақтаның ортасына орнатылады', en: 'Sun tracker on the deck' },
    { key: 'walls', kk: 'Алты қабырға панелі тіректердің ойықтарына сырғытылады', en: 'Wall panels slide into the post slots' },
    { key: 'rim', kk: 'Ұялары бар жоғарғы жиек (S08) тіректерге кигізіледі', en: 'Top rim on the post pins' },
    { key: 'cover', kk: 'Электроника қақпағы (S09) және екі бұранда (S14)', en: 'Bay cover and thumb knobs' },
    { key: 'ribs', kk: '«Күн жолы» төрт доғасы (S10) ұяларға кіргізіледі', en: 'Four sun-path ribs' },
    { key: 'hub', kk: '«Күн» қақпағы (S11) доғаларды төбеде біріктіреді', en: 'Sun hub locks the ribs' },
  ],
  wind: [
    { key: 'base', kk: 'Негіз (W01) үстелге қойылады', en: 'Base on the table' },
    { key: 'feet', kk: 'Төрт тайғанақ емес аяқ (W13)', en: 'Four anti-slip feet' },
    { key: 'inside', kk: 'Электроника науасы (W06) мен кабель қысқыштары (W12)', en: 'Electronics tray and cable clips' },
    { key: 'deck', kk: 'Монтаж тақтасы (W07) және қысқыштар (W07C)', en: 'Deck and lip clamps' },
    { key: 'tower', kk: 'Мұнара қамыты (W07T), төлке (W07S) және мұнара (W20)', en: 'Tower clamp, sleeve and tower' },
    { key: 'nacelle', kk: 'Генератор корпусы (W21) мен артқы қақпақ (W22)', en: 'Nacelle and tail cap' },
    { key: 'rotor', kk: 'Ротор: втулка (W23/W24), үш қалақ (W26), конус (W25)', en: 'Rotor: hub, three blades, spinner' },
    { key: 'walls', kk: 'Алты қабырға панелі ойықтарға сырғытылады', en: 'Wall panels into the slots' },
    { key: 'rim', kk: 'Жоғарғы жиек (W08)', en: 'Top rim' },
    { key: 'cover', kk: 'Электроника қақпағы (W09) және бұрандалар (W14)', en: 'Bay cover and knobs' },
    { key: 'guard', kk: 'Қорғаныс доғасы: екі тірек (W10), екі доға (W11), төбе (W15)', en: 'Guard arch: legs, arcs, crown' },
  ],
};
