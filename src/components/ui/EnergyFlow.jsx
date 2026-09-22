/**
 * The energy-flow diagram.
 *
 * One component serves all three modes: it draws whichever chains the
 * current mode contains and joins them at the point where they physically
 * meet, which is the shared connection to the grid.
 *
 *   solar    sun -> array -> cells -> inverter ---+
 *                                                 +-> management -> grid
 *   wind     wind -> rotor -> generator ----------+
 *
 * Every stage shows its own live figure, and the connecting arrows carry a
 * flow animation whose speed follows the power actually passing through
 * them -- so a becalmed turbine's arrow stops, and a shaded panel's slows.
 * The animation is suppressed entirely under prefers-reduced-motion.
 */

import { SOLAR_ARRAY } from '../../physics/solar/solarSpecs.js';
import { TURBINES } from '../../physics/turbineSpecs.js';
import { modeOf } from '../../modes/energyModes.js';
import {
  useSimulation, selectSolarPanel,
  selectWindPower, selectSolarPower, selectWindEnergy, selectSolarEnergy,
} from '../../state/simulationStore.js';
import { T, UNITS } from '../../i18n/strings.js';
import { powerString, energyString, percent, number } from '../../utils/format.js';
import { Section, Reading, Notice } from './primitives.jsx';

/**
 * One node in the chain.
 *
 * `intensity` (0..1) drives how lit the node is, so the diagram dims as a
 * whole when little energy is flowing rather than looking equally active at
 * midnight and at noon.
 */
function Node({ label, value, note, accent, intensity = 1, emphasis = false }) {
  return (
    <div
      className={`flow-node ${emphasis ? 'flow-node--emphasis' : ''}`}
      style={{ '--accent': accent, '--intensity': intensity.toFixed(3) }}
    >
      <span className="flow-node__label">{label}</span>
      {value && <span className="flow-node__value num">{value}</span>}
      {note && <span className="flow-node__note">{note}</span>}
    </div>
  );
}

/** The connector between two nodes. */
function Arrow({ intensity = 0, accent }) {
  return (
    <div
      className="flow-arrow"
      style={{ '--accent': accent, '--intensity': Math.min(Math.max(intensity, 0), 1).toFixed(3) }}
      aria-hidden="true"
    >
      <span className="flow-arrow__track"><span className="flow-arrow__pulse" /></span>
    </div>
  );
}

function SolarChain() {
  const panel = useSimulation(selectSolarPanel);
  const solar = useSimulation((s) => s.solar);
  const spec = SOLAR_ARRAY;
  if (!panel) return null;

  const intensity = Math.min(panel.powerAc / spec.ratedPower, 1);
  const accent = spec.accent;

  return (
    <div className="flow-chain">
      <Node
        label={T.flowSun}
        value={`${number(solar.sun.altitude, 1)}°`}
        note={T.sunAltitude}
        accent={accent}
        intensity={solar.sun.altitude > 0 ? 1 : 0.2}
      />
      <Arrow intensity={Math.min(panel.planeIrradiance / 1000, 1)} accent={accent} />
      <Node
        label={T.flowPanel}
        value={`${number(panel.planeIrradiance, 0)} ${UNITS.irradiance}`}
        note={`${T.cosTheta} = ${number(panel.cosTheta, 3)}`}
        accent={accent}
        intensity={intensity}
      />
      <Arrow intensity={intensity} accent={accent} />
      <Node
        label={T.flowCells}
        value={powerString(panel.powerDc)}
        note={`DC · η = ${percent(spec.efficiency, 0)}`}
        accent={accent}
        intensity={intensity}
      />
      <Arrow intensity={intensity} accent={accent} />
      <Node
        label={T.flowInverter}
        value={powerString(panel.powerAc)}
        note={`AC · η = ${percent(spec.inverterEfficiency, 0)}`}
        accent={accent}
        intensity={intensity}
        emphasis
      />
    </div>
  );
}

function WindChain() {
  const turbines = useSimulation((s) => s.telemetry.turbines);
  const selectedId = useSimulation((s) => s.selectedId);
  const spec = TURBINES.find((t) => t.id === selectedId) ?? TURBINES[0];
  const live = turbines[spec.id];
  if (!live) return null;

  const intensity = Math.min(live.powerElectrical / spec.ratedPower, 1);
  const accent = spec.accent;

  return (
    <div className="flow-chain">
      <Node
        label={T.flowWind}
        value={`${number(live.windSpeed, 1)} ${UNITS.windSpeed}`}
        note={T.windSpeed}
        accent={accent}
        intensity={Math.min(live.windSpeed / 12, 1)}
      />
      <Arrow intensity={Math.min(live.powerWind / spec.ratedPower, 1)} accent={accent} />
      <Node
        label={T.flowTurbine}
        value={`${number(live.rpm, 1)} ${UNITS.rpm}`}
        note={`Cp = ${number(live.cp, 3)}`}
        accent={accent}
        intensity={intensity}
      />
      <Arrow intensity={intensity} accent={accent} />
      <Node
        label={T.flowGenerator}
        value={powerString(live.powerMech)}
        note={`η = ${percent(spec.etaGenerator, 0)}`}
        accent={accent}
        intensity={intensity}
      />
      <Arrow intensity={intensity} accent={accent} />
      <Node
        label={T.powerElectrical}
        value={powerString(live.powerElectrical)}
        note={spec.typeCode}
        accent={accent}
        intensity={intensity}
        emphasis
      />
    </div>
  );
}

export default function EnergyFlow() {
  const mode = modeOf(useSimulation((s) => s.mode));

  // Selected as separate primitives; see the note on these selectors in
  // simulationStore.js for why they are not one object.
  const windPower = useSimulation(selectWindPower);
  const solarPower = useSimulation(selectSolarPower);
  const windEnergy = useSimulation(selectWindEnergy);
  const solarEnergy = useSimulation(selectSolarEnergy);
  const totalPower = windPower + solarPower;

  return (
    <Section title={T.energyFlow} aside={mode.label.kk}>
      {mode.hasSolar && <SolarChain />}
      {mode.hasWind && (
        <div style={{ marginTop: mode.hasSolar ? 14 : 0 }}>
          <WindChain />
        </div>
      )}

      <div className="flow-junction">
        <Arrow intensity={totalPower > 0 ? 1 : 0} accent="#0d9488" />
        <Node
          label={mode.hasWind && mode.hasSolar ? T.flowManagement : T.flowGrid}
          value={powerString(totalPower)}
          note={T.flowTotal}
          accent="#0d9488"
          intensity={1}
          emphasis
        />
      </div>

      <div style={{ marginTop: 14 }}>
        {mode.hasWind && (
          <Reading
            label={T.windPowerTotal}
            value={powerString(windPower)}
            note={totalPower > 0 ? `${T.shareWind} ${percent(windPower / totalPower, 0)}` : null}
          />
        )}
        {mode.hasSolar && (
          <Reading
            label={T.solarPowerTotal}
            value={powerString(solarPower)}
            note={totalPower > 0 ? `${T.shareSolar} ${percent(solarPower / totalPower, 0)}` : null}
          />
        )}
        <Reading label={T.totalPower} value={powerString(totalPower)} emphasis />
        <Reading
          label={T.totalEnergy}
          value={energyString(windEnergy + solarEnergy)}
        />
      </div>

      {mode.hasWind && mode.hasSolar && (
        <div style={{ marginTop: 12 }}>
          <Notice signal>{T.hybridIntro}</Notice>
        </div>
      )}
    </Section>
  );
}
