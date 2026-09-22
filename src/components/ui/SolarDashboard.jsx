/**
 * Live readouts for the solar array.
 *
 * The conversion cascade is the same device the wind dashboard uses, for
 * the same reason: the losses are shown as length rather than asserted as
 * percentages. Here the four stages are the light arriving on the aperture,
 * what survives the incidence angle, what the cells convert, and what
 * leaves the inverter.
 *
 * The alignment readout uses the real computed angle -- OPTIMAL ALIGNMENT
 * appears when cos(theta) is above 0.985, not when a timer says so.
 */

import { SOLAR_ARRAY, SITE, STC_IRRADIANCE } from '../../physics/solar/solarSpecs.js';
import { useSimulation, selectSolarPanel } from '../../state/simulationStore.js';
import { formatHour } from '../../physics/solar/sunPosition.js';
import { SOLAR_STATUS, T, UNITS } from '../../i18n/strings.js';
import {
  formatPower, formatEnergy, number, percent, powerString,
} from '../../utils/format.js';
import { Section, Reading, EnergyReading, Notice } from './primitives.jsx';

/** One bar of the light-to-electricity cascade. */
function Stage({ stage, label, watts, denominator, note }) {
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
      </div>
      {note && <p className="chain__note">{note}</p>}
    </div>
  );
}

export default function SolarDashboard() {
  const solar = useSimulation((s) => s.solar);
  const panel = useSimulation(selectSolarPanel);
  const showTechnical = useSimulation((s) => s.showTechnical);
  const spec = SOLAR_ARRAY;

  if (!panel) return null;

  const status = SOLAR_STATUS[panel.status] ?? SOLAR_STATUS.night;
  const power = formatPower(panel.powerAc);

  return (
    <>
      <Section title={T.solarPanel} aside={spec.typeCode}>
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

      <Section title={T.sunSection} aside={formatHour(solar.timeOfDay)}>
        <Reading
          label={T.sunAltitude}
          value={number(solar.sun.altitude, 1)}
          unit={UNITS.degree}
          note={T.sunAltitudeNote}
        />
        <Reading
          label={T.sunAzimuth}
          value={number(solar.sun.azimuth, 1)}
          unit={UNITS.degree}
          note={T.sunAzimuthNote}
        />
        <Reading
          label={T.beamIrradiance}
          value={number(panel.beamIrradiance, 0)}
          unit={UNITS.irradiance}
          note={T.beamIrradianceNote}
        />
        <Reading
          label={T.diffuseIrradiance}
          value={number(panel.diffuseIrradiance, 0)}
          unit={UNITS.irradiance}
          note={T.diffuseIrradianceNote}
        />
        <Reading
          label={T.planeIrradiance}
          value={number(panel.planeIrradiance, 0)}
          unit={UNITS.irradiance}
          note={`${T.planeIrradianceNote} — ${percent(panel.planeIrradiance / STC_IRRADIANCE, 0)} STC`}
          emphasis
        />
      </Section>

      <Section title={T.solarPower}>
        <div className="readout-primary">
          <span className="readout-primary__value num">{power.value}</span>
          <span className="readout-primary__unit">{power.unit}</span>
        </div>
        <p className="readout-primary__caption">
          {`${percent(panel.capacityFactor, 0)} ${T.ofRated} (${powerString(spec.ratedPower)})`}
        </p>

        <Reading
          label={T.panelTilt}
          value={number(panel.tilt, 1)}
          unit={UNITS.degree}
        />
        <Reading
          label={T.panelAzimuth}
          value={number(panel.azimuth, 1)}
          unit={UNITS.degree}
        />
        <Reading
          label={T.incidenceAngle}
          value={number(panel.incidenceDeg, 1)}
          unit={UNITS.degree}
          note={`${T.cosTheta} = ${number(panel.cosTheta, 3)}`}
          emphasis
        />
        <Reading
          label={T.tracking}
          value={solar.trackingEnabled ? T.trackingOn : T.trackingOff}
        />
        <EnergyReading label={T.dailyEnergy} wattHours={panel.energyWh} emphasis />
      </Section>

      <Section title={T.energyFlow}>
        <div className="chain">
          <Stage
            stage="wind"
            label={T.powerIncident}
            watts={panel.powerIncident}
            denominator={panel.powerIncident}
            note={T.powerIncidentNote}
          />
          <Stage
            stage="aero"
            label={T.powerDc}
            watts={panel.powerDc}
            denominator={panel.powerIncident}
            note={`${T.powerDcNote} — η = ${percent(spec.efficiency, 0)}`}
          />
          <Stage
            stage="electrical"
            label={T.powerAc}
            watts={panel.powerAc}
            denominator={panel.powerIncident}
            note={`${T.powerAcNote} — η = ${percent(spec.inverterEfficiency, 0)}`}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <Reading
            label={T.overallEfficiency}
            value={percent(panel.systemEfficiency, 1)}
            note={`${T.powerAc} ÷ ${T.powerIncident}`}
            emphasis
          />
          <Reading
            label={T.cellTemperature}
            value={number(panel.cellTemperature, 1)}
            unit={UNITS.celsius}
            note={`${percent(panel.temperatureFactor - 1, 1)} ${T.temperatureCoefficient.toLowerCase()}`}
          />
        </div>
      </Section>

      {showTechnical && (
        <Section title={T.technicalParameters} aside={spec.typeCode}>
          <p className="prose" style={{ marginBottom: 12 }}>{spec.description.kk}</p>

          <div className="reading-grid">
            <Reading
              label={T.panelArea}
              value={number(spec.apertureArea, 2)}
              unit={UNITS.squareMetre}
              note={T.panelAreaNote}
            />
            <Reading label={T.moduleCount} value={spec.moduleCount} />
            <Reading
              label={T.arraySize}
              value={`${number(spec.widthM, 2)} × ${number(spec.depthM, 2)}`}
              unit={UNITS.metre}
            />
            <Reading label={T.ratedPower} value={powerString(spec.ratedPower)} emphasis />
            <Reading label={T.panelEfficiency} value={percent(spec.efficiency, 0)} />
            <Reading label={T.inverterEfficiency} value={percent(spec.inverterEfficiency, 0)} />
            <Reading
              label={T.temperatureCoefficient}
              value={`${number(spec.temperatureCoefficient * 100, 2)} %/°C`}
            />
            <Reading label={T.noct} value={`${number(spec.noct, 0)} ${UNITS.celsius}`} />
            <Reading label={T.soiling} value={percent(spec.soilingFactor, 0)} />
            <Reading
              label={T.site}
              value={`${SITE.latitude}°N`}
              note={`${SITE.name.kk} · ${T.siteNote}`}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <Notice>{T.solarExampleNotice}</Notice>
          </div>
        </Section>
      )}
    </>
  );
}
