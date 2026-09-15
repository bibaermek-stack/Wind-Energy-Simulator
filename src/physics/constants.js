/**
 * Physical constants for the wind-power model.
 *
 * All SI unless a name says otherwise: metres, seconds, kilograms, watts.
 */

/** Air density at 15 degC, 101.325 kPa (ISA sea level). kg/m^3 */
export const AIR_DENSITY_SEA_LEVEL = 1.225;

/**
 * The Betz limit, 16/27 = 0.5926.
 *
 * The maximum fraction of the wind's kinetic energy any open-rotor turbine
 * can extract. Derived by Albert Betz (1919) from momentum conservation:
 * to take *all* the energy the air would have to stop dead behind the
 * rotor, which would block the flow. The optimum leaves the wake moving at
 * 1/3 of the free-stream speed. Every real machine sits below this --
 * typically 0.40-0.50 for a good HAWT, 0.30-0.40 for a VAWT -- because of
 * blade drag, tip losses and finite blade count.
 */
export const BETZ_LIMIT = 16 / 27;

/** Reference tip-speed ratio at which the Heier Cp curve peaks. */
export const HEIER_PEAK_LAMBDA = 8.1;

/** Wind speed slider domain, m/s. */
export const WIND_SPEED_MIN = 0;
export const WIND_SPEED_MAX = 30;
export const WIND_SPEED_DEFAULT = 8;

/** Samples used when plotting the analytic power and RPM curves. */
export const CURVE_SAMPLES = 121;
