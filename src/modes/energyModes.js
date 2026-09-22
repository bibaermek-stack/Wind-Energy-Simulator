/**
 * The three simulation modes.
 *
 * This is the only place that knows which generators a mode contains. The
 * scene, the rails and the dashboards all ask this registry rather than
 * testing the mode string themselves, so adding a fourth mode later means
 * adding an entry here rather than hunting through components.
 *
 * The wind mode is exactly the simulation that existed before the solar
 * work; nothing about it was changed to make room.
 */

export const MODES = {
  wind: {
    id: 'wind',
    accent: '#1d4ed8',
    hasWind: true,
    hasSolar: false,
    label: { kk: 'Жел', en: 'Wind' },
    sublabel: { kk: 'Жел энергиясы', en: 'Wind energy' },
  },
  solar: {
    id: 'solar',
    accent: '#b45309',
    hasWind: false,
    hasSolar: true,
    label: { kk: 'Күн', en: 'Solar' },
    sublabel: { kk: 'Күн энергиясы', en: 'Solar energy' },
  },
  hybrid: {
    id: 'hybrid',
    accent: '#0d9488',
    hasWind: true,
    hasSolar: true,
    label: { kk: 'Гибрид', en: 'Hybrid' },
    sublabel: { kk: 'Жел + Күн', en: 'Wind + Solar' },
  },
};

export const MODE_ORDER = ['wind', 'solar', 'hybrid'];

export const DEFAULT_MODE = 'wind';

/**
 * Tabs available in each mode.
 *
 * Wind keeps precisely the tabs it had. Solar and hybrid get their own
 * sets, so the right rail never shows a turbine power curve while the
 * scene is showing a solar array.
 */
export const MODE_TABS = {
  wind: ['live', 'charts', 'compare', 'theory'],
  solar: ['live', 'charts', 'compare', 'flow', 'theory'],
  hybrid: ['live', 'flow', 'theory'],
};

export function modeOf(id) {
  return MODES[id] ?? MODES[DEFAULT_MODE];
}
