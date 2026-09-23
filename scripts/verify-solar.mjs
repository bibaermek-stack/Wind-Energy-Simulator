/**
 * Sanity checks on the solar model.
 *
 * Same idea as verify-physics.mjs: a runnable audit that prints the numbers
 * a reviewer would check by hand and fails loudly on anything physically
 * impossible. Run: node scripts/verify-solar.mjs
 */
import {
  SOLAR_PANELS, PANEL_BY_ID, SITE, STC_IRRADIANCE, FIXED_TILT, FIXED_AZIMUTH,
} from '../src/physics/solar/solarSpecs.js';
import {
  sunPosition, daylightHours, sunVector, formatHour, declination,
} from '../src/physics/solar/sunPosition.js';
import {
  operatingPoint, trackingOrientation, panelNormal, cosIncidence,
  beamIrradiance, cloudTransmission,
} from '../src/physics/solar/solarPower.js';

let failures = 0;
const check = (condition, message) => {
  if (!condition) { console.error(`  FAIL  ${message}`); failures++; }
};

const W = (w) => (w >= 1000 ? `${(w / 1000).toFixed(2)} kW` : `${w.toFixed(0)} W`);
const spec = PANEL_BY_ID.auto;
const weather = { cloudFraction: 0, ambientC: 20, dayOfYear: SITE.dayOfYear };

console.log(`Site: ${SITE.name.en}, ${SITE.latitude}°N   day ${SITE.dayOfYear} (declination ${declination(SITE.dayOfYear).toFixed(2)}°)`);
for (const panel of SOLAR_PANELS) {
  console.log(
    `${panel.typeCode.padEnd(7)} ${panel.widthM} x ${panel.depthM} m`
    + `   aperture ${String(panel.apertureArea).padStart(6)} m²`
    + `   rated ${W(panel.ratedPower).padStart(8)}`,
  );
}
console.log('');

// --- the day -------------------------------------------------------------
const day = daylightHours(SITE.latitude, SITE.dayOfYear);
console.log(`Sunrise ${formatHour(day.sunrise)}   sunset ${formatHour(day.sunset)}   daylight ${day.daylight.toFixed(2)} h`);
check(Math.abs(day.sunrise - 6) < 0.35, `sunrise ${formatHour(day.sunrise)} should be near 06:00 so the slider spans the solar day`);
check(Math.abs(day.sunset - 18) < 0.35, `sunset ${formatHour(day.sunset)} should be near 18:00`);

// --- rated power must follow from aperture and efficiency ----------------
const impliedRated = spec.apertureArea * STC_IRRADIANCE * spec.efficiency;
console.log(`Rated check: aperture x 1000 W/m² x η = ${W(impliedRated)}  (declared ${W(spec.ratedPower)})`);
check(Math.abs(impliedRated - spec.ratedPower) / spec.ratedPower < 0.05,
  `declared rated power ${W(spec.ratedPower)} disagrees with aperture x STC x efficiency = ${W(impliedRated)}`);

// --- sun path through the day -------------------------------------------
console.log('\n time   altitude  azimuth   beam W/m²   tracking      fixed 35°/180°   cosθ fixed');
for (let hour = 6; hour <= 18; hour += 1.5) {
  const pos = sunPosition(hour, SITE.latitude, SITE.dayOfYear);
  const tracked = trackingOrientation(pos);
  const t = operatingPoint(spec, pos, tracked.tilt, tracked.azimuth, weather);
  const f = operatingPoint(spec, pos, 35, 180, weather);

  console.log(
    ` ${formatHour(hour)}  ${pos.altitude.toFixed(1).padStart(8)}°${pos.azimuth.toFixed(0).padStart(8)}°`
    + `${t.beamIrradiance.toFixed(0).padStart(11)}${W(t.powerAc).padStart(13)}${W(f.powerAc).padStart(17)}`
    + `${f.cosTheta.toFixed(3).padStart(13)}`,
  );

  // --- invariants ---
  check(t.powerAc >= f.powerAc - 1e-6,
    `at ${formatHour(hour)} the fixed panel (${W(f.powerAc)}) beats the tracker (${W(t.powerAc)}) -- impossible with the same hardware`);
  check(t.cosTheta <= 1 + 1e-9 && t.cosTheta >= 0, `at ${formatHour(hour)} cosθ out of range: ${t.cosTheta}`);
  check(t.powerAc <= spec.ratedPower + 1e-6, `at ${formatHour(hour)} output ${W(t.powerAc)} exceeds rated`);
  check(t.powerAc <= t.powerIncident + 1e-6, `at ${formatHour(hour)} electrical exceeds incident light`);
  check(t.systemEfficiency <= 1, `at ${formatHour(hour)} system efficiency above 100%`);
  if (pos.altitude > 5) {
    check(t.cosTheta > 0.99, `at ${formatHour(hour)} the tracker should be square to the sun, cosθ = ${t.cosTheta.toFixed(3)}`);
  }
}

// --- night ---------------------------------------------------------------
console.log('');
for (const hour of [4, 20, 23]) {
  const pos = sunPosition(hour, SITE.latitude, SITE.dayOfYear);
  const p = operatingPoint(spec, pos, 35, 180, weather);
  console.log(`  ${formatHour(hour)}  altitude ${pos.altitude.toFixed(1)}°  ->  ${W(p.powerAc)}  (${p.status})`);
  check(pos.altitude < 0, `sun should be below the horizon at ${formatHour(hour)}`);
  check(p.powerAc === 0, `power must be exactly zero at night, got ${W(p.powerAc)}`);
  check(p.planeIrradiance === 0, `irradiance must be zero at night`);
}

// --- cloud ---------------------------------------------------------------
console.log('\ncloud cover   transmission   noon power');
for (const cloud of [0, 0.25, 0.5, 0.75, 1]) {
  const pos = sunPosition(12, SITE.latitude, SITE.dayOfYear);
  const tracked = trackingOrientation(pos);
  const p = operatingPoint(spec, pos, tracked.tilt, tracked.azimuth, { ...weather, cloudFraction: cloud });
  console.log(`   ${(cloud * 100).toFixed(0).padStart(3)}%       ${cloudTransmission(cloud).toFixed(3).padStart(8)}   ${W(p.powerAc).padStart(10)}`);
  check(p.powerAc >= 0, 'cloud produced negative power');
}
const clear = operatingPoint(spec, sunPosition(12, SITE.latitude, SITE.dayOfYear), 0, 180, { ...weather, cloudFraction: 0 });
const overcast = operatingPoint(spec, sunPosition(12, SITE.latitude, SITE.dayOfYear), 0, 180, { ...weather, cloudFraction: 1 });
check(overcast.powerAc < clear.powerAc * 0.5, 'full overcast should cost more than half the output');
check(overcast.powerAc > 0, 'an overcast panel still collects diffuse light and must not read exactly zero');

// --- temperature ---------------------------------------------------------
console.log('\nambient °C   cell °C   noon power');
for (const ambient of [-10, 10, 25, 45]) {
  const pos = sunPosition(12, SITE.latitude, SITE.dayOfYear);
  const tracked = trackingOrientation(pos);
  const p = operatingPoint(spec, pos, tracked.tilt, tracked.azimuth, { ...weather, ambientC: ambient });
  console.log(`   ${String(ambient).padStart(6)}    ${p.cellTemperature.toFixed(1).padStart(6)}   ${W(p.powerAc).padStart(10)}`);
}
const cold = operatingPoint(spec, sunPosition(12, SITE.latitude, SITE.dayOfYear), 0, 180, { ...weather, ambientC: -10 });
const hot = operatingPoint(spec, sunPosition(12, SITE.latitude, SITE.dayOfYear), 0, 180, { ...weather, ambientC: 45 });
check(cold.powerAc > hot.powerAc, 'a cold panel must outperform a hot one -- silicon loses power as it heats');

// --- orientation sweep: the fixed panel must peak facing south -----------
let best = { power: -1, azimuth: null };
const noon = sunPosition(12, SITE.latitude, SITE.dayOfYear);
for (let az = 0; az < 360; az += 5) {
  const p = operatingPoint(spec, noon, 35, az, weather);
  if (p.powerAc > best.power) best = { power: p.powerAc, azimuth: az };
}
console.log(`\nBest fixed azimuth at solar noon: ${best.azimuth}° (${W(best.power)})`);
check(Math.abs(best.azimuth - 180) <= 10,
  `at solar noon in the northern hemisphere the best azimuth must be due south, got ${best.azimuth}°`);

// --- geometry: the tracker's normal must equal the sun vector ------------
const midMorning = sunPosition(9, SITE.latitude, SITE.dayOfYear);
const track = trackingOrientation(midMorning);
const alignment = cosIncidence(sunVector(midMorning), panelNormal(track.tilt, track.azimuth));
console.log(`Tracker alignment at 09:00: cosθ = ${alignment.toFixed(6)}`);
check(Math.abs(alignment - 1) < 1e-6, `tracking orientation is not square to the sun: cosθ = ${alignment}`);

// --- daily energy --------------------------------------------------------
let trackingWh = 0;
let fixedWh = 0;
const stepH = 1 / 60;
for (let hour = 0; hour < 24; hour += stepH) {
  const pos = sunPosition(hour, SITE.latitude, SITE.dayOfYear);
  const tracked = trackingOrientation(pos);
  trackingWh += operatingPoint(spec, pos, tracked.tilt, tracked.azimuth, weather).powerAc * stepH;
  fixedWh += operatingPoint(spec, pos, 35, 180, weather).powerAc * stepH;
}
const gain = ((trackingWh / fixedWh) - 1) * 100;
console.log(`\nDaily energy   tracking ${(trackingWh / 1000).toFixed(2)} kWh   fixed ${(fixedWh / 1000).toFixed(2)} kWh   gain +${gain.toFixed(1)}%`);
check(gain > 5 && gain < 80, `two-axis tracking gain of ${gain.toFixed(1)}% is outside the plausible 5-80% range`);

// --- three-panel invariants ----------------------------------------------
//
// All three arrays are the same hardware (8 modules, 13.09 m^2). A panel
// held square to the sun cannot be beaten, in watts or in W/m^2, by one
// that is not -- that is the invariant the interface is built to show.
console.log('\n time     auto W/m²   manual W/m²    fixed W/m²   auto θ   fixed θ');

const manualAngles = { tilt: 35, azimuth: 180 };
const anglesFor = (panel, aim) => {
  if (panel.mode === 'auto') return aim;
  if (panel.mode === 'manual') return manualAngles;
  return { tilt: FIXED_TILT, azimuth: FIXED_AZIMUTH };
};

for (let hour = 7; hour <= 17; hour += 2) {
  const pos = sunPosition(hour, SITE.latitude, SITE.dayOfYear);
  const aim = trackingOrientation(pos);

  const points = {};
  const yields = {};
  for (const panel of SOLAR_PANELS) {
    const angles = anglesFor(panel, aim);
    const point = operatingPoint(panel, pos, angles.tilt, angles.azimuth, weather);
    points[panel.id] = point;
    yields[panel.id] = point.powerAc / panel.apertureArea;
  }

  console.log(
    ` ${formatHour(hour)}  ${yields.auto.toFixed(1).padStart(10)}`
    + `${yields.manual.toFixed(1).padStart(14)}${yields.fixed.toFixed(1).padStart(14)}`
    + `${points.auto.incidenceDeg.toFixed(1).padStart(9)}°`
    + `${points.fixed.incidenceDeg.toFixed(1).padStart(9)}°`,
  );

  check(yields.auto >= yields.manual - 1e-6,
    `at ${formatHour(hour)} the manual panel out-yields the tracker `
    + `(${yields.manual.toFixed(1)} > ${yields.auto.toFixed(1)} W/m²) -- impossible when the tracker is square to the sun`);
  check(yields.auto >= yields.fixed - 1e-6,
    `at ${formatHour(hour)} the fixed panel out-yields the tracker `
    + `(${yields.fixed.toFixed(1)} > ${yields.auto.toFixed(1)} W/m²)`);
  check(points.auto.incidenceDeg < 0.01,
    `at ${formatHour(hour)} the tracker is not square to the sun: θ = ${points.auto.incidenceDeg.toFixed(3)}°`);

  // Panel 3 must never move, whatever the sun is doing.
  check(points.fixed.tilt === FIXED_TILT && points.fixed.azimuth === FIXED_AZIMUTH,
    `at ${formatHour(hour)} the fixed panel has moved to ${points.fixed.tilt}/${points.fixed.azimuth}`);

  for (const panel of SOLAR_PANELS) {
    check(points[panel.id].powerAc <= panel.ratedPower + 1e-6,
      `at ${formatHour(hour)} ${panel.typeCode} exceeds its rating`);
    check(points[panel.id].powerAc >= 0, `at ${formatHour(hour)} ${panel.typeCode} produced negative power`);
  }
}

// Each panel's rating must follow from its own measured aperture.
for (const panel of SOLAR_PANELS) {
  const implied = panel.apertureArea * STC_IRRADIANCE * panel.efficiency;
  check(Math.abs(implied - panel.ratedPower) / panel.ratedPower < 0.02,
    `${panel.typeCode}: rated ${W(panel.ratedPower)} disagrees with aperture x STC x η = ${W(implied)}`);
}

// At solar noon the fixed panel is nearly optimal by construction, so the
// three should converge. If they do not, one of them is misconfigured.
{
  const pos = sunPosition(12, SITE.latitude, SITE.dayOfYear);
  const aim = trackingOrientation(pos);
  const yieldOf = (panel) => {
    const angles = anglesFor(panel, aim);
    return operatingPoint(panel, pos, angles.tilt, angles.azimuth, weather).powerAc / panel.apertureArea;
  };
  const autoYield = yieldOf(PANEL_BY_ID.auto);
  const fixedYield = yieldOf(PANEL_BY_ID.fixed);
  const ratio = fixedYield / autoYield;
  console.log(`\nAt solar noon the fixed panel reaches ${(ratio * 100).toFixed(1)}% of the tracker's yield`);
  check(ratio > 0.9, `fixed panel should be near-optimal at noon, got ${(ratio * 100).toFixed(1)}%`);
}

// Daily yield per square metre, the headline comparison.
{
  const stepHours = 1 / 60;
  const totals = Object.fromEntries(SOLAR_PANELS.map((p) => [p.id, 0]));
  for (let hour = 0; hour < 24; hour += stepHours) {
    const pos = sunPosition(hour, SITE.latitude, SITE.dayOfYear);
    if (pos.altitude <= 0) continue;
    const aim = trackingOrientation(pos);
    for (const panel of SOLAR_PANELS) {
      const angles = anglesFor(panel, aim);
      totals[panel.id] += operatingPoint(panel, pos, angles.tilt, angles.azimuth, weather).powerAc * stepHours;
    }
  }
  console.log('\ndaily energy      absolute        per m²');
  for (const panel of SOLAR_PANELS) {
    const perArea = totals[panel.id] / panel.apertureArea;
    console.log(
      ` ${panel.typeCode.padEnd(8)}${(totals[panel.id] / 1000).toFixed(2).padStart(9)} kWh`
      + `${(perArea / 1000).toFixed(3).padStart(12)} kWh/m²`,
    );
  }
  const gainAuto = ((totals.auto / PANEL_BY_ID.auto.apertureArea)
    / (totals.fixed / PANEL_BY_ID.fixed.apertureArea) - 1) * 100;
  console.log(` tracking gain over fixed, per m²: +${gainAuto.toFixed(1)}%`);
  check(gainAuto > 5 && gainAuto < 80,
    `tracking gain of ${gainAuto.toFixed(1)}% per m² is outside the plausible 5-80% range`);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
