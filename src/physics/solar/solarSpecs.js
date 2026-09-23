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
 * ON THE THREE MOUNTS
 * ---------------------------------------------------------------------------
 * All three carry the SAME array: assembly #1 from the catalogue, eight
 * modules, 13.09 m^2. The mounts differ, the glass does not.
 *
 *   auto    generated pole and pivot (the catalogue has no tracker)
 *   manual  front-hinge rack, telescopic rear arms drawn at runtime
 *   fixed   the catalogue's own ground frame, bolted at 35° / 180°
 *
 * Because the collecting area is identical, a watt is a watt: the panel
 * that leads on the dashboard is the one that is better aimed, not the
 * one that happens to be larger. Specific yield (W/m^2) is still shown
 * as the intensive form of the same number.
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

    // Same eight-module array as the other two, on a generated pole.
    // scripts/segment-solar.mjs --extract 1 --mast
    // The modules sit 0.48 m in front of the tilt axis so a steep evening
    // tilt cannot drive the glass through the column.
    apertureArea: 13.09,      // measured
    widthM: 4.10,
    depthM: 3.20,
    heightM: 3.65,
    moduleCount: 8,
    ...COMMON,
    ratedPower: rated(13.09),

    scene: {
      modelUrl: '/models/solar-auto.glb',
      position: [36, 0, 45],
      rotationY: 0,
      labelHeight: 4.3,
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

    // Assembly #1's array, on an adjustable ground rack.
    //
    // The catalogue's own legs under this array are fixed: they hold it at
    // one authored angle and there is no mechanism in them. The reference
    // photograph is of the opposite thing -- a rack hinged along its front
    // edge with a pair of telescopic rear arms, where changing the tilt
    // visibly lengthens the arms. So the segmenter drops those legs and
    // moves the tilt axis to the array's front edge, and the rack itself is
    // drawn at runtime by SolarArray.jsx, because baked geometry cannot
    // change length. The modules and rails are the supplied geometry.
    apertureArea: 13.09,      // measured
    widthM: 4.10,
    depthM: 3.20,
    // Standing height at 90 degrees: the hinge plus the array stood upright.
    heightM: 3.50,
    moduleCount: 8,
    ...COMMON,
    ratedPower: rated(13.09),

    scene: {
      modelUrl: '/models/solar-manual.glb',
      // The model's origin is under the HINGE, not under the array's
      // centre, so this is offset half the array's depth towards the
      // camera to leave the panel itself centred in the row.
      position: [45.5, 0, 46.6],
      rotationY: 0,
      labelHeight: 3.9,

      /**
       * The runtime rack. Metres, in the model's own frame: origin on the
       * ground under the hinge pin, array reaching back in -Z.
       *
       * `hingeHeight` must match the RACK constant in
       * scripts/segment-solar.mjs -- that script puts the tilt axis there,
       * and this draws the hardware that holds it up.
       */
      rack: {
        hingeHeight: 0.3,
        // Rear edge of the 8-module array is at z = -3.20 m. Attach just
        // inboard of that so the arms meet the back rail, not the middle
        // of the glass -- otherwise a steep tilt leaves the rear flying.
        attachDistance: 3.05,
        // Half-width of the modules is 2.05 m. Sitting 13 cm outside that
        // keeps the telescopic arms in silhouette from the teaching camera
        // instead of parking them behind the laminate.
        legSpan: 2.18,
        hingeSpan: 1.90,
        sleeveLength: 0.22,
      },
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

    // Same eight-module array, on the catalogue's own ground frame.
    apertureArea: 13.09,      // measured
    widthM: 4.10,
    depthM: 3.20,
    heightM: 2.18,
    moduleCount: 8,
    ...COMMON,
    ratedPower: rated(13.09),

    scene: {
      modelUrl: '/models/solar-fixed.glb',
      position: [55, 0, 45],
      rotationY: 0,
      labelHeight: 3.4,
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
  cameraOffset: [2, 10, 32],
  target: [45.5, 2.6, 45],
};
