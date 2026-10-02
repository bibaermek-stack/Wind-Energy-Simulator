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
// shared numbers -- measured from the printed geometry
// (scripts/verify-stem.mjs checks every pose against it)
// ---------------------------------------------------------------------------
/** Floor of the wall grooves in both bases. */
const GROOVE_FLOOR = -30;
const RIM_Y = 45.5;          // rim plate (local y -11.5) rests on the post tops at y = 34
const DECK_Y = -12.5;        // deck (7 mm) rests on the floor bosses, top y = -16
/**
 * The deck's top face (border and T-slot lands) is at DECK_Y + 3.5; the
 * slots between the lands are 2.8 mm deeper. Devices and clamps stand on
 * the lands.
 */
const DECK_TOP = DECK_Y + 3.5;
/** Electronics tray on the four bay standoffs (top y = -22). */
const TRAY_Y = -22 + 3.75;
const FLOOR_TOP = -28;
const FOOT_Y = -38;
const COVER_Y = 37.5;
const KNOB_Y = 44.5;

const DOWN = [0, -1, 0];

/**
 * A wall panel whose 3 mm body is centred on its groove line, standing on
 * the groove floor.
 *
 * Panel bodies are not centred on their print origin: the lettering and
 * relief stand proud of the outer (+y) face, so the body runs from
 * `body[0]` to `body[1]` in local y. Without this correction every panel
 * sat 0.3-0.4 mm off its groove and cut into the posts.
 */
function wallPanel({ id, basis, along, groove, height, body, from }) {
  const b = basisOf(basis);
  const mid = (body[0] + body[1]) / 2;
  const target = [along[0], GROOVE_FLOOR + height / 2, along[1]];
  if (groove.x != null) target[0] = groove.x;
  if (groove.z != null) target[2] = groove.z;
  const pos = target.map((c, i) => c - b[1][i] * mid);
  return { id, basis, pos, step: 'walls', from };
}

const BODY_A = [-1.8, 1.2];   // tracker/turbine-zone sides and rear
const BODY_LABEL = [-1.9, 1.1]; // the front panels with raised lettering
const BODY_B = [-1.5, 1.5];   // electronics-bay sides
const TALL = 65.4;
const SHORT = 63.4;

/**
 * A deck lip clamp: stands on the deck's raised border with its upper
 * half overhanging the deck edge. `n` is the outward edge normal.
 */
function lipClamp(id, deckCentre, halfSpan, n, pre = 0) {
  const basisByNormal = {
    '0,1': ['+y', '-x', '+z'],
    '0,-1': ['+y', '+x', '-z'],
    '1,0': ['+y', '+z', '+x'],
    '-1,0': ['+y', '-z', '-x'],
  };
  const reach = halfSpan - 4.4;
  return {
    id,
    basis: basisByNormal[`${n[0]},${n[1]}`],
    pre,
    pos: [deckCentre[0] + n[0] * reach, DECK_TOP + 3.15, deckCentre[2] + n[1] * reach],
    step: 'deck',
    from: [0, 150, 0],
  };
}

// ===========================================================================
// TRACKING SOLAR
// ===========================================================================
/** Post pins at (+-83, 116.49) and (+-83, -49.51); rim holes at (+-83, 83.12 / -82.88). */
const SOLAR_RIM_Z = 33.37;
const SOLAR_SOCKETS = [[83, 83.12], [-83, 83.12], [83, -82.88], [-83, -82.88]];
const SOLAR_RIB_SHOULDER_Y = RIM_Y + 11.5; // top of the rim sockets
const RIB_TENON_X = 51.69;
const RIB_SHOULDER_Z = 69;

function solarRib(i) {
  const [sx, sz] = SOLAR_SOCKETS[i - 1];
  const d = dir(sx, sz);
  // local x -> outward along the diagonal, local z -> down, y completes it.
  const basis = [d, [-d[2], 0, d[0]], DOWN];
  // Tenon centre (51.69, 0, 69) lands on the socket centre.
  const socket = [sx, 0, SOLAR_RIM_Z + sz];
  const pos = add(add(socket, scale(d, -RIB_TENON_X)), [0, SOLAR_RIB_SHOULDER_Y + RIB_SHOULDER_Z, 0]);
  return {
    id: `S10#${i}`, basis, pos, step: 'ribs',
    from: add(scale(d, 140), [0, 120, 0]),
  };
}

/** The ribs' upper ends span y 192.5..203.3; the hub's slots are 10.8 deep. */
const SOLAR_HUB_Y = SOLAR_RIB_SHOULDER_Y + RIB_SHOULDER_Z + 66.51 + 9.24;

/** Deck centre, on the deck's top face, where the tracker stands. */
export const SOLAR_DECK = { centre: [0, DECK_TOP, 33.5] };

const SOLAR_DECK_C = [0, DECK_Y, 33.5];

export const SOLAR_PARTS = [
  { id: 'S01', basis: ['+x', '+y', '+z'], pos: [0, 0, 0], step: 'base', from: [0, 0, 0] },
  ...[[1, 83, 116.49], [2, -83, 116.49], [3, 83, -116.51], [4, -83, -116.51]].map(([n, x, z]) => ({
    id: `S13#${n}`, basis: ['+x', '+y', '+z'], pos: [x, FOOT_Y, z], step: 'feet', from: [0, -70, 0],
  })),
  { id: 'S06', basis: ['+z', '+y', '-x'], pos: [0, TRAY_Y, -85], step: 'inside', from: [0, 150, 0] },
  // Cable clips under the deck, along the partition, screw holes vertical.
  ...[1, 2, 3, 4].map((n, i) => ({
    id: `S12#${n}`, basis: ['+y', '+z', '+x'], pos: [[-59.5, -59.5, 59.5, 59.5][i], FLOOR_TOP + 3.7, [-45, 15, 15, -45][i]], step: 'inside',
    from: [0, 130, 0],
  })),
  { id: 'S07', basis: ['+x', '+y', '+z'], pos: SOLAR_DECK_C, step: 'deck', from: [0, 170, 0] },
  lipClamp('S07C#1', SOLAR_DECK_C, 75, [0, 1]),
  lipClamp('S07C#2', SOLAR_DECK_C, 75, [0, -1]),
  lipClamp('S07C#3', SOLAR_DECK_C, 75, [1, 0]),
  lipClamp('S07C#4', SOLAR_DECK_C, 75, [-1, 0]),

  // Walls: grooves at x = +-86.5, z = +-120.
  wallPanel({ id: 'S04', basis: ['+x', '+z', '-y'], along: [0, 0], groove: { z: 120 }, height: TALL, body: BODY_LABEL, from: [0, 0, 110] }),
  wallPanel({ id: 'S05', basis: ['-x', '-z', '-y'], along: [0, 0], groove: { z: -120 }, height: SHORT, body: BODY_A, from: [0, 0, -110] }),
  wallPanel({ id: 'S03A', basis: ['-z', '+x', '-y'], along: [0, 33.5], groove: { x: 86.5 }, height: TALL, body: BODY_A, from: [110, 0, 0] }),
  wallPanel({ id: 'S02A', basis: ['+y', '-x', '+z'], along: [0, 33.5], groove: { x: -86.5 }, height: TALL, body: BODY_A, from: [-110, 0, 0] }),
  wallPanel({ id: 'S03B', basis: ['-z', '+x', '-y'], along: [0, -85], groove: { x: 86.5 }, height: SHORT, body: BODY_B, from: [110, 0, 0] }),
  wallPanel({ id: 'S02B', basis: ['+z', '-x', '-y'], along: [0, -85], groove: { x: -86.5 }, height: SHORT, body: BODY_B, from: [-110, 0, 0] }),

  { id: 'S08', basis: ['+x', '+y', '+z'], pos: [0, RIM_Y, SOLAR_RIM_Z], step: 'rim', from: [0, 120, 0] },
  { id: 'S09', basis: ['+x', '-y', '-z'], pos: [0, COVER_Y, -90.1], step: 'cover', from: [0, 110, -30] },
  ...[[1, 83], [2, -83]].map(([n, x]) => ({
    id: `S14#${n}`, basis: ['+x', '-y', '-z'], pos: [x, KNOB_Y, -116.51], step: 'cover', from: [0, 90, 0],
  })),

  solarRib(1), solarRib(2), solarRib(3), solarRib(4),
  { id: 'S11', basis: ['+x', '+y', '+z'], pos: [0, SOLAR_HUB_Y, SOLAR_RIM_Z], step: 'hub', from: [0, 110, 0] },
];

// ===========================================================================
// WIND GENERATOR -- built in the base's own frame (front = +x), then the
// whole box is turned so its front faces the camera like the solar box.
// ===========================================================================
/** Post pins at (82.49 / -15.51, +-117); rim holes at (48.92 / -49.08, +-117). */
const WIND_RIM_X = 33.57;
const WIND_DECK = [32.5, DECK_Y, 0];
/** Guard sockets on the rim, front corners. */
const LEG_X = 82.49;
const LEG_Z = 117;
const LEG_Y = RIM_Y + 11.5 + 57; // shoulder (local z 57) on the socket tops

/**
 * Tower stack. The clamp (W07T) is a flange and a split collar with a
 * 32.5 mm bore, standing on the deck. The sleeve (W07S) drops into the
 * collar upside down, so its 2 mm flange rests on the collar's top edge.
 * The tower passes through the sleeve down to the deck.
 */
const CLAMP_Y = DECK_TOP + 20;
const CLAMP_TOP = CLAMP_Y + 20;
/** The clamp's floor (local y -14.9) has a 7 mm hole; the tower stands on it. */
const CLAMP_FLOOR = CLAMP_Y - 14.9;
const SLEEVE_Y = CLAMP_TOP + 2 - 18.5;
const TOWER_Y = CLAMP_FLOOR + 84.8;
const TOWER_TOP = TOWER_Y + 84.8;
/**
 * The nacelle's tower socket (r 10.2, axis local z) bottoms out at local
 * z -7.25 and sits at local y 11.2. Its motor tube is NOT on the print
 * origin: the tube axis runs along local y at local z +8.2, so the hub,
 * the tail cap and the rotor all sit 8.2 mm above the nacelle's origin.
 */
const NACELLE_Y = TOWER_TOP + 7.25;
const NACELLE_X = WIND_DECK[0] + 11.2;
const AXIS_Y = NACELLE_Y + 8.2;
const HUB_X = NACELLE_X + 25.2;
/** The cap's plug shoulder (local y -8.5) meets the tube's open end. */
const CAP_X = NACELLE_X - 25.25 - 8.5;

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

/**
 * A rotor blade. Its root is a D-section pin (r 4) on local z at local
 * x = 6, ending in a T-tab whose outer face (local z -46.4) sits at r 6.3
 * in the hub's T-pockets. The pin axis lies in the plane where the two
 * hub halves meet; the pockets are at 0, 120 and 240 degrees.
 */
/**
 * Each half's pin groove (r 4.06) is centred 0.17 mm outside its face, so
 * the halves close on the pins with a 0.34 mm gap between them; the pin
 * axes lie in the middle of that gap.
 */
const HUB_GAP = 0.34;
const HUB_MATE_X = HUB_X + 7.5 + HUB_GAP / 2;
const BLADE_ROOT_R = 6.3 + 46.4;
/** Pin axis in the blade's print frame (circle fit of the root section). */
const BLADE_PIN_X = 6.04;
const BLADE_PIN_Y = -0.5;


function blade(n, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  const r = [0, Math.cos(a), Math.sin(a)];
  const ax = [1, 0, 0];
  const t = [ax[1] * r[2] - ax[2] * r[1], ax[2] * r[0] - ax[0] * r[2], ax[0] * r[1] - ax[1] * r[0]];
  const hub = [HUB_MATE_X, AXIS_Y, 0];
  // The pin axis lands on the radial line, in the hub's mating plane.
  return {
    id: `W26#${n}`, basis: [t, ax, r], pre: n === 2 ? 90 : 0,
    pos: add(add(add(hub, scale(r, BLADE_ROOT_R)), scale(t, -BLADE_PIN_X)), scale(ax, -BLADE_PIN_Y)),
    step: 'rotor', rotor: true,
    from: add(scale(r, 60), [80, 0, 0]),
  };
}

const WIND_PARTS_LOCAL = [
  { id: 'W01', basis: ['+x', '+y', '+z'], pos: [0, 0, 0], step: 'base', from: [0, 0, 0] },
  ...[[1, 82.49, 117], [2, 82.49, -117], [3, -82.51, 117], [4, -82.51, -117]].map(([n, x, z]) => ({
    id: `W13#${n}`, basis: ['+x', '+y', '+z'], pos: [x, FOOT_Y, z], step: 'feet', from: [0, -70, 0],
  })),
  { id: 'W06', basis: ['+x', '+y', '+z'], pos: [-52, TRAY_Y, 0], step: 'inside', from: [0, 150, 0] },
  ...[1, 2, 3, 4].map((n, i) => ({
    id: `W12#${n}`, basis: ['+y', '-x', '+z'], pos: [[-8, -3.5, -8, -8][i], FLOOR_TOP + 3.7, -75 + i * 50], step: 'inside',
    from: [0, 130, 0],
  })),
  { id: 'W07', basis: ['-z', '+y', '+x'], pos: WIND_DECK, step: 'deck', from: [0, 170, 0] },
  lipClamp('W07C#1', WIND_DECK, 75, [0, 1], 90),
  lipClamp('W07C#2', WIND_DECK, 75, [0, -1]),

  // Walls: grooves at x = +-86.0, z = +-120.5.
  wallPanel({ id: 'W04', basis: ['-z', '+x', '-y'], along: [0, 0], groove: { x: 86 }, height: TALL, body: BODY_LABEL, from: [110, 0, 0] }),
  wallPanel({ id: 'W05', basis: ['+y', '-x', '+z'], along: [0, 0], groove: { x: -86 }, height: SHORT, body: BODY_A, from: [-110, 0, 0] }),
  wallPanel({ id: 'W02A', basis: ['+x', '+z', '-y'], along: [33.95, 0], groove: { z: 120.5 }, height: TALL, body: BODY_A, from: [0, 0, 110] }),
  wallPanel({ id: 'W03A', basis: ['-x', '-z', '-y'], along: [33.95, 0], groove: { z: -120.5 }, height: TALL, body: BODY_A, from: [0, 0, -110] }),
  wallPanel({ id: 'W02B', basis: ['+x', '+z', '-y'], along: [-50.3, 0], groove: { z: 120.5 }, height: SHORT, body: BODY_B, from: [0, 0, 110] }),
  wallPanel({ id: 'W03B', basis: ['-x', '-z', '-y'], along: [-50.3, 0], groove: { z: -120.5 }, height: SHORT, body: BODY_B, from: [0, 0, -110] }),

  { id: 'W08', basis: ['+x', '+y', '+z'], pos: [WIND_RIM_X, RIM_Y, 0], step: 'rim', from: [0, 120, 0] },
  // Flipped about z, not x: this cover's rebate runs along its long side.
  { id: 'W09', basis: ['-x', '-y', '+z'], pos: [-55.6, COVER_Y, 0], step: 'cover', from: [-30, 110, 0] },
  ...[[1, 117], [2, -117]].map(([n, z]) => ({
    id: `W14#${n}`, basis: ['+x', '-y', '-z'], pos: [-82.51, KNOB_Y, z], step: 'cover', from: [0, 90, 0],
  })),

  // Generator: clamp and sleeve on the deck, tower, nacelle, rotor.
  { id: 'W07T', basis: ['+x', '+y', '+z'], pos: [WIND_DECK[0], CLAMP_Y, 0], step: 'tower', device: true, from: [0, 140, 0] },
  { id: 'W07S', basis: ['+x', '-y', '-z'], pos: [WIND_DECK[0], SLEEVE_Y, 0], step: 'tower', device: true, from: [0, 180, 0] },
  { id: 'W20', basis: ['+x', '+y', '+z'], pos: [WIND_DECK[0], TOWER_Y, 0], step: 'tower', device: true, from: [0, 230, 0] },
  // Nacelle: main axis (local y) along the wind, tower socket (local -z) down.
  { id: 'W21', basis: ['-z', '-x', '+y'], pos: [NACELLE_X, NACELLE_Y, 0], step: 'nacelle', device: true, yaw: true, from: [0, 120, 0] },
  { id: 'W22', basis: ['-z', '-x', '+y'], pos: [CAP_X, AXIS_Y, 0], step: 'nacelle', device: true, yaw: true, from: [-80, 0, 0] },
  // Hub stack along +x: rear half, blades, front half, spinner.
  { id: 'W23', basis: ['-y', '+x', '+z'], pos: [HUB_X + 3.8, AXIS_Y, 0], step: 'rotor', rotor: true, from: [60, 0, 0] },
  blade(1, 0), blade(2, 120), blade(3, 240),
  // The front half faces the rear one, pockets to pockets. Its pockets are
  // printed at 90/210/330 degrees, so it is also turned -90 about the axis.
  { id: 'W24', basis: ['-z', '-x', '+y'], pos: [HUB_X + 11.25 + HUB_GAP, AXIS_Y, 0], step: 'rotor', rotor: true, from: [100, 0, 0] },
  { id: 'W25', basis: ['-y', '+x', '+z'], pos: [HUB_X + 18.7 + HUB_GAP, AXIS_Y, 0], step: 'rotor', rotor: true, from: [130, 0, 0] },

  // Guard: two legs in the front sockets, two arcs, the crown.
  // Each leg's half-lap faces the opposite way from its arc's.
  { id: 'W10#1', basis: ['-z', '+x', '-y'], pos: [LEG_X, LEG_Y, LEG_Z], step: 'guard', from: [0, 120, 40] },
  { id: 'W10#2', basis: ['+z', '-x', '-y'], pos: [LEG_X, LEG_Y, -LEG_Z], step: 'guard', from: [0, 120, -40] },
  guardArc(1, 1), guardArc(2, -1),
  // The crown's two pockets open along its local -x and take the arcs'
  // ends from below; its bolt holes (local x) are then vertical like the
  // arcs', and the wave lettering faces the front.
  { id: 'W15', basis: ['+y', '+x', '-z'], pos: [LEG_X + 0.35, LEG_Y + 69 - 7.8 + 63 + 65.2 + 3, 0], step: 'guard', from: [0, 120, 0] },
];

/** The wind base faces +x; turn it so its front faces +z like the solar box. */
const turn = (v) => [-v[2], v[1], v[0]];
const turnBasis = (b) => basisOf(b).map(turn);
/** Pivots the runtime animates about, in the turned (front = +z) frame, mm. */
export const WIND_PIVOTS = {
  tower: turn([WIND_DECK[0], 0, 0]),
  hub: turn([HUB_X, AXIS_Y, 0]),
  rotorAxis: turn([1, 0, 0]),
  hubHeight: AXIS_Y,
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
