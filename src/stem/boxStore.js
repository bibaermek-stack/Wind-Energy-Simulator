/**
 * UI state for the STEM box mode.
 *
 * Kept apart from the landscape store on purpose: nothing here touches the
 * full-scale engines, and the boxes keep their own clock.
 *
 *   assembly   0 = every part laid out (the exploded drawing),
 *              1 = the finished box. One number per box, so the two can be
 *              built side by side or one at a time.
 *   target     where the assembly animation is heading, or null when idle.
 *   out        whether each box's working device has been lifted out onto
 *              the table.
 */
import { create } from 'zustand';
import { stemEngine } from './stemEngine.js';
import { STEPS } from './boxAssembly.js';

export const BOX_IDS = ['solar', 'wind'];

export const useBox = create((set, get) => ({
  focus: 'both',
  assembly: { solar: 0, wind: 0 },
  target: { solar: null, wind: null },
  speed: 1,
  out: { solar: false, wind: false },
  showLabels: true,
  telemetry: stemEngine.snapshot(),

  setFocus: (focus) => set({ focus }),
  setSpeed: (speed) => set({ speed }),
  toggleLabels: () => set({ showLabels: !get().showLabels }),

  /** The boxes the controls currently act on. */
  activeBoxes: () => (get().focus === 'both' ? BOX_IDS : [get().focus]),

  /** Animate towards fully built (1) or fully apart (0). */
  play: (to) => {
    const target = { ...get().target };
    for (const id of get().activeBoxes()) target[id] = to;
    set({ target, out: to === 0 ? { solar: false, wind: false } : get().out });
  },

  stop: () => set({ target: { solar: null, wind: null } }),

  /** One step forward or back, per box, snapped to step boundaries. */
  step: (delta) => {
    const { assembly } = get();
    const target = { ...get().target };
    for (const id of get().activeBoxes()) {
      const n = STEPS[id].length;
      const current = assembly[id] * n;
      const next = delta > 0 ? Math.floor(current + 1e-6) + 1 : Math.ceil(current - 1e-6) - 1;
      target[id] = Math.min(1, Math.max(0, next / n));
    }
    set({ target });
  },

  /** Scrubbing: jump straight to a value, cancelling any animation. */
  scrub: (value) => {
    const assembly = { ...get().assembly };
    const target = { ...get().target };
    for (const id of get().activeBoxes()) {
      assembly[id] = value;
      target[id] = null;
    }
    set({ assembly, target });
  },

  /** Called every frame by the scene while an animation is running. */
  advance: (dt) => {
    const { assembly, target, speed } = get();
    let changed = false;
    const next = { ...assembly };
    const nextTarget = { ...target };
    for (const id of BOX_IDS) {
      if (target[id] == null) continue;
      // One step per ~1.1 s at 1x, whatever the box's step count.
      const rate = (speed / 1.1) / STEPS[id].length;
      const d = target[id] - assembly[id];
      const move = Math.sign(d) * Math.min(Math.abs(d), rate * dt);
      next[id] = assembly[id] + move;
      if (Math.abs(target[id] - next[id]) < 1e-6) nextTarget[id] = null;
      changed = true;
    }
    if (changed) set({ assembly: next, target: nextTarget });
  },

  toggleOut: (id) => {
    if (get().assembly[id] < 0.999) return;
    const out = { ...get().out, [id]: !get().out[id] };
    stemEngine[id].out = out[id];
    set({ out });
  },

  // --- device controls, written straight through to the engine -----------
  setSolar: (patch) => {
    Object.assign(stemEngine.solar, patch);
    set({ telemetry: stemEngine.snapshot() });
  },
  setWind: (patch) => {
    Object.assign(stemEngine.wind, patch);
    set({ telemetry: stemEngine.snapshot() });
  },
  resetEnergy: () => {
    stemEngine.solar.energy = 0;
    stemEngine.wind.energy = 0;
    set({ telemetry: stemEngine.snapshot() });
  },

  refresh: () => set({ telemetry: stemEngine.snapshot() }),
}));

/** Which step a box is on: index of the step currently moving, or done. */
export function stepState(id, assembly) {
  const n = STEPS[id].length;
  const x = assembly * n;
  return { index: Math.min(n - 1, Math.floor(x)), within: x - Math.floor(x), done: assembly >= 0.999, n };
}
