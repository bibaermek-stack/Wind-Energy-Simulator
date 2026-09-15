/**
 * Wind turbine power model.
 *
 * SIMPLIFIED EDUCATIONAL MODEL. This is steady-state blade-element-free
 * physics: the momentum equation for available power, an empirical power
 * coefficient curve, and a conventional variable-speed control strategy.
 * It is not a CFD or BEM aerodynamic simulation, and it assumes uniform
 * steady flow with no wind shear, turbulence, yaw error, tower shadow or
 * wake interaction between the machines.
 *
 * What it does model correctly:
 *   - P = 1/2 rho A v^3, the kinetic power flux through the swept area
 *   - Cp as a function of tip-speed ratio, capped by the Betz limit
 *   - the three distinct power levels (aerodynamic / mechanical / electrical)
 *   - variable-speed MPPT below rated, pitch regulation above it
 *   - cut-in, rated and cut-out behaviour
 */

import { AIR_DENSITY_SEA_LEVEL, BETZ_LIMIT, HEIER_PEAK_LAMBDA } from './constants.js';

/**
 * Swept area of the rotor, m^2.
 *
 * A horizontal-axis rotor sweeps a disc, so A = pi R^2. An H-rotor
 * (Darrieus) vertical-axis machine sweeps a cylinder as seen by the wind,
 * and the wind sees its rectangular projection, so A = D x H -- the rotor
 * diameter times the blade height.
 */
export function sweptArea(spec) {
  if (spec.rotor.geometry === 'vertical') {
    return spec.rotor.diameter * spec.rotor.bladeHeight;
  }
  const radius = spec.rotor.diameter / 2;
  return Math.PI * radius * radius;
}

/**
 * Total kinetic power flux carried by the wind through area A, in watts.
 *
 *   P = 1/2 * rho * A * v^3
 *
 * This is the ceiling before any extraction efficiency is applied. Note
 * the cube: doubling the wind speed multiplies available power by eight.
 */
export function windPowerFlux(airDensity, area, windSpeed) {
  return 0.5 * airDensity * area * windSpeed ** 3;
}

/**
 * Empirical power coefficient as a function of tip-speed ratio.
 *
 * Uses the Heier / Slootweg form, the standard closed-form Cp(lambda, beta)
 * approximation in wind-energy engineering texts, at zero blade pitch:
 *
 *   1/lambda_i = 1/lambda - 0.035
 *   Cp = 0.5176 * (116/lambda_i - 5) * exp(-21/lambda_i) + 0.0068 * lambda
 *
 * Its natural peak is Cp ~ 0.48 at lambda ~ 8.1. Each turbine in this
 * simulation has its own peak coefficient and its own optimum tip-speed
 * ratio, so the curve is rescaled on both axes to pass through that
 * machine's (lambdaOptimal, cpMax) point while keeping the characteristic
 * shape: a steep rise, a rounded peak, and a slow fall into runaway.
 *
 * @returns {number} Cp in [0, BETZ_LIMIT]
 */
export function powerCoefficient(lambda, spec) {
  if (lambda <= 0) return 0;

  const shape = (l) => {
    const inverseLambdaI = 1 / l - 0.035;
    if (inverseLambdaI <= 0) return 0;
    const lambdaI = 1 / inverseLambdaI;
    return 0.5176 * (116 / lambdaI - 5) * Math.exp(-21 / lambdaI) + 0.0068 * l;
  };

  // Map this machine's lambdaOptimal onto the reference curve's peak.
  const scaled = lambda * (HEIER_PEAK_LAMBDA / spec.lambdaOptimal);
  const normalised = shape(scaled) / shape(HEIER_PEAK_LAMBDA);

  return clamp(normalised * spec.cpMax, 0, BETZ_LIMIT);
}

/**
 * Combined drivetrain + generator efficiency, i.e. the fraction of
 * aerodynamic rotor power that leaves as electricity at rated conditions.
 */
export function totalEfficiency(spec) {
  return spec.etaDrivetrain * spec.etaGenerator;
}

/**
 * Rated wind speed, m/s -- the lowest wind speed at which the machine can
 * actually reach its rated electrical output.
 *
 * Derived rather than declared, so it can never contradict the other
 * parameters. Invert P_rated = 1/2 rho A v^3 Cp_max eta:
 *
 *   v_rated = cbrt( 2 P_rated / (rho A Cp_max eta) )
 */
export function ratedWindSpeed(spec, airDensity = AIR_DENSITY_SEA_LEVEL) {
  const area = sweptArea(spec);
  const denominator = airDensity * area * spec.cpMax * totalEfficiency(spec);
  return Math.cbrt((2 * spec.ratedPower) / denominator);
}

/**
 * Rated rotor speed, rad/s -- the speed the controller holds once the
 * machine is at rated power. Follows from the optimum tip-speed ratio at
 * the rated wind speed: omega = lambda * v / R.
 */
export function ratedAngularVelocity(spec, airDensity = AIR_DENSITY_SEA_LEVEL) {
  const radius = spec.rotor.diameter / 2;
  return (spec.lambdaOptimal * ratedWindSpeed(spec, airDensity)) / radius;
}

/**
 * Target rotor speed for a given wind speed, rad/s.
 *
 * This is the control strategy of a modern variable-speed turbine:
 *
 *   below cut-in    the rotor is parked; it may drift but produces nothing
 *   cut-in -> rated MPPT region. Speed tracks the wind to hold lambda at
 *                   lambdaOptimal, so Cp stays at its maximum
 *   rated -> cut-out speed is capped; blades pitch to shed the surplus
 *   above cut-out   emergency shutdown, rotor braked to a stop
 */
export function targetAngularVelocity(windSpeed, spec, airDensity = AIR_DENSITY_SEA_LEVEL) {
  if (windSpeed < spec.cutInSpeed || windSpeed >= spec.cutOutSpeed) return 0;

  const radius = spec.rotor.diameter / 2;
  const tracking = (spec.lambdaOptimal * windSpeed) / radius;
  return Math.min(tracking, ratedAngularVelocity(spec, airDensity));
}

/**
 * Full operating point for one turbine at one instant.
 *
 * Takes the *actual* rotor speed (which lags the target, because the rotor
 * has inertia) so that spin-up and coast-down produce physically consistent
 * power readings rather than teleporting to the steady-state value.
 *
 * @param {object}  spec              turbine specification
 * @param {number}  windSpeed         m/s
 * @param {number}  angularVelocity   rad/s, the rotor's real current speed
 * @param {number}  airDensity        kg/m^3
 * @returns {{
 *   status: 'below-cut-in'|'starting'|'generating'|'rated'|'cut-out',
 *   windSpeed: number, area: number, airDensity: number,
 *   tipSpeedRatio: number, cp: number, cpUnpitched: number,
 *   rpm: number, tipSpeed: number,
 *   powerWind: number, powerAero: number, powerMech: number, powerElectrical: number,
 *   overallEfficiency: number, capacityFactor: number, pitched: boolean
 * }}
 */
export function operatingPoint(spec, windSpeed, angularVelocity, airDensity = AIR_DENSITY_SEA_LEVEL) {
  const area = sweptArea(spec);
  const radius = spec.rotor.diameter / 2;
  const tipSpeed = angularVelocity * radius;
  const powerWind = windPowerFlux(airDensity, area, windSpeed);

  // Tip-speed ratio lambda = (blade tip speed) / (wind speed).
  const tipSpeedRatio = windSpeed > 0.05 ? tipSpeed / windSpeed : 0;

  const shutDown = windSpeed >= spec.cutOutSpeed;
  const belowCutIn = windSpeed < spec.cutInSpeed;

  // Unpitched Cp: what the blades would extract at this lambda with the
  // pitch at its fine (maximum-power) setting.
  const cpUnpitched = shutDown || belowCutIn ? 0 : powerCoefficient(tipSpeedRatio, spec);

  const eta = totalEfficiency(spec);

  // Above rated wind the controller pitches the blades to spill power.
  // Expressing that as a *reduced* Cp is what actually happens physically,
  // and it makes the dashboard's Cp readout fall away above rated speed --
  // which is the behaviour students should see, not a constant.
  const cpForRatedPower = powerWind > 0 ? spec.ratedPower / (eta * powerWind) : 0;
  const pitched = !shutDown && !belowCutIn && cpForRatedPower < cpUnpitched;
  const cp = pitched ? cpForRatedPower : cpUnpitched;

  // The three distinct power levels the dashboard reports separately.
  const powerAero = powerWind * cp;            // extracted by the rotor
  const powerMech = powerAero * spec.etaDrivetrain;  // at the generator shaft
  const powerElectrical = Math.min(powerMech * spec.etaGenerator, spec.ratedPower);

  let status;
  if (shutDown) status = 'cut-out';
  else if (belowCutIn) status = 'below-cut-in';
  else if (pitched) status = 'rated';
  else if (powerElectrical < spec.ratedPower * 0.01) status = 'starting';
  else status = 'generating';

  return {
    status,
    windSpeed,
    area,
    airDensity,
    tipSpeedRatio,
    cp,
    cpUnpitched,
    tipSpeed,
    rpm: (angularVelocity * 60) / (2 * Math.PI),
    powerWind,
    powerAero,
    powerMech,
    powerElectrical,
    overallEfficiency: powerWind > 0 ? powerElectrical / powerWind : 0,
    capacityFactor: powerElectrical / spec.ratedPower,
    pitched,
  };
}

/**
 * Steady-state operating point: the point the machine settles at once the
 * rotor has finished accelerating. Used for the analytic curves, where we
 * want the ideal characteristic rather than a transient.
 */
export function steadyState(spec, windSpeed, airDensity = AIR_DENSITY_SEA_LEVEL) {
  return operatingPoint(spec, windSpeed, targetAngularVelocity(windSpeed, spec, airDensity), airDensity);
}

/**
 * Samples the full power / RPM characteristic across the slider's range.
 * Pure and cheap enough to memoise per (spec, airDensity).
 */
export function characteristicCurve(spec, samples, minSpeed, maxSpeed, airDensity = AIR_DENSITY_SEA_LEVEL) {
  const points = [];
  for (let i = 0; i < samples; i++) {
    const v = minSpeed + ((maxSpeed - minSpeed) * i) / (samples - 1);
    const point = steadyState(spec, v, airDensity);
    points.push({
      windSpeed: Number(v.toFixed(2)),
      electrical: point.powerElectrical,
      aerodynamic: point.powerAero,
      available: point.powerWind,
      rpm: point.rpm,
      cp: point.cp,
    });
  }
  return points;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
