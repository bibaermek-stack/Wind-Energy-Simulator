/**
 * Live readouts for the three solar panels.
 *
 * The three cards are the heart of it: same sun, same sky, three different
 * control mechanisms, three different answers. Each card carries both
 * figures that matter --
 *
 *   absolute watts   what this installation actually makes
 *   W/m^2            the same number per square metre of glass
 *
 * All three arrays are identical -- sixteen modules, 26.14 m^2 -- so a watt
 * is a fair comparison. The bar under each card is still drawn on specific
 * yield, which is the intensive form of that same figure.
 */

import {
  SOLAR_PANELS, PANEL_BY_ID, SITE, STC_IRRADIANCE, TOTAL_RATED_POWER,
} from '../../physics/solar/solarSpecs.js';
import { useSimulation } from '../../state/simulationStore.js';
import { formatHour } from '../../physics/solar/sunPosition.js';
import { T, UNITS } from '../../i18n/strings.js';
import {
  formatPower, formatEnergy, number, percent, powerString, energyString,
} from '../../utils/format.js';
import { Section, Reading, Notice } from './primitives.jsx';

/** One panel's live card. */
function PanelCard({ spec, panel, bestYield, autoTracking }) {
  if (!panel) return null;
  const power = formatPower(panel.powerAc);
  const share = bestYield > 0 ? panel.specificYield / bestYield : 0;
  const stalled = spec.mode === 'auto' && !autoTracking;

  return (
    <div className="panel-card" style={{ '--accent': spec.accent }}>
      <div className="panel-card__head">
        <span className="panel-card__name">{spec.name.kk}</span>
        <span className="panel-card__mode">
          {stalled ? T.trackingOff : spec.typeCode}
        </span>
      </div>

      <div className="panel-card__power">
        <span className="panel-card__value num">{power.value}</span>
        <span className="panel-card__unit">{power.unit}</span>
      </div>

      <div className="panel-card__bar">
        <div className="panel-card__fill" style={{ width: `${share * 100}%` }} />
      </div>

      <div className="panel-card__row">
        <span>{T.specificYield}</span>
        <b className="num">{`${number(panel.specificYield, 0)} W/m²`}</b>
      </div>
      <div className="panel-card__row">
        <span>{T.alignmentAngle}</span>
        <b className="num">{`${number(panel.incidenceDeg, 1)}°`}</b>
      </div>
      <div className="panel-card__row">
        <span>{`${T.panelTilt} / ${T.panelAzimuth}`}</span>
        <b className="num">{`${number(panel.tilt, 1)}° / ${number(panel.azimuth, 1)}°`}</b>
      </div>
      <div className="panel-card__row">
        <span>{T.energyGenerated}</span>
        <b className="num">{energyString(panel.energyWh)}</b>
      </div>
    </div>
  );
}

export default function SolarDashboard() {
  const solar = useSimulation((s) => s.solar);
  const showTechnical = useSimulation((s) => s.showTechnical);

  const panels = solar.panels;
  const bestYield = Math.max(...SOLAR_PANELS.map((p) => panels[p.id]?.specificYield ?? 0), 1e-6);
  const reference = panels.auto;

  return (
    <>
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
          value={number(reference?.beamIrradiance ?? 0, 0)}
          unit={UNITS.irradiance}
          note={T.beamIrradianceNote}
        />
        <Reading
          label={T.diffuseIrradiance}
          value={number(reference?.diffuseIrradiance ?? 0, 0)}
          unit={UNITS.irradiance}
          note={T.diffuseIrradianceNote}
        />
        <Reading
          label={T.planeIrradiance}
          value={number(reference?.planeIrradiance ?? 0, 0)}
          unit={UNITS.irradiance}
          note={`${T.planeIrradianceNote} — ${percent((reference?.planeIrradiance ?? 0) / STC_IRRADIANCE, 0)} STC`}
          emphasis
        />
      </Section>

      <Section title={T.threePanels} aside={T.sameConditions}>
        <div className="panel-cards">
          {SOLAR_PANELS.map((spec) => (
            <PanelCard
              key={spec.id}
              spec={spec}
              panel={panels[spec.id]}
              bestYield={bestYield}
              autoTracking={solar.autoTracking}
            />
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          <Reading label={T.totalPower} value={powerString(solar.totalPower)} emphasis />
          <Reading
            label={T.totalEnergy}
            value={energyString(solar.totalEnergy)}
            note={`${T.installedCapacity} ${powerString(TOTAL_RATED_POWER)}`}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <Notice>{T.specificYieldNotice}</Notice>
        </div>
      </Section>

      {showTechnical && (
        <Section title={T.technicalParameters} aside="PV">
          {SOLAR_PANELS.map((spec) => (
            <div key={spec.id} style={{ marginBottom: 14 }}>
              <div className="panel-heading" style={{ '--accent': spec.accent }}>
                <span className="panel-heading__name">{spec.name.kk}</span>
                <span className="panel-heading__power num">{powerString(spec.ratedPower)}</span>
              </div>
              <p className="prose" style={{ marginBottom: 8 }}>{spec.description.kk}</p>
              <Reading
                label={T.panelArea}
                value={number(spec.apertureArea, 2)}
                unit={UNITS.squareMetre}
                note={T.panelAreaNote}
              />
              <Reading
                label={T.arraySize}
                value={`${number(spec.widthM, 2)} × ${number(spec.depthM, 2)}`}
                unit={UNITS.metre}
              />
              <Reading label={T.moduleCount} value={spec.moduleCount} />
            </div>
          ))}

          <div className="reading-grid">
            <Reading label={T.panelEfficiency} value={percent(PANEL_BY_ID.auto.efficiency, 0)} />
            <Reading label={T.inverterEfficiency} value={percent(PANEL_BY_ID.auto.inverterEfficiency, 0)} />
            <Reading
              label={T.temperatureCoefficient}
              value={`${number(PANEL_BY_ID.auto.temperatureCoefficient * 100, 2)} %/°C`}
            />
            <Reading label={T.noct} value={`${number(PANEL_BY_ID.auto.noct, 0)} ${UNITS.celsius}`} />
            <Reading label={T.soiling} value={percent(PANEL_BY_ID.auto.soilingFactor, 0)} />
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
