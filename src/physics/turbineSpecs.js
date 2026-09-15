/**
 * The three turbines.
 *
 * ---------------------------------------------------------------------------
 * ON THE PARAMETERS
 * ---------------------------------------------------------------------------
 * The rotor dimensions are MEASURED from the actual 3D models -- they are
 * whatever the geometry in the .glb files says. Everything else (rated
 * power, Cp, tip-speed ratio, cut-in/cut-out, efficiencies) is an EXAMPLE
 * parameter set: representative published figures for commercial machines
 * of each size class, not the specification of any particular product.
 * The models arrived without datasheets, so exact values are unknown and
 * these are declared as illustrative throughout the interface.
 *
 * Sources for the representative values: IEC 61400-1 class figures,
 * Manwell/McGowan/Rogers "Wind Energy Explained" ch. 3, and published
 * power curves for machines in the 1.5-2 MW, 50-60 kW and 0.5-1 kW classes.
 *
 * ---------------------------------------------------------------------------
 * ON THE SCENE BLOCK
 * ---------------------------------------------------------------------------
 * `scene.rotorNode` names the node inside the .glb that the runtime spins.
 * All three models ship their rotor as a separate node, so no mesh surgery
 * is needed -- but two of them need a pivot correction, because the rotor
 * geometry is authored in world coordinates with the node transform left
 * at identity. `scene.rotorPivot` is that correction: the world-space point
 * the rotor must turn about. See WindTurbine.jsx for how it is applied.
 *
 * Wind in this scene blows along -Z. The two upwind machines are modelled
 * facing +Z, so they need no yaw; the VAWT is omnidirectional by nature.
 */

/** @typedef {'horizontal'|'vertical'} RotorGeometry */

export const TURBINES = [
  {
    id: 'hawt',
    order: 1,
    accent: '#1d4ed8',
    modelUrl: '/models/hawt.glb',

    name: {
      kk: 'Көлденең осьті жел турбинасы',
      en: 'Horizontal Axis Wind Turbine',
    },
    shortName: { kk: 'Көлденең осьті', en: 'Horizontal Axis' },
    typeCode: 'HAWT',
    typeLabel: {
      kk: 'Үш қалақшалы, жел бағытына қарсы, айнымалы жылдамдықты',
      en: 'Three-bladed, upwind, variable speed',
    },
    description: {
      kk: 'Классикалық өнеркәсіптік жел турбинасы. Үш қалақшасы көлденең '
        + 'осьте айналады, гондола желдің бағытына бұрылады. Ең жоғары Cp '
        + 'осы түрде — қалақшалар көтеру күшімен (lift) жұмыс істейді.',
      en: 'The classical utility-scale machine. Three blades on a horizontal '
        + 'axis, with the nacelle yawing to face the wind. Highest Cp of the '
        + 'three, because the blades work on lift.',
    },

    rotor: {
      geometry: /** @type {RotorGeometry} */ ('horizontal'),
      diameter: 66.4,      // measured from the model: blade tips span 66.4 m
      bladeCount: 3,
    },
    hubHeight: 58.5,       // measured: top of the Post node

    // --- example operating parameters (1.8 MW class) ---
    ratedPower: 1_800_000,
    cpMax: 0.45,
    lambdaOptimal: 6.8,
    cutInSpeed: 3.0,
    cutOutSpeed: 25.0,
    etaDrivetrain: 0.97,   // gearbox + bearings
    etaGenerator: 0.96,    // DFIG + converter
    rotorInertiaTau: 6.0,  // s, first-order spin-up time constant

    scene: {
      position: [-95, 0, -18],
      scale: 1,
      rotationY: 0,
      rotorNode: 'Generator',
      rotorAxis: 'z',
      // Rotor geometry is authored in world space with an identity node
      // transform, so it must be re-pivoted onto the hub. Derived from the
      // blade-tip bounding box: hub_x = (xmin+xmax)/2, hub_y = ymax - R.
      rotorPivot: [-0.225, 58.46, 0],
      cameraOffset: [72, 48, 152],
      labelHeight: 100,
    },
  },

  {
    id: 'vawt',
    order: 2,
    accent: '#0d9488',
    modelUrl: '/models/vawt.glb',

    name: {
      kk: 'Тік осьті жел турбинасы',
      en: 'Vertical Axis Wind Turbine',
    },
    shortName: { kk: 'Тік осьті', en: 'Vertical Axis' },
    typeCode: 'VAWT',
    typeLabel: {
      kk: 'Darrieus H-роторы, үш тік қалақша',
      en: 'Darrieus H-rotor, three straight blades',
    },
    description: {
      kk: 'Тік осьті Darrieus H-роторы. Қалақшалары тік орналасқан және '
        + 'көлденең тіректермен тік білікке бекітілген. Желдің кез келген '
        + 'бағытында жұмыс істейді, бірақ Cp мәні төмендеу, себебі әр '
        + 'қалақшаның шабуыл бұрышы айналым бойында үнемі өзгереді.',
      en: 'A vertical-axis Darrieus H-rotor: straight blades held on '
        + 'horizontal arms around a vertical shaft. It accepts wind from any '
        + 'direction and needs no yaw system, but its Cp is lower because '
        + 'each blade’s angle of attack changes continuously through '
        + 'every revolution.',
    },

    rotor: {
      geometry: /** @type {RotorGeometry} */ ('vertical'),
      diameter: 11.13,     // measured: blade circle across the arms
      bladeHeight: 9.09,   // measured: vertical extent of the blades
      bladeCount: 3,
    },
    hubHeight: 36.9,       // measured: mid-height of the rotor

    // --- example operating parameters (55 kW class) ---
    ratedPower: 55_000,
    cpMax: 0.38,
    lambdaOptimal: 4.0,
    cutInSpeed: 3.5,
    cutOutSpeed: 22.0,
    etaDrivetrain: 0.95,   // direct-ish drive, fewer stages
    etaGenerator: 0.92,    // PMSG + converter
    rotorInertiaTau: 3.5,

    scene: {
      position: [15, 0, 6],
      scale: 1,
      rotationY: 0,
      rotorNode: 'PlanesHolder_27',
      rotorAxis: 'y',
      // This model's rotor node already carries the correct local origin,
      // so no pivot correction is needed.
      rotorPivot: null,
      // The small anemometer propeller on the mast head, spun for flavour.
      auxNode: 'HeliBlades_6',
      auxAxis: 'z',
      auxRatio: 3.5,
      cameraOffset: [27, 21, 74],
      labelHeight: 49,
    },
  },

  {
    id: 'small',
    order: 3,
    accent: '#b45309',
    modelUrl: '/models/small.glb',

    name: {
      kk: 'Шағын қуатты жел генераторы',
      en: 'Small-Scale Wind Turbine',
    },
    shortName: { kk: 'Шағын қуатты', en: 'Small-Scale' },
    typeCode: 'Small-scale',
    typeLabel: {
      kk: 'Тұрғын үйге арналған, құйрық қалақшасымен бағытталатын',
      en: 'Residential, tail-vane yawed',
    },
    description: {
      kk: 'Үйге немесе шағын зертханаға арналған ықшам жел генераторы. '
        + 'Гондоланың артындағы құйрық қалақшасы (tail vane) оны желге '
        + 'қаратып қояды. Қуаты өте төмен, себебі P ~ D² — диаметр 37 есе '
        + 'кіші болса, ауданы 1350 есе кіші.',
      en: 'A compact machine for a house or a teaching laboratory. The tail '
        + 'vane behind the nacelle weathercocks it into the wind. Its output '
        + 'is tiny because P scales with D²: a 37x smaller diameter '
        + 'means a 1350x smaller swept area.',
    },

    rotor: {
      geometry: /** @type {RotorGeometry} */ ('horizontal'),
      diameter: 1.8,       // by construction, see scripts/generate-small-turbine.mjs
      bladeCount: 3,
    },
    hubHeight: 9.85,

    // --- example operating parameters (800 W class) ---
    ratedPower: 800,
    cpMax: 0.35,
    lambdaOptimal: 6.5,
    cutInSpeed: 2.5,
    cutOutSpeed: 20.0,     // furling speed for this class
    etaDrivetrain: 0.95,   // direct drive
    etaGenerator: 0.85,    // small PMG + rectifier, notably less efficient
    rotorInertiaTau: 0.9,

    scene: {
      position: [56, 0, 16],
      scale: 1,
      rotationY: 0,
      rotorNode: 'Rotor',
      rotorAxis: 'z',
      rotorPivot: null,    // authored with its origin on the rotor axis
      cameraOffset: [7.5, 5.5, 18],
      labelHeight: 12.6,
    },
  },
];

/** Lookup by id, for the store and the comparison table. */
export const TURBINE_BY_ID = Object.fromEntries(TURBINES.map((t) => [t.id, t]));

export const TURBINE_IDS = TURBINES.map((t) => t.id);

/** Every model URL, for preloading. */
export const MODEL_URLS = TURBINES.map((t) => t.modelUrl);
