/**
 * Drives the physics engines from the render loop.
 *
 * Renders nothing. It exists so that both engines are stepped exactly once
 * per frame, inside R3F's loop, using the same delta the scene is drawn
 * with -- which is what keeps the rotor angle and panel orientation the
 * dashboards report identical to the ones on screen.
 *
 * Both engines are stepped in every mode, not just the one on display. A
 * mode switch therefore never loses accumulated energy, and hybrid mode
 * needs no special path: it is simply the one that renders both.
 */

import { useFrame } from '@react-three/fiber';
import { engine } from '../../physics/SimulationEngine.js';
import { solarEngine } from '../../physics/solar/SolarEngine.js';

export default function SimulationClock() {
  useFrame((_, delta) => {
    engine.step(delta);
    solarEngine.step(delta);
  });
  return null;
}
