/**
 * SolarEngine -- the solar side's time-stepping core.
 *
 * Mirrors SimulationEngine's contract: `step(realDt)`, `snapshot()`,
 * `subscribe(fn)`, `reset()`. The clock component steps both, the store
 * bridges both the same way, and hybrid mode reads both snapshots.
 *
 * All three panels are integrated every frame from ONE set of inputs --
 * the same sun, sky and weather. That is what makes the comparison
 * meaningful: the only thing that differs between them is how their
 * orientation is decided.
 */

import {
  SOLAR_PANELS, PANEL_BY_ID, SITE,
  TIME_DEFAULT, TILT_DEFAULT, AZIMUTH_DEFAULT,
  FIXED_TILT, FIXED_AZIMUTH,
  CLOUD_DEFAULT, TEMPERATURE_DEFAULT,
} from './solarSpecs.js';
import { sunPosition, daylightHours } from './sunPosition.js';
import { operatingPoint, trackingOrientation } from './solarPower.js';

export const PUBLISH_INTERVAL = 0.1;
const HISTORY_INTERVAL = 0.25;
const HISTORY_LENGTH = 240;

/** Integration step, in simulated seconds. Matches the wind engine. */
const MAX_SUBSTEP = 0.1;
const MAX_SUBSTEPS = 120;
const MAX_REAL_DELTA = 1.0;

/** Simulated seconds per real second at each setting. */
export const TIME_SCALES = [1, 10, 100, 1000];

/**
 * One panel: its actual orientation, which lags its target, and the energy
 * it has produced.
 */
class PanelRuntime {
  constructor(spec) {
    this.spec = spec;
    this.reset();
  }

  reset() {
    if (this.spec.mode === 'fixed') {
      this.tilt = FIXED_TILT;
      this.azimuth = FIXED_AZIMUTH;
    } else {
      this.tilt = TILT_DEFAULT;
      this.azimuth = AZIMUTH_DEFAULT;
    }
    this.energyJoules = 0;
    this.point = null;
  }

  /**
   * Slews towards a target orientation at a finite rate.
   *
   * A real tracker takes minutes to cross the sky. Snapping the array to a
   * new angle would look wrong and would hide the fact that tracking is a
   * mechanical process with a speed limit. Azimuth takes the short way
   * round, so a tracker crossing 359 -> 1 degrees does not unwind the long
   * way about.
   */
  slew(target, dt) {
    const rate = this.spec.trackingSlewRate * dt;

    const dTilt = target.tilt - this.tilt;
    this.tilt += Math.sign(dTilt) * Math.min(Math.abs(dTilt), rate);

    const dAz = ((target.azimuth - this.azimuth + 540) % 360) - 180;
    this.azimuth = (this.azimuth + Math.sign(dAz) * Math.min(Math.abs(dAz), rate) + 360) % 360;
  }

  /**
   * Advance by dt seconds.
   *
   * @param {object} controls  { autoTracking, manual: {tilt, azimuth} }
   */
  step(dt, sunPos, weather, controls) {
    const target = this.targetFor(sunPos, controls);

    // A fixed panel is bolted down: it does not slew, it simply is where
    // it is. Giving it a slew would let it drift if anything ever wrote a
    // different target, and "fixed" has to mean fixed.
    if (this.spec.mode === 'fixed') {
      this.tilt = FIXED_TILT;
      this.azimuth = FIXED_AZIMUTH;
    } else if (target) {
      this.slew(target, dt);
    }

    this.point = operatingPoint(this.spec, sunPos, this.tilt, this.azimuth, weather);
    this.energyJoules += this.point.powerAc * dt;
  }

  /**
   * Where this panel is trying to point, or null if it should hold still.
   *
   * The auto panel returns null when tracking is switched off: it freezes
   * at whatever angle it had reached and the sun moves on without it. That
   * is the instructive behaviour -- you watch the alignment angle open up
   * in real time, which is precisely what a stalled tracker costs you.
   */
  targetFor(sunPos, controls) {
    switch (this.spec.mode) {
      case 'auto':
        return controls.autoTracking ? trackingOrientation(sunPos) : null;
      case 'manual':
        return controls.manual;
      default:
        return null;
    }
  }

  get energyWattHours() {
    return this.energyJoules / 3600;
  }

  /** Watts per square metre of aperture -- comparable across panel sizes. */
  get specificYield() {
    return this.point ? this.point.powerAc / this.spec.apertureArea : 0;
  }
}

export class SolarEngine {
  constructor(specs = SOLAR_PANELS, site = SITE) {
    this.specs = specs;
    this.site = site;

    /** Solar time of day, hours. The main control. */
    this.timeOfDay = TIME_DEFAULT;
    /** Whether the clock advances on its own. */
    this.running = false;
    this.timeScale = 1;

    /** Panel 1's tracker. */
    this.autoTracking = true;
    /** Panel 2's orientation, from the sliders. */
    this.manual = { tilt: TILT_DEFAULT, azimuth: AZIMUTH_DEFAULT };

    this.weather = {
      cloudFraction: CLOUD_DEFAULT,
      ambientC: TEMPERATURE_DEFAULT,
      dayOfYear: site.dayOfYear,
    };

    this.panels = Object.fromEntries(specs.map((spec) => [spec.id, new PanelRuntime(spec)]));

    this.history = [];
    this._sincePublish = 0;
    this._sinceHistory = 0;
    this._listeners = new Set();

    this._evaluate(0);
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  setTimeOfDay(hours) { this.timeOfDay = hours; this._evaluate(0); this.publish(); }
  setRunning(value) { this.running = value; }
  setTimeScale(value) { this.timeScale = value; }
  setAutoTracking(value) { this.autoTracking = value; }
  setManual(partial) { Object.assign(this.manual, partial); }
  setWeather(partial) { Object.assign(this.weather, partial); this._evaluate(0); this.publish(); }

  reset() {
    this.timeOfDay = TIME_DEFAULT;
    Object.values(this.panels).forEach((p) => p.reset());
    this.history = [];
    this._evaluate(0);
    this.publish();
  }

  get sun() {
    return sunPosition(this.timeOfDay, this.site.latitude, this.weather.dayOfYear);
  }

  /** Live orientation of one panel, for the 3D scene to read per frame. */
  orientationOf(id) {
    const panel = this.panels[id];
    return panel ? { tilt: panel.tilt, azimuth: panel.azimuth } : null;
  }

  _evaluate(dt) {
    const sunPos = this.sun;
    const controls = { autoTracking: this.autoTracking, manual: this.manual };
    for (const panel of Object.values(this.panels)) {
      panel.step(dt, sunPos, this.weather, controls);
    }
  }

  step(realDt) {
    const realElapsed = Math.min(realDt, MAX_REAL_DELTA);
    const simulated = realElapsed * this.timeScale;
    if (simulated <= 0) return;

    const substeps = Math.min(Math.ceil(simulated / MAX_SUBSTEP), MAX_SUBSTEPS);
    const dt = simulated / substeps;

    for (let i = 0; i < substeps; i++) {
      if (this.running) {
        this.timeOfDay += dt / 3600;
        if (this.timeOfDay >= 24) this.timeOfDay -= 24;
      }
      this._evaluate(dt);
    }

    this._sinceHistory += realElapsed;
    if (this._sinceHistory >= HISTORY_INTERVAL) {
      this._sinceHistory = 0;
      const sample = { t: this.timeOfDay };
      for (const [id, panel] of Object.entries(this.panels)) {
        sample[id] = panel.point.powerAc;
        sample[`${id}Energy`] = panel.energyWattHours;
      }
      this.history.push(sample);
      if (this.history.length > HISTORY_LENGTH) this.history.shift();
    }

    this._sincePublish += realElapsed;
    if (this._sincePublish >= PUBLISH_INTERVAL) {
      this._sincePublish = 0;
      this.publish();
    }
  }

  snapshot() {
    const panels = {};
    let totalPower = 0;
    let totalEnergy = 0;

    for (const [id, runtime] of Object.entries(this.panels)) {
      panels[id] = {
        id,
        mode: runtime.spec.mode,
        ...runtime.point,
        energyWh: runtime.energyWattHours,
        specificYield: runtime.specificYield,
      };
      totalPower += runtime.point.powerAc;
      totalEnergy += runtime.energyWattHours;
    }

    return {
      timeOfDay: this.timeOfDay,
      running: this.running,
      autoTracking: this.autoTracking,
      manual: { ...this.manual },
      weather: { ...this.weather },
      sun: this.sun,
      daylight: daylightHours(this.site.latitude, this.weather.dayOfYear),
      history: this.history,
      panels,
      totalPower,
      totalEnergy,
    };
  }

  publish() {
    const snap = this.snapshot();
    this._listeners.forEach((listener) => listener(snap));
  }
}

export const solarEngine = new SolarEngine();

if (import.meta.env?.DEV) {
  globalThis.__solar = solarEngine;
}

export { PANEL_BY_ID };
