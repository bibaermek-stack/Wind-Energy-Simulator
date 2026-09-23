/**
 * The three-panel comparison.
 *
 * All three panels are integrated by the engine at all times from one set
 * of inputs -- same sun, same sky, same electrical parameters -- so this
 * view needs no special simulation path, and the only thing that differs
 * between the columns is how each panel's orientation is decided.
 *
 * Daily energy is integrated analytically over the whole day rather than
 * taken from whatever the live run happens to have accumulated, so the
 * headline figures are a property of the physics and not of how long the
 * page has been open.
 *
 * All three arrays are identical hardware, so a "best" mark on watts is
 * now a fair statement about aim. The per-square-metre rows carry the
 * same ranking in intensive form.
 */

import { useMemo } from 'react';

import {
  SOLAR_PANELS, SITE, FIXED_TILT, FIXED_AZIMUTH,
} from '../../physics/solar/solarSpecs.js';
import { sunPosition, formatHour } from '../../physics/solar/sunPosition.js';
import { operatingPoint, trackingOrientation } from '../../physics/solar/solarPower.js';
import { useSimulation } from '../../state/simulationStore.js';
import { T, UNITS } from '../../i18n/strings.js';
import {
  powerString, energyString, number, percent,
} from '../../utils/format.js';
import { Section, Reading, Notice } from './primitives.jsx';
import { ThreePanelPowerChart, SpecificYieldChart } from './SolarChart.jsx';

/** Integrates a whole simulated day for each panel, in watt-hours. */
function useDailyEnergy(weather, manual) {
  return useMemo(() => {
    const stepHours = 2 / 60;
    const totals = Object.fromEntries(SOLAR_PANELS.map((p) => [p.id, 0]));

    for (let hour = 0; hour < 24; hour += stepHours) {
      const pos = sunPosition(hour, SITE.latitude, weather.dayOfYear);
      if (pos.altitude <= 0) continue;
      const aim = trackingOrientation(pos);

      for (const spec of SOLAR_PANELS) {
        const angles = spec.mode === 'auto' ? aim
          : spec.mode === 'manual' ? manual
            : { tilt: FIXED_TILT, azimuth: FIXED_AZIMUTH };
        totals[spec.id] += operatingPoint(spec, pos, angles.tilt, angles.azimuth, weather).powerAc * stepHours;
      }
    }
    return totals;
  }, [weather, manual]);
}

export default function TrackingComparison() {
  const solar = useSimulation((s) => s.solar);
  const daily = useDailyEnergy(solar.weather, solar.manual);
  const panels = solar.panels;

  /** Daily energy per square metre -- the size-independent headline. */
  const dailyYield = Object.fromEntries(
    SOLAR_PANELS.map((p) => [p.id, daily[p.id] / p.apertureArea]),
  );
  const fixedYield = dailyYield.fixed || 1;

  const rows = [
    {
      label: T.panelMode,
      values: SOLAR_PANELS.map((p) => p.typeCode),
    },
    {
      label: T.panelArea,
      values: SOLAR_PANELS.map((p) => `${number(p.apertureArea, 2)} ${UNITS.squareMetre}`),
    },
    {
      label: T.panelTilt,
      values: SOLAR_PANELS.map((p) => `${number(panels[p.id]?.tilt ?? 0, 1)}°`),
    },
    {
      label: T.panelAzimuth,
      values: SOLAR_PANELS.map((p) => `${number(panels[p.id]?.azimuth ?? 0, 1)}°`),
    },
    {
      label: T.alignmentAngle,
      values: SOLAR_PANELS.map((p) => `${number(panels[p.id]?.incidenceDeg ?? 0, 1)}°`),
      // Smallest angle wins here, so the ranking is inverted.
      raw: SOLAR_PANELS.map((p) => -(panels[p.id]?.incidenceDeg ?? 90)),
    },
    {
      label: T.cosTheta,
      values: SOLAR_PANELS.map((p) => number(panels[p.id]?.cosTheta ?? 0, 3)),
      raw: SOLAR_PANELS.map((p) => panels[p.id]?.cosTheta ?? 0),
    },
    {
      label: T.planeIrradiance,
      values: SOLAR_PANELS.map((p) => `${number(panels[p.id]?.planeIrradiance ?? 0, 0)} ${UNITS.irradiance}`),
      raw: SOLAR_PANELS.map((p) => panels[p.id]?.planeIrradiance ?? 0),
    },
    {
      label: T.powerAc,
      values: SOLAR_PANELS.map((p) => powerString(panels[p.id]?.powerAc ?? 0)),
      raw: SOLAR_PANELS.map((p) => panels[p.id]?.powerAc ?? 0),
    },
    {
      label: T.specificYield,
      values: SOLAR_PANELS.map((p) => `${number(panels[p.id]?.specificYield ?? 0, 0)} W/m²`),
      raw: SOLAR_PANELS.map((p) => panels[p.id]?.specificYield ?? 0),
    },
    {
      label: T.energyGenerated,
      values: SOLAR_PANELS.map((p) => energyString(panels[p.id]?.energyWh ?? 0)),
    },
    {
      label: T.dailyEnergy,
      values: SOLAR_PANELS.map((p) => energyString(daily[p.id])),
      raw: SOLAR_PANELS.map((p) => daily[p.id]),
    },
    {
      label: T.dailyEnergyPerArea,
      values: SOLAR_PANELS.map((p) => `${number(dailyYield[p.id] / 1000, 3)} kWh/m²`),
      raw: SOLAR_PANELS.map((p) => dailyYield[p.id]),
    },
  ];

  return (
    <Section title={T.compareThree} aside={formatHour(solar.timeOfDay)}>
      <p className="prose" style={{ marginBottom: 12 }}>{T.compareThreeIntro}</p>

      <div className="versus versus--three">
        {SOLAR_PANELS.map((spec) => (
          <div key={spec.id} className="versus__side" style={{ '--accent': spec.accent }}>
            <span className="versus__label">{spec.shortName.kk}</span>
            <span className="versus__value num">{powerString(panels[spec.id]?.powerAc ?? 0)}</span>
            <span className="versus__sub num">
              {`${number(panels[spec.id]?.specificYield ?? 0, 0)} W/m²`}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <Reading
          label={T.trackingGain}
          value={`+${number((dailyYield.auto / fixedYield - 1) * 100, 1)}`}
          unit={UNITS.percent}
          note={T.trackingGainThreeNote}
          emphasis
        />
        <Reading
          label={T.manualGain}
          value={`${dailyYield.manual >= fixedYield ? '+' : ''}${number((dailyYield.manual / fixedYield - 1) * 100, 1)}`}
          unit={UNITS.percent}
          note={T.manualGainNote}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <ThreePanelPowerChart />
        <SpecificYieldChart />
      </div>

      <div className="table-scroll" style={{ marginTop: 18 }}>
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">{T.parameter}</th>
              {SOLAR_PANELS.map((spec) => (
                <th key={spec.id} scope="col" style={{ '--accent': spec.accent }}>
                  <span className="compare-table__head">
                    <span>{spec.shortName.kk}</span>
                    <span>{spec.typeCode}</span>
                    <span className="compare-table__accent" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const best = row.raw ? Math.max(...row.raw) : null;
              return (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((value, i) => (
                    <td
                      key={SOLAR_PANELS[i].id}
                      className="num"
                      data-best={best != null && row.raw[i] === best && best !== 0}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="chain__note" style={{ marginTop: 8 }}>{T.absoluteNotMarked}</p>

      <div style={{ marginTop: 12 }}>
        <Notice>{T.specificYieldNotice}</Notice>
      </div>
      <div style={{ marginTop: 10 }}>
        <Notice>{T.trackerMountNotice}</Notice>
      </div>
      <div style={{ marginTop: 10 }}>
        <Notice signal>{T.solarModelNotice}</Notice>
      </div>
    </Section>
  );
}
