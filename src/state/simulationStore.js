/**
 * UI state, and the bridge from the physics engine into React.
 *
 * Two kinds of state live here:
 *
 *   controls   what the user has set -- wind speed, selection, toggles.
 *              Changing one writes through to the engine immediately.
 *   telemetry  a snapshot of the engine, refreshed ~10x a second. React
 *              components read this; nothing reads the engine directly
 *              except the 3D scene, which needs per-frame values.
 */

import { create } from 'zustand';
import { engine } from '../physics/SimulationEngine.js';
import { solarEngine } from '../physics/solar/SolarEngine.js';
import { TURBINES, TURBINE_IDS } from '../physics/turbineSpecs.js';
import { AIR_DENSITY_SEA_LEVEL, WIND_SPEED_DEFAULT } from '../physics/constants.js';
import { DEFAULT_MODE, MODE_TABS, modeOf } from '../modes/energyModes.js';

export const useSimulation = create((set, get) => ({
  // --- mode -------------------------------------------------------------
  mode: DEFAULT_MODE,

  /**
   * Switching mode never touches either engine's accumulated state -- both
   * keep running -- so you can set a wind speed, look at the solar side and
   * come back to find the turbines where you left them.
   */
  setMode: (mode) => {
    const tabs = MODE_TABS[mode] ?? MODE_TABS.wind;
    const { activeTab } = get();
    set({
      mode,
      // Keep the current tab if the new mode has it; otherwise fall back.
      activeTab: tabs.includes(activeTab) ? activeTab : tabs[0],
      comparisonMode: tabs.includes(activeTab) && activeTab === 'compare',
    });
  },

  // --- controls ---------------------------------------------------------
  windSpeed: WIND_SPEED_DEFAULT,
  airDensity: AIR_DENSITY_SEA_LEVEL,
  timeScale: 1,
  selectedId: TURBINES[0].id,
  comparisonMode: false,
  language: 'kk',

  // --- view toggles -----------------------------------------------------
  showParticles: true,
  showLabels: true,
  showTechnical: true,
  panelOpen: true,
  activeTab: 'live',

  // --- engine snapshots --------------------------------------------------
  telemetry: engine.snapshot(),
  running: { ...engine.running },
  solar: solarEngine.snapshot(),

  // --- solar controls ----------------------------------------------------
  setTimeOfDay: (hours) => {
    solarEngine.setTimeOfDay(hours);
    set({ solar: solarEngine.snapshot() });
  },

  setSolarRunning: (value) => {
    solarEngine.setRunning(value);
    set({ solar: solarEngine.snapshot() });
  },

  toggleSolarRunning: () => get().setSolarRunning(!get().solar.running),

  setSolarTimeScale: (value) => {
    solarEngine.setTimeScale(value);
    set({ solarTimeScale: value });
  },
  solarTimeScale: 1,

  setTracking: (value) => {
    solarEngine.setTracking(value);
    set({ solar: solarEngine.snapshot() });
  },

  setPanelOrientation: (partial) => {
    solarEngine.setManual(partial);
    set({ solar: solarEngine.snapshot() });
  },

  setWeather: (partial) => {
    solarEngine.setWeather(partial);
    set({ solar: solarEngine.snapshot() });
  },

  resetSolar: () => {
    solarEngine.reset();
    set({ solar: solarEngine.snapshot() });
  },

  /** Show the sun's rays travelling to the array. */
  showRays: true,

  // --- actions ----------------------------------------------------------
  setWindSpeed: (value) => {
    engine.setWindSpeed(value);
    set({ windSpeed: value });
  },

  setAirDensity: (value) => {
    engine.setAirDensity(value);
    set({ airDensity: value });
  },

  setTimeScale: (value) => {
    engine.setTimeScale(value);
    set({ timeScale: value });
  },

  select: (id) => set({ selectedId: id }),

  setComparisonMode: (value) => set({ comparisonMode: value, activeTab: value ? 'compare' : 'live' }),

  setActiveTab: (tab) => set({ activeTab: tab, comparisonMode: tab === 'compare' }),

  setLanguage: (language) => set({ language }),

  toggle: (key) => set((state) => ({ [key]: !state[key] })),

  /** Start or pause one turbine. */
  setRunning: (id, value) => {
    engine.setRunning(id, value);
    set({ running: { ...engine.running } });
  },

  toggleRunning: (id) => {
    const next = !get().running[id];
    get().setRunning(id, next);
  },

  /** Start or pause all three at once, used by the comparison view. */
  setAllRunning: (value) => {
    TURBINE_IDS.forEach((id) => engine.setRunning(id, value));
    set({ running: { ...engine.running } });
  },

  /** Clear accumulated energy and elapsed time. Omit id to reset all. */
  reset: (id) => {
    engine.reset(id);
    set({ telemetry: engine.snapshot() });
  },
}));

// The engines own the clock; these are the only paths by which their
// numbers reach React. Subscribed once, at module load, for the life of the
// page. Both publish at 10 Hz, independently of the render rate.
engine.subscribe((snapshot) => {
  useSimulation.setState({ telemetry: snapshot });
});

solarEngine.subscribe((snapshot) => {
  useSimulation.setState({ solar: snapshot });
});

/** Convenience selector: telemetry for the turbine currently selected. */
export const selectActiveTelemetry = (state) => state.telemetry.turbines[state.selectedId];

/** Telemetry for whichever solar panel the tracking switch selects. */
export const selectSolarPanel = (state) => (
  state.solar.trackingEnabled ? state.solar.tracking : state.solar.fixed
);

/**
 * Power selectors.
 *
 * These deliberately return NUMBERS, one per call, rather than one tidy
 * `{ wind, solar, total }` object. A selector that builds an object returns
 * a fresh reference on every invocation, so zustand's equality check never
 * matches, the subscribing component re-renders, the selector runs again --
 * and React aborts with "Maximum update depth exceeded". Primitives compare
 * by value and settle immediately.
 */
export const selectWindPower = (state) => (
  modeOf(state.mode).hasWind
    ? TURBINE_IDS.reduce((sum, id) => sum + (state.telemetry.turbines[id]?.powerElectrical ?? 0), 0)
    : 0
);

export const selectSolarPower = (state) => (
  modeOf(state.mode).hasSolar ? (selectSolarPanel(state)?.powerAc ?? 0) : 0
);

/** Accumulated energy, watt-hours, for whichever sources the mode contains. */
export const selectWindEnergy = (state) => (
  modeOf(state.mode).hasWind
    ? TURBINE_IDS.reduce((sum, id) => sum + (state.telemetry.turbines[id]?.energyWh ?? 0), 0)
    : 0
);

export const selectSolarEnergy = (state) => (
  modeOf(state.mode).hasSolar ? (selectSolarPanel(state)?.energyWh ?? 0) : 0
);
