/**
 * Photovoltaic power model.
 *
 * SIMPLIFIED EDUCATIONAL MODEL. It is the standard teaching chain --
 * clear-sky beam irradiance, cosine of the incidence angle, a NOCT cell
 * temperature and a linear temperature coefficient. It is not a ray-traced
 * or spectral model, and it ignores row-to-row shading, reflection losses
 * at grazing incidence, spectral mismatch and inverter clipping dynamics.
 *
 * What it does model correctly, and what the interface is built to show:
 *
 *     sun position -> panel orientation -> incidence angle
 *                  -> irradiance on the plane -> electrical power
 *
 * That chain is the whole scientific point of the solar mode, so each link
 * is a separate, separately reported quantity.
 */

import { sunVector, sunPosition } from './sunPosition.js';
import { SOLAR_CONSTANT, STC_IRRADIANCE, STC_TEMPERATURE } from './solarSpecs.js';

const DEG = Math.PI / 180;

/**
 * Clear-sky beam (direct normal) irradiance, W/m^2.
 *
 * Meinel's form of the atmospheric attenuation: the beam is reduced by
 * 0.7 raised to the air mass, with the 0.678 exponent that fits measured
 * data better than a plain power law. Air mass is 1 with the sun overhead
 * and grows as it sinks, which is why a low sun is weak sun.
 *
 * Returns 0 once the sun is below the horizon.
 */
export function beamIrradiance(altitudeDeg, dayOfYear) {
  if (altitudeDeg <= 0) return 0;

  // Earth-sun distance varies through the year by about +-3.3%.
  const eccentricity = 1 + 0.033 * Math.cos(DEG * ((360 * dayOfYear) / 365));
  const extraterrestrial = SOLAR_CONSTANT * eccentricity;

  // Kasten-Young air mass: behaves near the horizon, where 1/sin(alt) blows up.
  const airMass = 1 / (
    Math.sin(altitudeDeg * DEG)
    + 0.50572 * (altitudeDeg + 6.07995) ** -1.6364
  );

  return extraterrestrial * 0.7 ** (airMass ** 0.678);
}

/**
 * Splits the sky's light into beam and diffuse under a given cloud cover.
 *
 * Cloud does two things at once: it scatters direct sunlight into diffuse
 * light, and it absorbs some of the total. Modelling only the first gives
 * the absurd result that a cloudy sky out-performs a clear one -- an
 * earlier version of this function did exactly that, and the audit caught
 * it at 2.01 kW clear against 2.22 kW at half cover.
 *
 * So the total is fixed first and the split second:
 *
 *   1. the whole clear-sky resource is attenuated by cloudTransmission,
 *      which is monotonically decreasing, so more cloud is always less
 *      energy;
 *   2. what survives is divided between beam and diffuse, with the beam
 *      dying off much faster -- by full overcast there is no disc to see
 *      and everything left arrives as diffuse.
 *
 * @returns {{beam: number, diffuse: number}} DNI and horizontal diffuse, W/m^2
 */
export function skySplit(clearBeam, altitudeDeg, cloudFraction) {
  if (clearBeam <= 0 || altitudeDeg <= 0) return { beam: 0, diffuse: 0 };

  const c = Math.min(Math.max(cloudFraction, 0), 1);
  const sinAlt = Math.sin(altitudeDeg * DEG);

  // Clear-sky totals on the horizontal.
  const clearDiffuse = 0.10 * clearBeam;
  const clearGlobal = clearBeam * sinAlt + clearDiffuse;

  // 1. total energy after cloud
  const global = clearGlobal * cloudTransmission(c);

  // 2. the beam share collapses as the disc is obscured
  const beam = clearBeam * (1 - c) ** 2.5;

  // Whatever is left of the total arrives as diffuse.
  const diffuse = Math.max(global - beam * sinAlt, 0);

  return { beam, diffuse };
}

/**
 * Cloud attenuation factor applied to the beam, 0..1.
 *
 * Kasten-Czeplak: transmission falls as the cube of cloud cover, so thin
 * cloud costs little and the last of the sky closing over costs a lot.
 * Smooth and monotonic -- never random.
 */
export function cloudTransmission(cloudFraction) {
  const c = Math.min(Math.max(cloudFraction, 0), 1);
  return 1 - 0.75 * c ** 3;
}

/**
 * Unit normal of a panel at a given tilt and azimuth.
 *
 * Same convention as the sun: azimuth is degrees clockwise from north, and
 * the scene has north at -Z. A panel at tilt 0 faces straight up.
 */
export function panelNormal(tiltDeg, azimuthDeg) {
  const t = tiltDeg * DEG;
  const a = azimuthDeg * DEG;
  const sinTilt = Math.sin(t);
  return [sinTilt * Math.sin(a), Math.cos(t), -sinTilt * Math.cos(a)];
}

/**
 * Cosine of the angle of incidence between the sun and the panel normal.
 *
 * This is the heart of the whole tracking lesson: it is 1 when the panel
 * faces the sun squarely and falls away as it turns aside. Clamped at zero,
 * because a panel facing away from the sun collects no beam -- it does not
 * collect negative light.
 */
export function cosIncidence(sun, normal) {
  const dot = sun[0] * normal[0] + sun[1] * normal[1] + sun[2] * normal[2];
  return Math.max(dot, 0);
}

/**
 * The ideal orientation for a tracker: point straight at the sun.
 * Below the horizon the tracker parks flat rather than aiming at the ground.
 */
export function trackingOrientation({ altitude, azimuth }) {
  if (altitude <= 0) return { tilt: 0, azimuth: 180 };
  return { tilt: 90 - altitude, azimuth };
}

/**
 * Cell temperature from the NOCT model, degrees C.
 *
 * Cells run hotter than the air around them in proportion to the light
 * falling on them. This matters: silicon loses roughly 0.4% of its output
 * per degree, so a panel in still summer air can give up a tenth of its
 * power to its own heat.
 */
export function cellTemperature(ambientC, planeIrradiance, noct) {
  return ambientC + ((noct - 20) / 800) * planeIrradiance;
}

/**
 * Full operating point for one panel orientation at one instant.
 *
 * @param {object} spec        the array (see solarSpecs.js)
 * @param {object} sunPos      { altitude, azimuth } in degrees
 * @param {number} tiltDeg     the panel's ACTUAL tilt, not its target
 * @param {number} azimuthDeg  the panel's ACTUAL azimuth
 * @param {object} weather     { cloudFraction, ambientC, dayOfYear }
 */
export function operatingPoint(spec, sunPos, tiltDeg, azimuthDeg, weather) {
  const { cloudFraction = 0, ambientC = 20, dayOfYear = 81 } = weather;

  const aboveHorizon = sunPos.altitude > 0;
  const clearBeam = beamIrradiance(sunPos.altitude, dayOfYear);
  const { beam, diffuse } = skySplit(clearBeam, sunPos.altitude, cloudFraction);

  const sun = sunVector(sunPos);
  const normal = panelNormal(tiltDeg, azimuthDeg);
  const cosTheta = aboveHorizon ? cosIncidence(sun, normal) : 0;
  const incidenceDeg = Math.acos(Math.min(Math.max(cosTheta, 0), 1)) / DEG;

  // Irradiance in the plane of the array. The beam is projected by the
  // incidence angle; the diffuse component arrives from the whole sky dome,
  // so a tilted panel sees the fraction of sky it still faces.
  const skyViewFactor = (1 + Math.cos(tiltDeg * DEG)) / 2;
  const planeIrradiance = aboveHorizon ? beam * cosTheta + diffuse * skyViewFactor : 0;

  const cellC = cellTemperature(ambientC, planeIrradiance, spec.noct);
  const temperatureFactor = 1 + spec.temperatureCoefficient * (cellC - STC_TEMPERATURE);

  // The conversion chain, each stage reported separately.
  const powerIncident = planeIrradiance * spec.apertureArea;
  const powerDc = powerIncident * spec.efficiency * temperatureFactor * spec.soilingFactor;
  const powerAc = Math.max(0, Math.min(powerDc * spec.inverterEfficiency, spec.ratedPower));

  let status;
  if (!aboveHorizon) status = 'night';
  else if (powerAc < spec.ratedPower * 0.01) status = 'dawn';
  else if (cosTheta > 0.985) status = 'optimal';
  else if (cosTheta > 0.85) status = 'good';
  else status = 'misaligned';

  return {
    status,
    aboveHorizon,
    sunAltitude: sunPos.altitude,
    sunAzimuth: sunPos.azimuth,
    tilt: tiltDeg,
    azimuth: azimuthDeg,
    cosTheta,
    incidenceDeg,
    beamIrradiance: beam,
    diffuseIrradiance: diffuse,
    planeIrradiance,
    cellTemperature: cellC,
    temperatureFactor,
    powerIncident,
    powerDc,
    powerAc,
    // Fraction of the light landing on the aperture that leaves as electricity.
    systemEfficiency: powerIncident > 0 ? powerAc / powerIncident : 0,
    capacityFactor: powerAc / spec.ratedPower,
  };
}

/**
 * Samples power across the day, for the daily curve.
 * Pure, so it can be memoised per (spec, weather, orientation mode).
 */
export function dailyCurve(spec, { latitude, dayOfYear }, weather, options = {}) {
  const { fixedTilt, fixedAzimuth, samples = 121, from = 6, to = 18 } = options;
  const points = [];

  for (let i = 0; i < samples; i++) {
    const hour = from + ((to - from) * i) / (samples - 1);
    const pos = sunPosition(hour, latitude, dayOfYear);
    const tracked = trackingOrientation(pos);

    const tracking = operatingPoint(spec, pos, tracked.tilt, tracked.azimuth, { ...weather, dayOfYear });
    const fixed = operatingPoint(spec, pos, fixedTilt, fixedAzimuth, { ...weather, dayOfYear });

    points.push({
      hour: Number(hour.toFixed(3)),
      altitude: pos.altitude,
      tracking: tracking.powerAc,
      fixed: fixed.powerAc,
      irradiance: tracking.planeIrradiance,
    });
  }
  return points;
}
