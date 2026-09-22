/**
 * The solar array, and the site it stands on.
 *
 * ---------------------------------------------------------------------------
 * ON THE PARAMETERS
 * ---------------------------------------------------------------------------
 * The aperture area and the array's dimensions are MEASURED from the actual
 * geometry in the supplied model, by scripts/segment-solar.mjs. Everything
 * else -- efficiency, temperature coefficient, NOCT, inverter efficiency --
 * is an EXAMPLE parameter set representative of a modern monocrystalline
 * installation, not the specification of any particular product. The model
 * arrived without a datasheet. The interface says so wherever they appear.
 *
 * How the aperture was measured, and why it is not a sum of triangle areas:
 * each module in the model is a solid with a back face, the modules are
 * built in two coincident layers, and there is a backing panel behind them,
 * so adding face areas counts the same square metre three or four times.
 * The figure below is a COVERAGE measurement -- module faces projected onto
 * the array plane and rasterised, each covered cell counted once. It came
 * to 13.09 m^2 against 13.18 m^2 measuring the rack by hand: 99.3% agreement.
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
   * complete solar day end to end, and the panel really does reach zero
   * output at both ends of its travel.
   */
  dayOfYear: 81,
};

/** Solar constant, W/m^2 -- mean extraterrestrial irradiance. */
export const SOLAR_CONSTANT = 1367;

/** Irradiance at Standard Test Conditions, W/m^2. */
export const STC_IRRADIANCE = 1000;

/** Cell temperature at STC, degrees C. */
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

export const CLOUD_DEFAULT = 0;
export const TEMPERATURE_DEFAULT = 20;
export const TEMPERATURE_MIN = -10;
export const TEMPERATURE_MAX = 45;

export const SOLAR_ARRAY = {
  id: 'solar',
  accent: '#b45309',

  name: { kk: 'Күн панельдері', en: 'Solar Array' },
  shortName: { kk: 'Күн панелі', en: 'Solar' },
  typeCode: 'PV',
  typeLabel: {
    kk: 'Екі осьті бақылаушы, монокристалды',
    en: 'Two-axis tracker, monocrystalline',
  },
  description: {
    kk: 'Екі осьті бақылау жүйесі бар күн панельдерінің қатары. Тіреулері '
      + 'жерде бекітілген, ал панельдер көлденең білік (torque tube) '
      + 'айналасында еңкейіп, тік ось бойынша бұрылады. Бақылау қосулы '
      + 'болса, панель күнге тұрақты қарап тұрады — cos θ ≈ 1.',
    en: 'A module array on a two-axis tracker. The posts are fixed in the '
      + 'ground while the modules tilt about a horizontal torque tube and '
      + 'swing about the vertical axis. With tracking on, the array holds '
      + 'itself square to the sun and cos θ stays near 1.',
  },

  // --- measured from the model geometry ---
  apertureArea: 13.09,        // m^2, coverage-measured (see header)
  widthM: 4.27,
  depthM: 2.69,
  heightM: 3.3,
  moduleCount: 8,             // 2 rows x 4 columns, counted in the model

  // --- example operating parameters (2.6 kW class) ---
  efficiency: 0.20,           // module efficiency at STC
  ratedPower: 2600,           // W DC at STC, = aperture x 1000 x efficiency
  temperatureCoefficient: -0.004,  // per degree C, typical for mono c-Si
  noct: 45,                   // Nominal Operating Cell Temperature, degrees C
  inverterEfficiency: 0.96,
  soilingFactor: 0.97,        // dust and dirt on the glass

  /** How fast the tracker slews, degrees per second. Real trackers are slow. */
  trackingSlewRate: 9,

  scene: {
    modelUrl: '/models/solar.glb',
    // In the near field, clear of the three turbines, at true scale.
    position: [34, 0, 44],
    rotationY: 0,
    cameraOffset: [9, 6.5, 13],
    labelHeight: 4.4,
    // The nodes the runtime drives. Built by scripts/segment-solar.mjs.
    rootNode: 'SolarPanelRoot',
    trackerNode: 'SolarPanelTrackingAssembly',
    surfaceNode: 'SolarPanelSurface',
    baseNode: 'SolarPanelBase',
  },
};
