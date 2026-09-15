/**
 * SimulationEngine -- the time-stepping core.
 *
 * Deliberately framework-free and mutable. It is stepped once per rendered
 * frame from inside R3F's useFrame, and the 3D scene reads rotor angles
 * straight off it every frame. Routing 60 Hz rotor angles through React
 * state would re-render the whole dashboard sixty times a second for no
 * benefit, so instead the engine publishes a *snapshot* to the React store
 * at a modest rate (see PUBLISH_INTERVAL) while the scene reads the live
 * values directly.
 *
 * All three turbines are always integrated, whether or not one is
 * selected -- that is what lets the comparison view stay live.
 */

import { TURBINES } from './turbineSpecs.js';
import { operatingPoint, targetAngularVelocity } from './windPower.js';
import { AIR_DENSITY_SEA_LEVEL } from './constants.js';

/** How often a snapshot is pushed into React state, in seconds. */
export const PUBLISH_INTERVAL = 0.1;

/** How often a point is appended to the time-series history, in seconds. */
const HISTORY_INTERVAL = 0.25;

/** Points retained in the rolling history (60 s of wall-clock at 0.25 s). */
const HISTORY_LENGTH = 240;

/**
 * Integration step size, in simulated seconds.
 *
 * A frame longer than this is split into several steps rather than
 * truncated. Truncating would be the easy option, but it makes simulated
 * time run slower than the wall clock whenever the frame rate drops --
 * at 5 fps the simulation would advance at half speed and quietly
 * under-count energy, with nothing on screen to say so.
 */
const MAX_SUBSTEP = 0.1;

/**
 * Work cap per frame. If a frame needs more substeps than this (a high
 * time scale on a slow display), the substeps are made proportionally
 * larger instead, so total simulated time stays correct even though the
 * energy integral gets coarser through a transient.
 *
 * Rotor speed is unaffected either way: its first-order response is
 * integrated in closed form, which is exact for any step size.
 */
const MAX_SUBSTEPS = 120;

/**
 * Real-time delta above which we assume the tab was suspended rather than
 * merely slow, and skip the interval instead of trying to catch up. A
 * backgrounded tab fires no frames at all, so it returns with a delta of
 * seconds or minutes; a genuinely slow render stays well under a second.
 */
const MAX_REAL_DELTA = 1.0;

class TurbineRuntime {
  constructor(spec) {
    this.spec = spec;
    this.reset();
  }

  reset() {
    /** Rotor angle, radians. Read by the scene every frame. */
    this.angle = 0;
    /** Rotor speed, rad/s. Lags the target because the rotor has inertia. */
    this.angularVelocity = 0;
    /** Accumulated electrical energy, joules. */
    this.energyJoules = 0;
    /** Simulated time this turbine has been running, seconds. */
    this.elapsed = 0;
    this.history = [];
    this.point = operatingPoint(this.spec, 0, 0, AIR_DENSITY_SEA_LEVEL);
  }

  /**
   * Advance by dt seconds of *simulated* time.
   *
   * The rotor is given first-order inertia: it eases towards the speed the
   * controller is asking for rather than snapping to it. tau is a stand-in
   * for J/(damping) -- large rotors take much longer to spin up than small
   * ones, which is why the 66 m machine visibly lags the 1.8 m one when
   * you move the wind slider.
   */
  step(dt, windSpeed, airDensity, running) {
    const target = running ? targetAngularVelocity(windSpeed, this.spec, airDensity) : 0;

    // Exponential approach, integrated exactly over dt so the result is
    // independent of frame rate: w(t+dt) = target + (w - target) e^(-dt/tau)
    const decay = Math.exp(-dt / this.spec.rotorInertiaTau);
    this.angularVelocity = target + (this.angularVelocity - target) * decay;
    if (Math.abs(this.angularVelocity) < 1e-4) this.angularVelocity = 0;

    this.angle += this.angularVelocity * dt;
    if (this.angle > Math.PI * 2) this.angle %= Math.PI * 2;

    this.point = operatingPoint(this.spec, windSpeed, this.angularVelocity, airDensity);

    if (running) {
      this.elapsed += dt;
      this.energyJoules += this.point.powerElectrical * dt;
    }
  }

  recordHistory(simulatedClock) {
    this.history.push({
      t: simulatedClock,
      power: this.point.powerElectrical,
      rpm: this.point.rpm,
      energy: this.energyWattHours,
      wind: this.point.windSpeed,
    });
    if (this.history.length > HISTORY_LENGTH) this.history.shift();
  }

  /** Accumulated electrical energy in watt-hours (1 Wh = 3600 J). */
  get energyWattHours() {
    return this.energyJoules / 3600;
  }
}

export class SimulationEngine {
  constructor(specs = TURBINES) {
    this.turbines = Object.fromEntries(specs.map((spec) => [spec.id, new TurbineRuntime(spec)]));

    this.windSpeed = 8;
    this.airDensity = AIR_DENSITY_SEA_LEVEL;
    /** Simulated seconds per real second. Lets kWh accumulate visibly. */
    this.timeScale = 1;
    /** Per-turbine run/pause flags, owned by the UI. */
    this.running = Object.fromEntries(specs.map((spec) => [spec.id, true]));

    /** Simulated clock, seconds. Advances only while something is running. */
    this.clock = 0;
    this._sincePublish = 0;
    this._sinceHistory = 0;
    this._listeners = new Set();
  }

  /** Subscribe to snapshots. Returns an unsubscribe function. */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  setWindSpeed(value) { this.windSpeed = value; }
  setAirDensity(value) { this.airDensity = value; }
  setTimeScale(value) { this.timeScale = value; }
  setRunning(id, value) { this.running[id] = value; }

  reset(id) {
    if (id) {
      this.turbines[id].reset();
    } else {
      Object.values(this.turbines).forEach((t) => t.reset());
      this.clock = 0;
    }
    this.publish();
  }

  /**
   * Step every turbine. `realDt` is the wall-clock frame delta from
   * useFrame.
   *
   * A long frame is divided into substeps rather than truncated, so the
   * simulation keeps pace with the wall clock on a slow machine and at a
   * high time scale. A very long delta means the tab was suspended, and
   * that interval is skipped outright -- catching up on minutes of missed
   * time would dump a spike of energy into the totals for a period nobody
   * was watching.
   */
  step(realDt) {
    const realElapsed = Math.min(realDt, MAX_REAL_DELTA);
    const total = realElapsed * this.timeScale;
    if (total <= 0) return;

    const substeps = Math.min(Math.ceil(total / MAX_SUBSTEP), MAX_SUBSTEPS);
    const dt = total / substeps;
    const ids = Object.keys(this.turbines);

    for (let i = 0; i < substeps; i++) {
      for (const id of ids) {
        this.turbines[id].step(dt, this.windSpeed, this.airDensity, this.running[id]);
      }
    }

    this.clock += total;

    // History and snapshots are paced in real time, not simulated time, so
    // a high time scale does not flood the charts.
    this._sinceHistory += realElapsed;
    if (this._sinceHistory >= HISTORY_INTERVAL) {
      this._sinceHistory = 0;
      Object.values(this.turbines).forEach((t) => t.recordHistory(this.clock));
    }

    this._sincePublish += realElapsed;
    if (this._sincePublish >= PUBLISH_INTERVAL) {
      this._sincePublish = 0;
      this.publish();
    }
  }

  /** Plain, serialisable view of the current state, for React. */
  snapshot() {
    const turbines = {};
    for (const [id, runtime] of Object.entries(this.turbines)) {
      turbines[id] = {
        id,
        running: this.running[id],
        elapsed: runtime.elapsed,
        energyWh: runtime.energyWattHours,
        history: runtime.history,
        ...runtime.point,
      };
    }
    return { clock: this.clock, windSpeed: this.windSpeed, airDensity: this.airDensity, turbines };
  }

  publish() {
    const snap = this.snapshot();
    this._listeners.forEach((listener) => listener(snap));
  }
}

/**
 * The single engine instance. A module singleton rather than React context
 * because the 3D scene needs synchronous, allocation-free access to it
 * inside the render loop.
 */
export const engine = new SimulationEngine();

// Exposed in development so the running simulation can be inspected from the
// browser console: window.__engine.snapshot(), .clock, .turbines.hawt.angle
if (import.meta.env?.DEV) {
  globalThis.__engine = engine;
}
