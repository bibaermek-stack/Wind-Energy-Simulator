/**
 * Drives the physics engine from the render loop.
 *
 * Renders nothing. It exists so that the engine is stepped exactly once
 * per frame, inside R3F's loop, using the same delta the scene is drawn
 * with -- which is what keeps the rotor angle the dashboard reports and
 * the rotor angle on screen the same number.
 */

import { useFrame } from '@react-three/fiber';
import { engine } from '../../physics/SimulationEngine.js';

export default function SimulationClock() {
  useFrame((_, delta) => {
    engine.step(delta);
  });
  return null;
}
