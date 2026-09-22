/**
 * SolarEngine -- the solar side's time-stepping core.
 *
 * Deliberately mirrors SimulationEngine's contract: `step(realDt)`,
 * `snapshot()`, `subscribe(fn)`, `reset()`. The clock component steps both,
 * the store bridges both the same way, and hybrid mode simply reads both
 * snapshots. Nothing in the wind engine had to change to allow this.
 *
 * Two panels are integrated at once -- one fixed, one tracking -- from a
 * single set of inputs. That is what makes the comparison honest: same sun,
 * same sky, same hardware, only the orientation differs.
 */

import {
  SOLAR_ARRAY, SITE,
  TIME_DEFAULT, TILT_DEFAULT, AZIMUTH_DEFAULT,
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

/** Simulated seconds per real second at each time-scale setting. */
export const TIME_SCALES = [1, 10, 100, 1000];

/**
 * One panel: its actual orientation, which lags its target, plus the energy
 * it has produced.
 */
class PanelRuntime {
  constructor(spec, { tracking }) {
    this.spec = spec;
    this.tracking = tracking;
    this.reset();
  }

  reset() {
    this.tilt = this.tracking ? 0 : TILT_DEFAULT;
    this.azimuth = AZIMUTH_DEFAULT;
    this.energyJoules = 0;
    this.point = null;
  }

  /**
   * Slews towards the target orientation at a finite rate.
   *
   * A real tracker takes minutes to cross the sky, and instantly snapping
   * the array to a new angle would both look wrong and hide the fact that
   * tracking is a mechanical process. Azimuth takes the short way round, so
   * a tracker passing 359 -> 1 degrees does not unwind the long way.
   */
  slew(target, dt) {
    const rate = this.spec.trackingSlewRate * dt;

    const dTilt = target.tilt - this.tilt;
    this.tilt += Math.sign(dTilt) * Math.min(Math.abs(dTilt), rate);

    let dAz = ((target.azimuth - this.azimuth + 540) % 360) - 180;
    this.azimuth = (this.azimuth + Math.sign(dAz) * Math.min(Math.abs(dAz), rate) + 360) % 360;
  }

  step(dt, sunPos, weather, manual) {
    const target = this.tracking ? trackingOrientation(sunPos) : manual;
    this.slew(target, dt);
    this.point = operatingPoint(this.spec, sunPos, this.tilt, this.azimuth, weather);
    this.energyJoules += this.point.powerAc * dt;
  }

  get energyWattHours() {
    return this.energyJoules / 3600;
  }
}

export class SolarEngine {
  constructor(spec = SOLAR_ARRAY, site = SITE) {
    this.spec = spec;
    this.site = site;

    /** Solar time of day, hours. The main control. */
    this.timeOfDay = TIME_DEFAULT;
    /** Whether the clock advances on its own. */
    this.running = false;
    this.timeScale = 1;

    /** Manual orientation, used when tracking is off. */
    this.manual = { tilt: TILT_DEFAULT, azimuth: AZIMUTH_DEFAULT };
    this.trackingEnabled = true;

    this.weather = {
      cloudFraction: CLOUD_DEFAULT,
      ambientC: TEMPERATURE_DEFAULT,
      dayOfYear: site.dayOfYear,
    };

    this.panels = {
      tracking: new PanelRuntime(spec, { tracking: true }),
      fixed: new PanelRuntime(spec, { tracking: false }),
    };

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
  setTracking(value) { this.trackingEnabled = value; }
  setManual(partial) { Object.assign(this.manual, partial); }
  setWeather(partial) { Object.assign(this.weather, partial); this._evaluate(0); this.publish(); }

  reset() {
    this.timeOfDay = TIME_DEFAULT;
    Object.values(this.panels).forEach((p) => p.reset());
    this.history = [];
    this._evaluate(0);
    this.publish();
  }

  /**
   * The panel the interface is talking about: the tracking one when
   * tracking is enabled, the fixed one when it is not.
   */
  get activePanel() {
    return this.trackingEnabled ? this.panels.tracking : this.panels.fixed;
  }

  get sun() {
    return sunPosition(this.timeOfDay, this.site.latitude, this.weather.dayOfYear);
  }

  _evaluate(dt) {
    const sunPos = this.sun;
    // The tracking panel always tracks; the fixed panel always sits where
    // the manual sliders put it. Both are integrated regardless of which
    // one the interface is currently showing, so switching the tracking
    // toggle never loses the other one's accumulated energy.
    this.panels.tracking.step(dt, sunPos, this.weather, this.manual);
    this.panels.fixed.step(dt, sunPos, this.weather, this.manual);
  }

  step(realDt) {
    const realElapsed = Math.min(realDt, MAX_REAL_DELTA);
    const simulated = realElapsed * this.timeScale;
    if (simulated <= 0) return;

    const substeps = Math.min(Math.ceil(simulated / MAX_SUBSTEP), MAX_SUBSTEPS);
    const dt = simulated / substeps;

    for (let i = 0; i < substeps; i++) {
      if (this.running) {
        // Advance the solar clock. Time of day is in hours, dt in seconds.
        this.timeOfDay += dt / 3600;
        if (this.timeOfDay >= 24) this.timeOfDay -= 24;
      }
      this._evaluate(dt);
    }

    this._sinceHistory += realElapsed;
    if (this._sinceHistory >= HISTORY_INTERVAL) {
      this._sinceHistory = 0;
      this.history.push({
        t: this.timeOfDay,
        tracking: this.panels.tracking.point.powerAc,
        fixed: this.panels.fixed.point.powerAc,
        energy: this.activePanel.energyWattHours,
      });
      if (this.history.length > HISTORY_LENGTH) this.history.shift();
    }

    this._sincePublish += realElapsed;
    if (this._sincePublish >= PUBLISH_INTERVAL) {
      this._sincePublish = 0;
      this.publish();
    }
  }

  snapshot() {
    const sunPos = this.sun;
    const daylight = daylightHours(this.site.latitude, this.weather.dayOfYear);
    return {
      timeOfDay: this.timeOfDay,
      running: this.running,
      trackingEnabled: this.trackingEnabled,
      manual: { ...this.manual },
      weather: { ...this.weather },
      sun: sunPos,
      daylight,
      history: this.history,
      tracking: {
        ...this.panels.tracking.point,
        energyWh: this.panels.tracking.energyWattHours,
        actualTilt: this.panels.tracking.tilt,
        actualAzimuth: this.panels.tracking.azimuth,
      },
      fixed: {
        ...this.panels.fixed.point,
        energyWh: this.panels.fixed.energyWattHours,
        actualTilt: this.panels.fixed.tilt,
        actualAzimuth: this.panels.fixed.azimuth,
      },
    };
  }

  /** Telemetry for whichever panel the interface is showing. */
  active() {
    const snap = this.snapshot();
    return this.trackingEnabled ? snap.tracking : snap.fixed;
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
