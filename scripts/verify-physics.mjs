/**
 * Sanity checks on the power model.
 *
 * Not a unit-test framework -- a runnable audit that prints the numbers a
 * reviewer would want to check by hand, and fails loudly on anything
 * physically impossible. Run: node scripts/verify-physics.mjs
 */
import { TURBINES } from '../src/physics/turbineSpecs.js';
import {
  sweptArea, steadyState, ratedWindSpeed, ratedAngularVelocity,
  powerCoefficient, totalEfficiency, windPowerFlux,
} from '../src/physics/windPower.js';
import { AIR_DENSITY_SEA_LEVEL, BETZ_LIMIT, WIND_SPEED_MAX } from '../src/physics/constants.js';

let failures = 0;
function check(condition, message) {
  if (!condition) {
    console.error(`  FAIL  ${message}`);
    failures++;
  }
}

const W = (w) => (w >= 1e6 ? `${(w / 1e6).toFixed(2)} MW`
  : w >= 1e3 ? `${(w / 1e3).toFixed(2)} kW` : `${w.toFixed(1)} W`);

console.log(`Betz limit 16/27 = ${BETZ_LIMIT.toFixed(4)}`);
console.log(`Air density      = ${AIR_DENSITY_SEA_LEVEL} kg/m^3\n`);

for (const spec of TURBINES) {
  const area = sweptArea(spec);
  const vRated = ratedWindSpeed(spec);
  const omegaRated = ratedAngularVelocity(spec);
  const rpmRated = (omegaRated * 60) / (2 * Math.PI);
  const tipSpeedRated = omegaRated * (spec.rotor.diameter / 2);

  console.log(`${spec.typeCode}  --  ${spec.name.en}`);
  console.log(`  swept area A      ${area.toFixed(2)} m^2  (${spec.rotor.geometry === 'vertical' ? 'D x H' : 'pi R^2'})`);
  console.log(`  rated wind speed  ${vRated.toFixed(2)} m/s   (derived from rated power)`);
  console.log(`  rated rotor speed ${rpmRated.toFixed(1)} RPM   tip speed ${tipSpeedRated.toFixed(1)} m/s`);
  console.log(`  total efficiency  ${(totalEfficiency(spec) * 100).toFixed(1)} %  (drivetrain x generator)`);

  // --- invariants -------------------------------------------------------
  check(spec.cpMax < BETZ_LIMIT, `${spec.id}: cpMax ${spec.cpMax} must be below the Betz limit`);
  check(vRated > spec.cutInSpeed, `${spec.id}: rated wind speed must exceed cut-in`);
  check(vRated < spec.cutOutSpeed, `${spec.id}: rated wind speed must be below cut-out`);
  check(tipSpeedRated < 110, `${spec.id}: tip speed ${tipSpeedRated.toFixed(0)} m/s is unrealistically high`);

  // Cp must peak at lambdaOptimal, to within the sampling resolution.
  let bestLambda = 0;
  let bestCp = 0;
  for (let l = 0.05; l < 25; l += 0.01) {
    const cp = powerCoefficient(l, spec);
    if (cp > bestCp) { bestCp = cp; bestLambda = l; }
  }
  console.log(`  Cp peak           ${bestCp.toFixed(4)} at lambda ${bestLambda.toFixed(2)}  (target ${spec.cpMax} at ${spec.lambdaOptimal})`);
  check(Math.abs(bestCp - spec.cpMax) < 0.005, `${spec.id}: Cp peak ${bestCp.toFixed(4)} != cpMax ${spec.cpMax}`);
  check(Math.abs(bestLambda - spec.lambdaOptimal) < 0.15, `${spec.id}: Cp peaks at lambda ${bestLambda.toFixed(2)}, expected ${spec.lambdaOptimal}`);

  // --- sweep the whole slider range ------------------------------------
  let maxElectrical = 0;
  for (let v = 0; v <= WIND_SPEED_MAX; v += 0.1) {
    const p = steadyState(spec, v);
    maxElectrical = Math.max(maxElectrical, p.powerElectrical);

    check(p.cp <= BETZ_LIMIT + 1e-9, `${spec.id} @ ${v.toFixed(1)} m/s: Cp ${p.cp.toFixed(4)} exceeds Betz`);
    check(p.powerElectrical <= spec.ratedPower + 1e-6, `${spec.id} @ ${v.toFixed(1)} m/s: ${W(p.powerElectrical)} exceeds rated ${W(spec.ratedPower)}`);
    check(p.powerElectrical <= p.powerMech + 1e-6, `${spec.id} @ ${v.toFixed(1)} m/s: electrical exceeds mechanical`);
    check(p.powerMech <= p.powerAero + 1e-6, `${spec.id} @ ${v.toFixed(1)} m/s: mechanical exceeds aerodynamic`);
    check(p.powerAero <= p.powerWind + 1e-6, `${spec.id} @ ${v.toFixed(1)} m/s: aerodynamic exceeds available wind power`);
    check(Number.isFinite(p.powerElectrical) && p.powerElectrical >= 0, `${spec.id} @ ${v.toFixed(1)} m/s: non-finite or negative power`);

    if (v < spec.cutInSpeed) check(p.powerElectrical === 0, `${spec.id} @ ${v.toFixed(1)} m/s: generating below cut-in`);
    if (v >= spec.cutOutSpeed) {
      check(p.powerElectrical === 0, `${spec.id} @ ${v.toFixed(1)} m/s: generating above cut-out`);
      check(p.rpm === 0, `${spec.id} @ ${v.toFixed(1)} m/s: rotor still turning above cut-out`);
    }
  }
  check(Math.abs(maxElectrical - spec.ratedPower) < spec.ratedPower * 0.001,
    `${spec.id}: peak output ${W(maxElectrical)} should reach rated ${W(spec.ratedPower)}`);

  // --- a worked example at the default 8 m/s ---------------------------
  const p8 = steadyState(spec, 8);
  const flux8 = windPowerFlux(AIR_DENSITY_SEA_LEVEL, area, 8);
  console.log(`  at 8 m/s:  wind ${W(flux8)}  ->  aero ${W(p8.powerAero)}  ->  mech ${W(p8.powerMech)}  ->  electrical ${W(p8.powerElectrical)}`);
  console.log(`             Cp ${p8.cp.toFixed(3)}   lambda ${p8.tipSpeedRatio.toFixed(2)}   ${p8.rpm.toFixed(1)} RPM   overall ${(p8.overallEfficiency * 100).toFixed(1)}%`);
  check(Math.abs(flux8 - p8.powerWind) < 1e-6, `${spec.id}: windPowerFlux disagrees with operatingPoint`);
  console.log();
}

// Cross-check the headline scaling claim made in the small turbine's text.
const hawt = TURBINES.find((t) => t.id === 'hawt');
const small = TURBINES.find((t) => t.id === 'small');
const areaRatio = sweptArea(hawt) / sweptArea(small);
console.log(`HAWT swept area / small swept area = ${areaRatio.toFixed(0)}x  (diameter ratio ${(hawt.rotor.diameter / small.rotor.diameter).toFixed(0)}x)`);
check(areaRatio > 1000 && areaRatio < 1500, `area ratio ${areaRatio.toFixed(0)} contradicts the "1350x" claim in turbineSpecs.js`);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
