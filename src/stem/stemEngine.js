/**
 * Bench-scale physics for the two STEM boxes.
 *
 * The landscape modes simulate full-size machines. These boxes are desk
 * models -- a 110 x 70 mm module on two hobby servos, a 0.2 m rotor on a
 * small DC motor -- so they get their own, much smaller numbers. The
 * equations are the same ones the rest of the simulator teaches; only the
 * scale changes, which is the point of putting them side by side.
 *
 * Positions are in the box's own frame, millimetres, matching
 * src/stem/boxAssembly.js.
 */

import { SOLAR_DECK } from './boxAssembly.js';
import { AXIS_ABOVE_DECK } from './trackerGeometry.js';

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// solar
// ---------------------------------------------------------------------------
export const TRACKER = {
  /** Pan/tilt pivot above the deck centre (see trackerGeometry.js). */
  pivot: [SOLAR_DECK.centre[0], SOLAR_DECK.centre[1] + AXIS_ABOVE_DECK, SOLAR_DECK.centre[2]],
  /** Mini module: 110 x 70 mm of cells, 18 % -- a typical "6 V 1.5 W" board. */
  cellArea: 0.110 * 0.070,
  efficiency: 0.18,
  vmpStc: 5.2,
  /** Hobby servo, unloaded: ~0.15 s / 60 deg; a tracker runs it far slower. */
  slewDegPerS: 45,
  tiltMax: 75,
};

/** The lamp's path: a semicircle under the sun hub, east (+x) to west. */
export const LAMP = {
  /** In the plane through the hub: the rim's centre line, z = 33.37. */
  centre: [0, 12, 33.37],
  radius: 168,
  /** Irradiance on a square-on surface at `refDistance` with the lamp at 100 %. */
  refIrradiance: 800,
  refDistance: 0.15,
};

export function lampPosition(angleDeg) {
  const a = angleDeg * DEG;
  return [
    LAMP.centre[0] + Math.cos(a) * LAMP.radius,
    LAMP.centre[1] + Math.sin(a) * LAMP.radius,
    LAMP.centre[2],
  ];
}

/**
 * The tracker is mounted with its tilt axis along z, so the lamp's
 * east-west path is followed by tilt alone and pan only trims. Pan 0 means
 * "tilting towards +x (east)".
 */
export const PAN_OFFSET = 90;

/** Panel normal for a pan (about Y) and a tilt from flat. */
export function panelNormal(panDeg, tiltDeg) {
  const p = (panDeg + PAN_OFFSET) * DEG;
  const t = tiltDeg * DEG;
  return [Math.sin(t) * Math.sin(p), Math.cos(t), Math.sin(t) * Math.cos(p)];
}

/** The pan/tilt that aims the panel straight at a point. */
function aimAt(from, to) {
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const len = Math.hypot(...d) || 1;
  const n = d.map((c) => c / len);
  let tilt = Math.acos(clamp(n[1], -1, 1)) / DEG;
  let pan = Math.atan2(n[0], n[2]) / DEG - PAN_OFFSET;
  if (pan < -180) pan += 360;
  // The bracket only folds one way; aim "backwards" by flipping the pan.
  if (pan > 90) { pan -= 180; tilt = -tilt; }
  if (pan < -90) { pan += 180; tilt = -tilt; }
  return { pan, tilt: clamp(tilt, -TRACKER.tiltMax, TRACKER.tiltMax) };
}

function approach(current, target, maxStep) {
  const d = target - current;
  return Math.abs(d) <= maxStep ? target : current + Math.sign(d) * maxStep;
}

// ---------------------------------------------------------------------------
// wind
// ---------------------------------------------------------------------------
export const ROTOR = {
  /** Blade tip radius measured from the printed parts (W26 + hub). */
  radius: 0.102,
  cpMax: 0.26,
  lambdaOpt: 3.2,
  /** Below this the bearing and cogging torque win. */
  cutIn: 1.6,
  /** Spin-up time constant, s. */
  tau: 0.7,
  /** DC motor back-EMF constant, V per rad/s. */
  ke: 0.028,
  generatorEfficiency: 0.6,
  /** Load: a 47-ohm resistor with an LED across part of it. */
  loadOhms: 47,
  airDensity: 1.2,
};

const area = Math.PI * ROTOR.radius ** 2;

function cp(lambda) {
  const x = lambda / ROTOR.lambdaOpt;
  return Math.max(0, ROTOR.cpMax * (2 * x - x * x));
}

// ---------------------------------------------------------------------------
// engine
// ---------------------------------------------------------------------------
class StemEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.solar = {
      lampAngle: 35,
      lampOn: true,
      lampPower: 1,
      lampMoving: true,
      lampSpeed: 12, // deg/s
      lampDirection: 1,
      tracking: true,
      pan: 0,
      tilt: 0,
      out: false,
      energy: 0,
    };
    this.wind = {
      speed: 4,
      // The fan stands off to the front-right, so the rotor is seen
      // three-quarter on, the way the reference drawing shows it.
      direction: 50,
      fanOn: true,
      yaw: 50,
      omega: 0,
      angle: 0,
      out: false,
      energy: 0,
    };
    this.outputs = { solar: {}, wind: {} };
    this.update(0, { solarOffset: [0, 0, 0] });
  }

  /**
   * @param {number} dt seconds
   * @param {{solarOffset: number[]}} ctx  where the tracker pivot is relative
   *   to its in-box position, mm (it moves when the device is taken out).
   */
  update(dt, { solarOffset = [0, 0, 0], solarActive = true, windActive = true } = {}) {
    this.updateSolar(dt, solarOffset, solarActive);
    this.updateWind(dt, windActive);
  }

  /**
   * `active` is false until the box is fully assembled: a tracker lying in
   * pieces on the table has no lamp over it and no circuit behind it.
   */
  updateSolar(dt, offset, active) {
    const s = this.solar;
    const lit = s.lampOn && active;
    if (s.lampMoving && lit) {
      s.lampAngle += s.lampDirection * s.lampSpeed * dt;
      if (s.lampAngle > 165) { s.lampAngle = 165; s.lampDirection = -1; }
      if (s.lampAngle < 15) { s.lampAngle = 15; s.lampDirection = 1; }
    }

    const pivot = TRACKER.pivot.map((c, i) => c + offset[i]);
    const lamp = lampPosition(s.lampAngle);

    if (s.tracking && lit) {
      const aim = aimAt(pivot, lamp);
      const step = TRACKER.slewDegPerS * dt;
      s.pan = approach(s.pan, aim.pan, step);
      s.tilt = approach(s.tilt, aim.tilt, step);
    }

    const d = lamp.map((c, i) => c - pivot[i]);
    const distM = Math.hypot(...d) / 1000;
    const toLamp = d.map((c) => c / (distM * 1000));
    const n = panelNormal(s.pan, s.tilt);
    const cosTheta = Math.max(0, n[0] * toLamp[0] + n[1] * toLamp[1] + n[2] * toLamp[2]);
    const flatCos = Math.max(0, toLamp[1]);

    const irradiance = lit
      ? LAMP.refIrradiance * s.lampPower * (LAMP.refDistance / distM) ** 2
      : 0;
    const power = (g) => TRACKER.efficiency * TRACKER.cellArea * g;
    const g = irradiance * cosTheta;
    const watts = power(g);
    const volts = g > 1 ? clamp(TRACKER.vmpStc * (1 + 0.05 * Math.log(g / 1000)), 0, 6.5) : 0;

    s.energy += watts * dt / 3600;

    // Light-dependent-resistor split: how unevenly the four cells see the
    // lamp, which is the error signal the servos null out.
    const error = Math.acos(clamp(cosTheta, 0, 1)) / DEG;

    this.outputs.solar = {
      lampAngle: s.lampAngle,
      lampPosition: lamp,
      distance: distM,
      irradiance,
      theta: lit ? error : null,
      active,
      cosTheta,
      pan: s.pan,
      tilt: s.tilt,
      power: watts,
      volts,
      amps: volts > 0 ? watts / volts : 0,
      flatPower: power(irradiance * flatCos),
      energy: s.energy,
    };
  }

  updateWind(dt, active) {
    const w = this.wind;
    const v = w.fanOn && active ? w.speed : 0;

    // Passive yaw: the tail cap weathervanes the nacelle into the wind.
    const yawStep = 60 * dt;
    w.yaw = approach(w.yaw, w.direction, yawStep);
    const misalign = Math.cos((w.yaw - w.direction) * DEG);
    const vEff = v * Math.max(0, misalign);

    const target = vEff > ROTOR.cutIn
      ? (ROTOR.lambdaOpt * 1.15 * vEff) / ROTOR.radius * (1 - ROTOR.cutIn / (vEff * 4))
      : 0;
    const k = dt > 0 ? 1 - Math.exp(-dt / ROTOR.tau) : 0;
    w.omega += (target - w.omega) * k;
    if (w.omega < 0.5 && target === 0) w.omega *= 0.9;
    w.angle = (w.angle + w.omega * dt) % (Math.PI * 2);

    const lambda = vEff > 0.1 ? (w.omega * ROTOR.radius) / vEff : 0;
    const coefficient = cp(lambda);
    const available = 0.5 * ROTOR.airDensity * area * vEff ** 3;
    const aero = available * coefficient;
    const emf = ROTOR.ke * w.omega;
    const elec = aero * ROTOR.generatorEfficiency;
    const amps = emf > 0.05 ? elec / emf : 0;
    w.energy += elec * dt / 3600;

    this.outputs.wind = {
      active,
      speed: v,
      effectiveSpeed: vEff,
      yaw: w.yaw,
      rpm: (w.omega * 60) / (2 * Math.PI),
      omega: w.omega,
      angle: w.angle,
      lambda,
      cp: coefficient,
      available,
      aero,
      power: elec,
      volts: emf,
      amps,
      ledOn: emf > 2.0,
      energy: w.energy,
    };
  }

  snapshot() {
    return {
      solar: { ...this.solar, ...this.outputs.solar },
      wind: { ...this.wind, ...this.outputs.wind },
    };
  }
}

export const stemEngine = new StemEngine();
