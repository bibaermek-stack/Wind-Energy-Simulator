/**
 * The three solar panels, and the site they stand on.
 *
 * ---------------------------------------------------------------------------
 * WHY THREE PANELS
 * ---------------------------------------------------------------------------
 * They differ in ONE thing that matters: how their orientation is decided.
 *
 *   auto    a two-axis tracker that follows the sun
 *   manual  whatever tilt and azimuth the user dials in
 *   fixed   bolted at 35 degrees facing south, never moves
 *
 * All three see the same sun, the same sky and the same weather, and all
 * three are integrated every frame, so the difference in their output is
 * attributable to the control mechanism alone.
 *
 * ---------------------------------------------------------------------------
 * ON THE THREE DIFFERENT MOUNTS
 * ---------------------------------------------------------------------------
 * They are three different products cut from the supplied catalogue,
 * chosen to match the three installation types in the reference
 * photographs: a compact array on a pole (the tracker), a wide array on
 * adjustable legs, and a low fixed ground row.
 *
 * Only the tracker's mount is not from the catalogue. The catalogue has no
 * pole-mounted tracker -- every assembly in it is a ground frame -- so its
 * column and pivot head are generated and its modules are the supplied
 * geometry moved onto them. Nothing else in any of the three is drawn.
 *
 * They therefore have genuinely different collecting areas -- 6.54, 13.09
 * and 9.61 m^2. That means raw watts are NOT a fair comparison between them:
 * a bigger panel produces more for reasons that have nothing to do with
 * tracking.
 *
 * So the interface reports SPECIFIC YIELD -- watts per square metre of
 * aperture -- beside the absolute figure. Specific yield divides the area
 * back out, leaving only the effect of orientation, which is exactly the
 * quantity this module exists to teach. Absolute watts still answer the
 * other real question: how much electricity does this installation make.
 *
 * ---------------------------------------------------------------------------
 * ON THE PARAMETERS
 * ---------------------------------------------------------------------------
 * Aperture areas and dimensions are MEASURED from the actual geometry by
 * scripts/segment-solar.mjs (coverage measurement -- see that file for why
 * a sum of triangle areas is wrong on this model). Efficiency, temperature
 * coefficient, NOCT and inverter efficiency are EXAMPLE values typical of a
 * modern monocrystalline installation; the catalogue arrived without a
 * datasheet. The interface says so wherever they appear.
 */

/** Where the installation is. Astana, Kazakhstan. */
export const SITE = {
  latitude: 51.1,
  longitude: 71.4,
  name: { kk: 'Астана', en: 'Astana' },

  /**
   * Day of year used for the sun's path. 81 is the March equinox, chosen
   * deliberately: at this latitude the sun then rises at almost exactly
   * 06:00 and sets at almost exactly 18:00, so the time slider spans one
   * complete solar day end to end, and the panels really do reach zero
   * output at both ends of their travel.
   */
  dayOfYear: 81,
};

export const SOLAR_CONSTANT = 1367;
export const STC_IRRADIANCE = 1000;
export const STC_TEMPERATURE = 25;

export const TIME_MIN = 6;
export const TIME_MAX = 18;
export const TIME_DEFAULT = 12;

export const TILT_MIN = 0;
export const TILT_MAX = 90;
export const TILT_DEFAULT = 35;

export const AZIMUTH_MIN = 0;
export const AZIMUTH_MAX = 360;
/** Due south -- the optimum fixed orientation in the northern hemisphere. */
export const AZIMUTH_DEFAULT = 180;

/** Panel 3 is bolted here and never moves. */
export const FIXED_TILT = 35;
export const FIXED_AZIMUTH = 180;

export const CLOUD_DEFAULT = 0;
export const TEMPERATURE_DEFAULT = 20;
export const TEMPERATURE_MIN = -10;
export const TEMPERATURE_MAX = 45;

/** Electrical parameters shared by all three panels. */
const COMMON = {
  efficiency: 0.20,
  temperatureCoefficient: -0.004,
  noct: 45,
  inverterEfficiency: 0.96,
  soilingFactor: 0.97,
  /** Degrees per second. Real trackers are slow. */
  trackingSlewRate: 9,
};

/** Rated DC power follows from aperture and efficiency at STC. */
const rated = (apertureArea) => Math.round(apertureArea * STC_IRRADIANCE * COMMON.efficiency);

/**
 * @typedef {'auto'|'manual'|'fixed'} PanelMode
 */

export const SOLAR_PANELS = [
  {
    id: 'auto',
    order: 1,
    mode: /** @type {PanelMode} */ ('auto'),
    accent: '#b45309',

    name: { kk: 'Панель 1 — автотрекер', en: 'Panel 1 — Auto tracker' },
    shortName: { kk: 'Автотрекер', en: 'Auto' },
    typeCode: 'AUTO',
    typeLabel: {
      kk: 'Екі осьті автоматты бақылау жүйесі',
      en: 'Two-axis automatic sun tracker',
    },
    description: {
      kk: 'Күннің азимуты мен биіктігін үздіксіз есептеп, панельді соған '
        + 'қаратып отырады. Мақсаты — түсу бұрышын нөлге жақын ұстау, '
        + 'сонда cos θ ≈ 1 болады да, панель мүмкін радиацияның барлығын '
        + 'қабылдайды.',
      en: 'Continuously computes the sun’s azimuth and altitude and '
        + 'aims the array at it, holding the incidence angle near zero so '
        + 'cos θ stays close to 1 and the panel collects all it can.',
    },

    // The modules are assembly #5 from the catalogue, on a pedestal built
    // by scripts/segment-solar.mjs.
    //
    // The catalogue has no pole-mounted tracker in it -- all nine of its
    // assemblies are ground frames -- so the column and pivot head are
    // generated, and only those. The array itself is the supplied
    // geometry, lifted off its original frame and set on top. See the
    // "generated pole mount" section of that script for why every part of
    // the column is a surface of revolution.
    apertureArea: 6.54,       // measured, unchanged by the re-mount
    widthM: 1.96,
    depthM: 3.22,
    // Standing height at the steepest tilt the slider allows: the pivot at
    // 2.06 m plus half the array's slope length swung vertical.
    heightM: 3.67,
    moduleCount: 4,
    ...COMMON,
    ratedPower: rated(6.54),

    scene: {
      modelUrl: '/models/solar-auto.glb',
      position: [38, 0, 45],
      rotationY: 0,
      // Clears the array's top edge at 90 degrees, so the label never ends
      // up behind the panel it belongs to.
      labelHeight: 4.1,
    },
  },

  {
    id: 'manual',
    order: 2,
    mode: /** @type {PanelMode} */ ('manual'),
    accent: '#1d4ed8',

    name: { kk: 'Панель 2 — қолмен реттелетін', en: 'Panel 2 — Manual' },
    shortName: { kk: 'Қолмен', en: 'Manual' },
    typeCode: 'MANUAL',
    typeLabel: {
      kk: 'Бұрыштары қолмен реттелетін',
      en: 'User-set tilt and azimuth',
    },
    description: {
      kk: 'Бұрыштарын пайдаланушы өзі таңдайды. Күн жылжыған сайын бұл '
        + 'панель орнында қалады, сондықтан оңтайлы бұрышты тәжірибе '
        + 'жасап табу керек — таңертеңгі ең жақсы бұрыш кешке жарамсыз '
        + 'болады.',
      en: 'You set the angles yourself. It stays where you put it as the '
        + 'sun moves, so the optimum has to be found by experiment -- and '
        + 'the best morning angle is the wrong evening one.',
    },

    // Assembly #1: a wide array on legs with a rear brace -- the
    // adjustable-tilt ground mount of the reference photographs, and the
    // natural one to put under hand control.
    apertureArea: 13.09,      // measured
    widthM: 4.27,
    depthM: 2.69,
    heightM: 2.18,
    moduleCount: 8,
    ...COMMON,
    ratedPower: rated(13.09),

    scene: {
      modelUrl: '/models/solar-manual.glb',
      position: [45, 0, 45],
      rotationY: 0,
      labelHeight: 3.8,
    },
  },

  {
    id: 'fixed',
    order: 3,
    mode: /** @type {PanelMode} */ ('fixed'),
    accent: '#0d9488',

    name: { kk: 'Панель 3 — бекітілген', en: 'Panel 3 — Fixed' },
    shortName: { kk: 'Бекітілген', en: 'Fixed' },
    typeCode: 'FIXED',
    typeLabel: {
      kk: `Тұрақты бұрыш — ${FIXED_TILT}° / ${FIXED_AZIMUTH}°`,
      en: `Fixed at ${FIXED_TILT}° / ${FIXED_AZIMUTH}°`,
    },
    description: {
      kk: 'Бұрышы өзгермейді: еңкею 35°, азимут 180° (оңтүстік). Бұл — '
        + 'дүние жүзінде ең көп таралған орнату тәсілі және салыстыру '
        + 'үшін эталон. Тал түсте ол дерлік оңтайлы, бірақ таңертең мен '
        + 'кешке көп ұтылады.',
      en: 'Its angle never changes: 35° tilt, due south. This is the most '
        + 'common installation in the world and the reference the other '
        + 'two are measured against -- near-optimal at noon, and losing '
        + 'badly at both ends of the day.',
    },

    apertureArea: 9.61,       // measured
    widthM: 5.41,
    depthM: 1.54,
    heightM: 1.87,
    moduleCount: 6,
    ...COMMON,
    ratedPower: rated(9.61),

    scene: {
      modelUrl: '/models/solar-fixed.glb',
      position: [53, 0, 45],
      rotationY: 0,
      labelHeight: 2.9,
    },
  },
];

export const PANEL_BY_ID = Object.fromEntries(SOLAR_PANELS.map((p) => [p.id, p]));
export const PANEL_IDS = SOLAR_PANELS.map((p) => p.id);

/** Combined rating of the whole installation, W. */
export const TOTAL_RATED_POWER = SOLAR_PANELS.reduce((sum, p) => sum + p.ratedPower, 0);

/** Where the camera sits to frame all three. */
/**
 * Where the camera sits to frame all three.
 *
 * The three are set in a row at equal depth so they subtend the same
 * angle -- placed at different distances they read as different sizes,
 * which is exactly the misreading this module is trying to avoid.
 */
export const SOLAR_VIEW = {
  // Pulled back far enough that the whole row clears the two instrument
  // rails, which together cover about 40% of the viewport width, and kept
  // low so the arrays are seen roughly the way the reference photographs
  // were taken rather than from above.
  //
  // The look-at point sits above the middle panel's own centre: the tracker
  // on the left now stands over three metres tall at steep tilt, and aiming
  // at the row's geometric centre left it climbing out of the top of the
  // frame every morning and evening.
  cameraOffset: [2, 9, 27],
  target: [45.5, 2.4, 45],
};
