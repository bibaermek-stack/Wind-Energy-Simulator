/**
 * Fixed panel against tracking panel.
 *
 * Both panels are integrated by the engine at all times from one set of
 * inputs -- same sun, same sky, same aperture, same efficiency -- so this
 * view needs no special simulation path and the comparison is genuinely
 * like for like. The only difference between them is where they point.
 *
 * The daily-energy figures are integrated over the whole day analytically
 * rather than taken from whatever the live run happens to have accumulated,
 * so the headline gain is a property of the physics and not of how long the
 * page has been open.
 */

import { useMemo } from 'react';

import { SOLAR_ARRAY, SITE } from '../../physics/solar/solarSpecs.js';
import { sunPosition, formatHour } from '../../physics/solar/sunPosition.js';
import { operatingPoint, trackingOrientation } from '../../physics/solar/solarPower.js';
import { useSimulation } from '../../state/simulationStore.js';
import { T, UNITS } from '../../i18n/strings.js';
import {
  powerString, energyString, number, percent,
} from '../../utils/format.js';
import { Section, Notice } from './primitives.jsx';
import { SolarDayChart } from './SolarChart.jsx';

/** Integrates a whole simulated day for both panels, in watt-hours. */
function useDailyEnergy(spec, weather, fixedTilt, fixedAzimuth) {
  // Primitive deps only — see useDailyCurve in SolarChart.jsx.
  const { cloudFraction, ambientC, dayOfYear } = weather;
  return useMemo(() => {
    const sky = { cloudFraction, ambientC, dayOfYear };
    const stepHours = 2 / 60;
    let tracking = 0;
    let fixed = 0;
    for (let hour = 0; hour < 24; hour += stepHours) {
      const pos = sunPosition(hour, SITE.latitude, dayOfYear);
      if (pos.altitude <= 0) continue;
      const aim = trackingOrientation(pos);
      tracking += operatingPoint(spec, pos, aim.tilt, aim.azimuth, sky).powerAc * stepHours;
      fixed += operatingPoint(spec, pos, fixedTilt, fixedAzimuth, sky).powerAc * stepHours;
    }
    return { tracking, fixed, gain: fixed > 0 ? tracking / fixed - 1 : 0 };
  }, [spec, cloudFraction, ambientC, dayOfYear, fixedTilt, fixedAzimuth]);
}

/** A side-by-side pair of headline readouts. */
function Versus({ fixed, tracking }) {
  return (
    <div className="versus">
      <div className="versus__side" style={{ '--accent': '#1d4ed8' }}>
        <span className="versus__label">{T.panelA}</span>
        <span className="versus__value num">{powerString(fixed)}</span>
      </div>
      <div className="versus__side" style={{ '--accent': '#b45309' }}>
        <span className="versus__label">{T.panelB}</span>
        <span className="versus__value num">{powerString(tracking)}</span>
      </div>
    </div>
  );
}

export default function TrackingComparison() {
  const solar = useSimulation((s) => s.solar);
  const spec = SOLAR_ARRAY;
  const daily = useDailyEnergy(spec, solar.weather, solar.manual.tilt, solar.manual.azimuth);

  const rows = [
    {
      label: T.panelTilt,
      fixed: `${number(solar.fixed.tilt, 1)}°`,
      tracking: `${number(solar.tracking.tilt, 1)}°`,
    },
    {
      label: T.panelAzimuth,
      fixed: `${number(solar.fixed.azimuth, 1)}°`,
      tracking: `${number(solar.tracking.azimuth, 1)}°`,
    },
    {
      label: T.incidenceAngle,
      fixed: `${number(solar.fixed.incidenceDeg, 1)}°`,
      tracking: `${number(solar.tracking.incidenceDeg, 1)}°`,
      best: 'tracking',
    },
    {
      label: T.cosTheta,
      fixed: number(solar.fixed.cosTheta, 3),
      tracking: number(solar.tracking.cosTheta, 3),
      raw: [solar.fixed.cosTheta, solar.tracking.cosTheta],
    },
    {
      label: T.planeIrradiance,
      fixed: `${number(solar.fixed.planeIrradiance, 0)} ${UNITS.irradiance}`,
      tracking: `${number(solar.tracking.planeIrradiance, 0)} ${UNITS.irradiance}`,
      raw: [solar.fixed.planeIrradiance, solar.tracking.planeIrradiance],
    },
    {
      label: T.powerAc,
      fixed: powerString(solar.fixed.powerAc),
      tracking: powerString(solar.tracking.powerAc),
      raw: [solar.fixed.powerAc, solar.tracking.powerAc],
    },
    {
      label: T.capacityFactor,
      fixed: percent(solar.fixed.capacityFactor, 0),
      tracking: percent(solar.tracking.capacityFactor, 0),
      raw: [solar.fixed.capacityFactor, solar.tracking.capacityFactor],
    },
    {
      label: T.cellTemperature,
      fixed: `${number(solar.fixed.cellTemperature, 1)} ${UNITS.celsius}`,
      tracking: `${number(solar.tracking.cellTemperature, 1)} ${UNITS.celsius}`,
    },
    {
      label: T.dailyEnergy,
      fixed: energyString(daily.fixed),
      tracking: energyString(daily.tracking),
      raw: [daily.fixed, daily.tracking],
    },
  ];

  return (
    <Section title={T.compareTracking} aside={formatHour(solar.timeOfDay)}>
      <p className="prose" style={{ marginBottom: 12 }}>{T.compareTrackingIntro}</p>

      <Versus fixed={solar.fixed.powerAc} tracking={solar.tracking.powerAc} />

      <div className="reading" style={{ marginTop: 10 }}>
        <span className="reading__label">
          {T.trackingGain}
          <span className="reading__note">{`${T.trackingGainNote} — ${T.dailyEnergy.toLowerCase()}`}</span>
        </span>
        <span className="reading__value num" style={{ fontWeight: 600, color: '#b45309' }}>
          {`+${number(daily.gain * 100, 1)}`}
          <span className="reading__unit">{UNITS.percent}</span>
        </span>
      </div>

      <div style={{ marginTop: 16 }}>
        <SolarDayChart />
      </div>

      <div className="table-scroll" style={{ marginTop: 18 }}>
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">{T.parameter}</th>
              <th scope="col" style={{ '--accent': '#1d4ed8' }}>
                <span className="compare-table__head">
                  <span>{T.panelA}</span>
                  <span>fixed</span>
                  <span className="compare-table__accent" />
                </span>
              </th>
              <th scope="col" style={{ '--accent': '#b45309' }}>
                <span className="compare-table__head">
                  <span>{T.panelB}</span>
                  <span>tracking</span>
                  <span className="compare-table__accent" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const winner = row.raw
                ? (row.raw[1] > row.raw[0] ? 'tracking' : (row.raw[0] > row.raw[1] ? 'fixed' : null))
                : row.best ?? null;
              return (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td className="num" data-best={winner === 'fixed'}>{row.fixed}</td>
                  <td className="num" data-best={winner === 'tracking'}>{row.tracking}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12 }}>
        <Notice>{T.solarModelNotice}</Notice>
      </div>
    </Section>
  );
}
