/**
 * Solar charts.
 *
 * Conventions match the wind charts: one y-scale per chart, recessive
 * hairline grid, no value printed on every point, the live operating point
 * marked on the analytic curves, and a legend whenever there is more than
 * one series.
 *
 * Panel colours are fixed per panel and never reassigned, so the same
 * colour means the same panel in the 3D labels, the dashboard cards, the
 * charts and the comparison table.
 *
 * Two power charts, deliberately:
 *
 *   absolute W     what each installation makes -- the practical answer
 *   specific W/m^2 what each makes per square metre -- the fair comparison
 *
 * The mounts have different areas, so the absolute chart partly reflects
 * size. The specific chart divides that out and shows the effect of
 * orientation alone, which is what the module is teaching.
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, AreaChart,
  Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot,
} from 'recharts';

import {
  SOLAR_PANELS, SITE, TIME_MIN, TIME_MAX, FIXED_TILT, FIXED_AZIMUTH,
} from '../../physics/solar/solarSpecs.js';
import { sunPosition, formatHour } from '../../physics/solar/sunPosition.js';
import { operatingPoint, trackingOrientation } from '../../physics/solar/solarPower.js';
import { useSimulation } from '../../state/simulationStore.js';
import { T, UNITS } from '../../i18n/strings.js';
import { powerAxisUnit, axisPower, number, powerString, energyString } from '../../utils/format.js';

const RULE = '#dae4ef';
const INK_SOFT = '#64798f';
const CHART_HEIGHT = 176;

const tickStyle = {
  fill: INK_SOFT,
  fontSize: 10,
  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
};

const axisLabelStyle = {
  fill: INK_SOFT,
  fontSize: 10,
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
};

function tint(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

function ChartBlock({ title, subtitle, unit, children }) {
  return (
    <figure className="chart-block">
      <figcaption className="chart-block__head">
        <div className="chart-block__title">{title}</div>
        <div className="chart-block__subtitle">
          {subtitle}
          {unit && <span className="chart-block__unit num">{unit}</span>}
        </div>
      </figcaption>
      <div className="chart-frame">{children}</div>
      <div className="chart-legend">
        {SOLAR_PANELS.map((p) => (
          <span key={p.id} className="chart-legend__item">
            <span className="chart-legend__swatch" style={{ background: p.accent }} />
            {p.shortName.kk}
          </span>
        ))}
      </div>
    </figure>
  );
}

function Tip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__head">{formatHour(Number(label))}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="chart-tooltip__row">
          <span>
            <span className="chart-tooltip__swatch" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="chart-tooltip__value">{formatter(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Samples the whole day for all three panels.
 *
 * The auto panel is sampled at its ideal orientation rather than at the
 * angle it has actually slewed to: this is the analytic characteristic,
 * what a tracker delivers when it is keeping up. The live dot marks where
 * the simulation actually is, so a stalled tracker shows as a dot sitting
 * below its own curve -- which is precisely the cost of the stall.
 */
function useDayCurves(weather, manual) {
  return useMemo(() => {
    const points = [];
    for (let i = 0; i <= 120; i++) {
      const hour = TIME_MIN + ((TIME_MAX - TIME_MIN) * i) / 120;
      const pos = sunPosition(hour, SITE.latitude, weather.dayOfYear);
      const aim = trackingOrientation(pos);

      const row = { hour: Number(hour.toFixed(3)), altitude: Math.max(pos.altitude, 0) };
      for (const spec of SOLAR_PANELS) {
        const angles = spec.mode === 'auto' ? aim
          : spec.mode === 'manual' ? manual
            : { tilt: FIXED_TILT, azimuth: FIXED_AZIMUTH };
        const point = operatingPoint(spec, pos, angles.tilt, angles.azimuth, weather);
        row[spec.id] = point.powerAc;
        row[`${spec.id}Yield`] = point.powerAc / spec.apertureArea;
      }
      points.push(row);
    }
    return points;
  }, [weather, manual]);
}

/** Absolute power through the day, all three panels. */
export function ThreePanelPowerChart() {
  const solar = useSimulation((s) => s.solar);
  const data = useDayCurves(solar.weather, solar.manual);
  const peak = Math.max(...data.flatMap((d) => SOLAR_PANELS.map((p) => d[p.id])), 1);
  const { divisor, unit } = powerAxisUnit(peak);
  const now = Math.min(Math.max(solar.timeOfDay, TIME_MIN), TIME_MAX);

  return (
    <ChartBlock
      title={T.chartThreePanelsTitle}
      subtitle={T.chartThreePanelsSubtitle}
      unit={unit}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 16, left: 0 }}>
          <CartesianGrid stroke={RULE} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="hour"
            type="number"
            domain={[TIME_MIN, TIME_MAX]}
            ticks={[6, 8, 10, 12, 14, 16, 18]}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: RULE }}
            tickFormatter={(v) => formatHour(v)}
            label={{ value: T.axisTimeOfDay, position: 'insideBottom', offset: -10, style: axisLabelStyle }}
          />
          <YAxis
            domain={[0, peak * 1.08]}
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => axisPower(v, divisor)}
          />
          {SOLAR_PANELS.map((spec) => (
            <Line
              key={spec.id}
              type="monotone"
              dataKey={spec.id}
              name={spec.shortName.kk}
              stroke={spec.accent}
              strokeWidth={2}
              strokeDasharray={spec.mode === 'manual' ? '5 4' : undefined}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              isAnimationActive={false}
            />
          ))}
          <ReferenceLine x={12} stroke={INK_SOFT} strokeDasharray="3 3" />
          {SOLAR_PANELS.map((spec) => (
            <ReferenceDot
              key={`dot-${spec.id}`}
              x={Number(now.toFixed(3))}
              y={solar.panels[spec.id]?.powerAc ?? 0}
              r={4}
              fill={spec.accent}
              stroke="#fff"
              strokeWidth={2}
              isFront
            />
          ))}
          <Tooltip
            cursor={{ stroke: INK_SOFT, strokeDasharray: '3 3' }}
            content={(props) => <Tip {...props} formatter={(v) => powerString(v)} />}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartBlock>
  );
}

/** Specific yield -- the size-independent comparison. */
export function SpecificYieldChart() {
  const solar = useSimulation((s) => s.solar);
  const data = useDayCurves(solar.weather, solar.manual);
  const peak = Math.max(...data.flatMap((d) => SOLAR_PANELS.map((p) => d[`${p.id}Yield`])), 1);

  return (
    <ChartBlock
      title={T.chartYieldTitle}
      subtitle={T.chartYieldSubtitle}
      unit={UNITS.irradiance}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 16, left: 0 }}>
          <CartesianGrid stroke={RULE} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="hour"
            type="number"
            domain={[TIME_MIN, TIME_MAX]}
            ticks={[6, 8, 10, 12, 14, 16, 18]}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: RULE }}
            tickFormatter={(v) => formatHour(v)}
            label={{ value: T.axisTimeOfDay, position: 'insideBottom', offset: -10, style: axisLabelStyle }}
          />
          <YAxis
            domain={[0, peak * 1.08]}
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          {SOLAR_PANELS.map((spec) => (
            <Line
              key={spec.id}
              type="monotone"
              dataKey={`${spec.id}Yield`}
              name={spec.shortName.kk}
              stroke={spec.accent}
              strokeWidth={2}
              strokeDasharray={spec.mode === 'manual' ? '5 4' : undefined}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              isAnimationActive={false}
            />
          ))}
          <ReferenceLine x={12} stroke={INK_SOFT} strokeDasharray="3 3" />
          <Tooltip
            cursor={{ stroke: INK_SOFT, strokeDasharray: '3 3' }}
            content={(props) => <Tip {...props} formatter={(v) => `${number(v, 0)} W/m²`} />}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartBlock>
  );
}

/** Accumulated energy, from the live run rather than the analytic curve. */
export function ThreePanelEnergyChart() {
  const solar = useSimulation((s) => s.solar);
  const history = solar.history;

  if (history.length < 2) {
    return (
      <ChartBlock title={T.chartEnergyThreeTitle} subtitle={T.chartEnergyThreeSubtitle}>
        <div className="chart-empty">{T.noDataYet}</div>
      </ChartBlock>
    );
  }

  const peak = Math.max(
    ...history.flatMap((h) => SOLAR_PANELS.map((p) => h[`${p.id}Energy`] ?? 0)),
    1e-6,
  );

  return (
    <ChartBlock
      title={T.chartEnergyThreeTitle}
      subtitle={T.chartEnergyThreeSubtitle}
      unit={peak >= 1000 ? 'kWh' : 'Wh'}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={history} margin={{ top: 6, right: 8, bottom: 16, left: 0 }}>
          <CartesianGrid stroke={RULE} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: RULE }}
            tickFormatter={(v) => formatHour(v)}
            label={{ value: T.axisTimeOfDay, position: 'insideBottom', offset: -10, style: axisLabelStyle }}
          />
          <YAxis
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={46}
            tickFormatter={(v) => axisPower(v, peak >= 1000 ? 1000 : 1)}
          />
          {SOLAR_PANELS.map((spec) => (
            <Area
              key={spec.id}
              type="monotone"
              dataKey={`${spec.id}Energy`}
              name={spec.shortName.kk}
              stroke={spec.accent}
              strokeWidth={2}
              fill={tint(spec.accent, 0.88)}
              fillOpacity={0.4}
              isAnimationActive={false}
            />
          ))}
          <Tooltip
            cursor={{ stroke: INK_SOFT, strokeDasharray: '3 3' }}
            content={(props) => <Tip {...props} formatter={(v) => energyString(v)} />}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartBlock>
  );
}

/** The sun's path, unchanged. */
export function SunPathChart() {
  const solar = useSimulation((s) => s.solar);
  const data = useDayCurves(solar.weather, solar.manual);

  return (
    <figure className="chart-block">
      <figcaption className="chart-block__head">
        <div className="chart-block__title">{T.chartSunPathTitle}</div>
        <div className="chart-block__subtitle">
          {T.chartSunPathSubtitle}
          <span className="chart-block__unit num">{UNITS.degree}</span>
        </div>
      </figcaption>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 16, left: 0 }}>
          <CartesianGrid stroke={RULE} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="hour"
            type="number"
            domain={[TIME_MIN, TIME_MAX]}
            ticks={[6, 8, 10, 12, 14, 16, 18]}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: RULE }}
            tickFormatter={(v) => formatHour(v)}
            label={{ value: T.axisTimeOfDay, position: 'insideBottom', offset: -10, style: axisLabelStyle }}
          />
          <YAxis
            domain={[0, 90]}
            ticks={[0, 30, 60, 90]}
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Line
            type="monotone"
            dataKey="altitude"
            name={T.legendAltitude}
            stroke="#d97706"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={false}
          />
          <ReferenceDot
            x={Number(Math.min(Math.max(solar.timeOfDay, TIME_MIN), TIME_MAX).toFixed(3))}
            y={Math.max(solar.sun.altitude, 0)}
            r={4.5}
            fill="#d97706"
            stroke="#fff"
            strokeWidth={2}
            isFront
          />
          <Tooltip
            cursor={{ stroke: INK_SOFT, strokeDasharray: '3 3' }}
            content={(props) => <Tip {...props} formatter={(v) => `${number(v, 1)}°`} />}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}

export default function SolarChartPanel() {
  return (
    <>
      <ThreePanelPowerChart />
      <SpecificYieldChart />
      <ThreePanelEnergyChart />
      <SunPathChart />
    </>
  );
}
