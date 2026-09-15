/**
 * Live readouts for the selected turbine.
 *
 * The power-chain cascade is the centrepiece. Four bars, each scaled
 * against the same denominator -- the total kinetic power in the wind --
 * so the width you see *is* the fraction of the wind's energy surviving to
 * that stage. The Betz tick marks 59.3% of the first bar: the ceiling no
 * open-rotor turbine can pass, drawn where a student can compare it
 * directly against what this machine actually achieves.
 */

import { TURBINE_BY_ID } from '../../physics/turbineSpecs.js';
import { BETZ_LIMIT } from '../../physics/constants.js';
import { useSimulation } from '../../state/simulationStore.js';
import { STATUS_LABEL, T, UNITS } from '../../i18n/strings.js';
import {
  formatPower, formatEnergy, number, percent, duration, powerString,
} from '../../utils/format.js';
import { Section, Reading, EnergyReading } from './primitives.jsx';

/** One bar of the conversion cascade. */
function ChainStage({ stage, label, watts, denominator, note, betz }) {
  const fraction = denominator > 0 ? Math.min(watts / denominator, 1) : 0;
  const { value, unit } = formatPower(watts);

  return (
    <div className="chain__stage" data-stage={stage}>
      <div className="chain__head">
        <span className="chain__label">{label}</span>
        <span className="chain__value num">
          {value}
          <span>{unit}</span>
        </span>
      </div>
      <div className="chain__track">
        <div className="chain__fill" style={{ width: `${fraction * 100}%` }} />
        {betz && (
          <span
            className="chain__betz"
            style={{ left: `${BETZ_LIMIT * 100}%` }}
            data-label={`Betz ${percent(BETZ_LIMIT, 1)}`}
          />
        )}
      </div>
      {note && <p className="chain__note">{note}</p>}
    </div>
  );
}

export default function EnergyDashboard() {
  const selectedId = useSimulation((s) => s.selectedId);
  const live = useSimulation((s) => s.telemetry.turbines[s.selectedId]);
  const running = useSimulation((s) => s.running[s.selectedId]);
  const spec = TURBINE_BY_ID[selectedId];

  if (!live) return null;

  const status = STATUS_LABEL[running ? live.status : 'paused'];
  const power = formatPower(live.powerElectrical);
  const energy = formatEnergy(live.energyWh);

  return (
    <>
      <Section title={T.currentTurbine} aside={spec.typeCode}>
        <h3 style={{ fontSize: 'var(--t-lead)', fontWeight: 600, lineHeight: 1.2 }}>
          {spec.name.kk}
        </h3>
        <p style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-soft)', marginTop: 2 }}>
          {spec.typeLabel.kk}
        </p>

        <div style={{ marginTop: 12 }}>
          <span className="status" data-tone={status.tone}>
            <span className="pulse" data-state={status.tone} aria-hidden="true" />
            {status.text}
          </span>
          {status.note && <p className="status__note">{status.note}</p>}
        </div>
      </Section>

      <Section title={T.electricalPower}>
        <div className="readout-primary">
          <span className="readout-primary__value num">{power.value}</span>
          <span className="readout-primary__unit">{power.unit}</span>
        </div>
        <p className="readout-primary__caption">
          {`${percent(live.capacityFactor, 0)} ${T.ofRated} (${powerString(spec.ratedPower)})`}
        </p>

        <Reading label={T.rotorSpeed} value={number(live.rpm, 1)} unit={UNITS.rpm} />
        <Reading
          label={T.tipSpeed}
          value={number(live.tipSpeed, 1)}
          unit={UNITS.windSpeed}
          note={`λ = ${number(live.tipSpeedRatio, 2)}`}
        />
        <EnergyReading label={T.energyGenerated} wattHours={live.energyWh} emphasis />
        <Reading label={T.runningTime} value={duration(live.elapsed)} />
      </Section>

      <Section title={T.powerChain} aside={T.ofBetz}>
        <div className="chain">
          <ChainStage
            stage="wind"
            label={T.powerWind}
            watts={live.powerWind}
            denominator={live.powerWind}
            note={T.powerWindNote}
            betz
          />
          <ChainStage
            stage="aero"
            label={T.powerAero}
            watts={live.powerAero}
            denominator={live.powerWind}
            note={`${T.powerAeroNote} — Cp = ${number(live.cp, 3)}`}
          />
          <ChainStage
            stage="mech"
            label={T.powerMech}
            watts={live.powerMech}
            denominator={live.powerWind}
            note={`${T.powerMechNote} — η = ${percent(spec.etaDrivetrain, 0)}`}
          />
          <ChainStage
            stage="electrical"
            label={T.powerElectrical}
            watts={live.powerElectrical}
            denominator={live.powerWind}
            note={`${T.powerElectricalNote} — η = ${percent(spec.etaGenerator, 0)}`}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <Reading
            label={T.overallEfficiency}
            value={percent(live.overallEfficiency, 1)}
            note={`${T.powerElectrical} ÷ ${T.powerWind}`}
            emphasis
          />
          <Reading
            label={T.powerCoefficient}
            value={number(live.cp, 3)}
            note={`${percent(live.cp / BETZ_LIMIT, 0)} ${T.ofBetz}`}
          />
        </div>
      </Section>
    </>
  );
}
