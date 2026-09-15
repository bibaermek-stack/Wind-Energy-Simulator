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
import { TURBINES, TURBINE_IDS } from '../physics/turbineSpecs.js';
import { AIR_DENSITY_SEA_LEVEL, WIND_SPEED_DEFAULT } from '../physics/constants.js';

export const useSimulation = create((set, get) => ({
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

  // --- engine snapshot --------------------------------------------------
  telemetry: engine.snapshot(),
  running: { ...engine.running },

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

// The engine owns the clock; this is the only path by which its numbers
// reach React. Subscribed once, at module load, for the life of the page.
engine.subscribe((snapshot) => {
  useSimulation.setState({ telemetry: snapshot });
});

/** Convenience selector: telemetry for the turbine currently selected. */
export const selectActiveTelemetry = (state) => state.telemetry.turbines[state.selectedId];
