/**
 * Solar position.
 *
 * SIMPLIFIED EDUCATIONAL MODEL, in the same spirit as the wind side: real
 * spherical astronomy, but the short forms taught in solar-engineering
 * courses rather than a full ephemeris. Accurate to roughly a degree, which
 * is far finer than anything visible in the scene.
 *
 * Reference: Duffie & Beckman, "Solar Engineering of Thermal Processes",
 * ch. 1 -- the Cooper declination equation and the standard altitude /
 * azimuth pair.
 *
 * Conventions used throughout:
 *   altitude   degrees above the horizon; negative means the sun has set
 *   azimuth    degrees clockwise from north (N 0, E 90, S 180, W 270)
 *
 * Scene convention: the wind landscape has north at -Z and east at +X, so a
 * compass azimuth maps to the scene as (sin A, ·, -cos A). `sunVector`
 * does that conversion, so nothing downstream has to think about it.
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/**
 * Solar declination, degrees.
 *
 * The tilt of the Earth's axis relative to the sun through the year:
 * +23.45 at the June solstice, 0 at the equinoxes, -23.45 in December.
 * Cooper's equation -- a sine fit, good to about half a degree.
 */
export function declination(dayOfYear) {
  return 23.45 * Math.sin(DEG * ((360 / 365) * (284 + dayOfYear)));
}

/**
 * Hour angle, degrees: how far the sun is from the meridian.
 * Zero at solar noon, negative in the morning, +15 degrees per hour.
 */
export function hourAngle(solarHour) {
  return 15 * (solarHour - 12);
}

/**
 * Sun altitude and azimuth for a place and a moment.
 *
 * @param {number} solarHour  0-24, solar time (noon = sun due south)
 * @param {number} latitude   degrees north
 * @param {number} dayOfYear  1-365
 * @returns {{altitude: number, azimuth: number, declination: number, hourAngle: number}}
 */
export function sunPosition(solarHour, latitude, dayOfYear) {
  const d = declination(dayOfYear);
  const h = hourAngle(solarHour);

  const sinLat = Math.sin(latitude * DEG);
  const cosLat = Math.cos(latitude * DEG);
  const sinDec = Math.sin(d * DEG);
  const cosDec = Math.cos(d * DEG);

  // sin(altitude) = sin φ sin δ + cos φ cos δ cos H
  const sinAltitude = sinLat * sinDec + cosLat * cosDec * Math.cos(h * DEG);
  const altitude = Math.asin(Math.min(Math.max(sinAltitude, -1), 1)) * RAD;

  // cos(azimuth from north) = (sin δ cos φ − cos δ sin φ cos H) / cos(altitude)
  const cosAltitude = Math.cos(altitude * DEG);
  let azimuth;
  if (Math.abs(cosAltitude) < 1e-6) {
    azimuth = 180;                       // sun at the zenith; azimuth undefined
  } else {
    const cosAzimuth = (sinDec * cosLat - cosDec * sinLat * Math.cos(h * DEG)) / cosAltitude;
    azimuth = Math.acos(Math.min(Math.max(cosAzimuth, -1), 1)) * RAD;
    // acos loses the sign; the afternoon half of the sky is the mirror image.
    if (h > 0) azimuth = 360 - azimuth;
  }

  return { altitude, azimuth, declination: d, hourAngle: h };
}

/**
 * Unit vector pointing from the scene towards the sun.
 *
 * North is -Z and east is +X in this scene, matching the wind landscape,
 * so a compass azimuth A and altitude α give:
 *
 *   x = cos α · sin A      east
 *   y = sin α              up
 *   z = −cos α · cos A     north is −Z
 */
export function sunVector({ altitude, azimuth }) {
  const a = altitude * DEG;
  const z = azimuth * DEG;
  const cosAlt = Math.cos(a);
  return [cosAlt * Math.sin(z), Math.sin(a), -cosAlt * Math.cos(z)];
}

/**
 * Sunrise and sunset in solar time, for the day and latitude.
 *
 * From the hour angle at which altitude crosses zero:
 *   cos H₀ = −tan φ · tan δ
 *
 * Returns null for polar day or polar night, where no such crossing exists
 * and the naive arccos would produce NaN.
 */
export function daylightHours(latitude, dayOfYear) {
  const d = declination(dayOfYear);
  const cosH0 = -Math.tan(latitude * DEG) * Math.tan(d * DEG);
  if (cosH0 > 1) return { sunrise: null, sunset: null, daylight: 0 };     // polar night
  if (cosH0 < -1) return { sunrise: null, sunset: null, daylight: 24 };   // midnight sun
  const h0 = Math.acos(cosH0) * RAD;
  return { sunrise: 12 - h0 / 15, sunset: 12 + h0 / 15, daylight: (2 * h0) / 15 };
}

/** Formats a decimal hour as HH:MM. */
export function formatHour(hour) {
  const total = Math.round(hour * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
