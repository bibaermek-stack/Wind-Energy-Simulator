/**
 * The 3D scene: canvas, lighting, environment, and the three turbines.
 *
 * Lighting note -- this scene is 1.4 km across with a 92 m turbine in it,
 * so the shadow camera has to be sized by hand. A default directional
 * light's 10 m shadow frustum would leave everything unshadowed; the
 * settings below cover the installation strip at a usable texel density
 * and no more, because widening the frustum further would blur the tower
 * shadows into nothing.
 */

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Sky, Clouds, Cloud, AdaptiveDpr, Preload, useProgress, Html,
} from '@react-three/drei';
import * as THREE from 'three';

import { TURBINES } from '../../physics/turbineSpecs.js';
import { useSimulation } from '../../state/simulationStore.js';
import WindTurbine from './WindTurbine.jsx';
import Landscape from './Landscape.jsx';
import WindParticles from './WindParticles.jsx';
import CameraRig from './CameraRig.jsx';
import SimulationClock from './SimulationClock.jsx';
import Sun from './Sun.jsx';
import SolarArray from './SolarArray.jsx';
import SunRays from './SunRays.jsx';
import { modeOf } from '../../modes/energyModes.js';
import { SOLAR_PANELS, SOLAR_VIEW } from '../../physics/solar/solarSpecs.js';
import { T } from '../../i18n/strings.js';

/** Mid-morning sun: low enough to throw long, readable shadows. */
const SUN_POSITION = [-210, 175, 240];

/**
 * Converts the computed solar position into the far-field point drei's Sky
 * wants, so the sky's own glow sits where our sun disc is drawn.
 */
function skySunPosition({ altitude, azimuth }) {
  const a = (altitude * Math.PI) / 180;
  const z = (azimuth * Math.PI) / 180;
  const cosAlt = Math.cos(a);
  const r = 900;
  return [r * cosAlt * Math.sin(z), r * Math.sin(a), -r * cosAlt * Math.cos(z)];
}

/**
 * Lighting.
 *
 * In wind mode the key light is the fixed mid-morning sun the scene has
 * always used, so the wind simulation looks exactly as it did. When the
 * solar side is on screen the computed sun takes the key light over, which
 * is what swings the shadows round as the time slider moves -- see Sun.jsx.
 */
function Lighting({ solarSun }) {
  return (
    <>
      {/* Sky and ground bounce. Warm above, green-tinted below, because the
          grass is what is actually bouncing light back onto the towers. */}
      <hemisphereLight args={['#cfe4ff', '#6c8a4a', solarSun ? 0.7 : 1.0]} />

      {!solarSun && (
        <directionalLight
          position={SUN_POSITION}
          intensity={2.5}
          color="#fff6e6"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0006}
          shadow-normalBias={0.35}
          shadow-camera-near={10}
          shadow-camera-far={760}
          shadow-camera-left={-230}
          shadow-camera-right={230}
          shadow-camera-top={230}
          shadow-camera-bottom={-230}
        />
      )}

      {/* A dim fill from the opposite side keeps the shaded faces of the
          towers from going flat black. */}
      <directionalLight position={[180, 90, -200]} intensity={0.32} color="#dce8ff" />
    </>
  );
}

function Weather({ solarSun }) {
  const windSpeed = useSimulation((s) => s.windSpeed);
  const cloudFraction = useSimulation((s) => s.solar.weather.cloudFraction);
  const sunPos = useSimulation((s) => s.solar.sun);
  // Clouds drift with the wind, which quietly reinforces the slider.
  const drift = 0.06 + windSpeed * 0.035;
  // Cloud cover thickens the cloud layer, so the weather slider is visible
  // in the sky and not only in the numbers.
  const cover = solarSun ? cloudFraction : 0;
  const opacity = (base) => base + (1 - base) * cover * 0.85;

  return (
    <>
      <Sky
        distance={4500}
        sunPosition={solarSun ? skySunPosition(sunPos) : SUN_POSITION}
        turbidity={2.4}
        rayleigh={0.55}
        mieCoefficient={0.004}
        mieDirectionalG={0.82}
      />
      <Clouds material={THREE.MeshLambertMaterial} limit={320} range={260}>
        <Cloud seed={11} position={[-160, 210, -120]} bounds={[130, 16, 90]} volume={95}
          opacity={opacity(0.42)} growth={7} speed={drift} color="#ffffff" segments={34} />
        <Cloud seed={27} position={[80, 245, -260]} bounds={[150, 18, 100]} volume={110}
          opacity={opacity(0.32)} growth={8} speed={drift * 0.8} color="#f2f6fb" segments={30} />
        <Cloud seed={43} position={[-40, 190, 200]} bounds={[120, 14, 80]} volume={80}
          opacity={opacity(0.26)} growth={6} speed={drift * 1.15} color="#ffffff" segments={26} />
      </Clouds>
    </>
  );
}

function LoadingOverlay() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="scene-loader">
        <div className="scene-loader__spinner" />
        <p className="scene-loader__title">{T.loading}</p>
        <p className="scene-loader__hint">{T.loadingHint}</p>
        <div className="scene-loader__bar">
          <div className="scene-loader__fill" style={{ width: `${progress.toFixed(0)}%` }} />
        </div>
      </div>
    </Html>
  );
}

export default function WindTurbineScene() {
  const showParticles = useSimulation((s) => s.showParticles);
  const showLabels = useSimulation((s) => s.showLabels);
  const showRays = useSimulation((s) => s.showRays);
  const mode = modeOf(useSimulation((s) => s.mode));

  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [-37, 76, 78], fov: 42, near: 0.5, far: 4000 }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.02;
        // Fog tuned to start beyond the last turbine, so the machines stay
        // crisp while the mountains recede into aerial perspective.
        scene.fog = new THREE.Fog('#cbdcee', 340, 1320);
      }}
    >
      <Lighting solarSun={mode.hasSolar} />
      <Weather solarSun={mode.hasSolar} />

      {mode.hasSolar && <Sun target={SOLAR_VIEW.target} />}

      <Suspense fallback={<LoadingOverlay />}>
        <Landscape />

        {/* The turbines are mounted only in modes that contain them, but
            their engine keeps running either way, so switching back finds
            them exactly where they were. */}
        {mode.hasWind && TURBINES.map((spec) => (
          <WindTurbine key={spec.id} spec={spec} />
        ))}

        {mode.hasSolar && SOLAR_PANELS.map((panel) => (
          <SolarArray key={panel.id} spec={panel} showLabel={showLabels} />
        ))}

        <Preload all />
      </Suspense>

      {mode.hasWind && <WindParticles visible={showParticles} />}
      {mode.hasSolar && <SunRays visible={showRays} />}

      <CameraRig />
      <SimulationClock />
      <AdaptiveDpr pixelated />
    </Canvas>
  );
}
