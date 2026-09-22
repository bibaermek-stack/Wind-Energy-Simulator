/**
 * Solar charts.
 *
 * Same conventions as the wind charts: one y-scale per chart, recessive
 * hairline grid, no value printed on every point, the live operating point
 * marked on the analytic curves, and a legend whenever there is more than
 * one series.
 *
 * The daily curve always draws BOTH panels, whether or not comparison mode
 * is on. The area between the two lines is the entire argument for tracking,
 * and it is worth showing all the time rather than hiding behind a toggle.
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, LineChart,
  Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot,
} from 'recharts';

import { SOLAR_ARRAY, SITE, TIME_MIN, TIME_MAX } from '../../physics/solar/solarSpecs.js';
import { sunPosition, formatHour } from '../../physics/solar/sunPosition.js';
import { operatingPoint, trackingOrientation } from '../../physics/solar/solarPower.js';
import { useSimulation, selectSolarPanel } from '../../state/simulationStore.js';
import { T, UNITS } from '../../i18n/strings.js';
import { powerAxisUnit, axisPower, number, powerString } from '../../utils/format.js';

const RULE = '#dae4ef';
const INK_SOFT = '#64798f';
const CHART_HEIGHT = 172;

const TRACKING_COLOUR = '#b45309';
const FIXED_COLOUR = '#1d4ed8';

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

function ChartBlock({ title, subtitle, unit, children, legend }) {
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
      {legend && (
        <div className="chart-legend">
          {legend.map((item) => (
            <span key={item.label} className="chart-legend__item">
              <span
                className="chart-legend__swatch"
                style={{
                  background: item.dashed
                    ? `repeating-linear-gradient(90deg, ${item.colour} 0 3px, transparent 3px 6px)`
                    : item.colour,
                }}
              />
              {item.label}
            </span>
          ))}
        </div>
      )}
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
          <span className="chart-tooltip__value">{formatter(entry.value, entry.dataKey)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Samples the whole day for both panels.
 * Depends only on the weather and the fixed panel's angles, so it is
 * recomputed when those change and not on every frame.
 */
function useDailyCurve(spec, weather, fixedTilt, fixedAzimuth) {
  // Depend on the weather *values*, not the snapshot object. The engine
  // publishes a fresh `weather: { ... }` every 100 ms, and treating that
  // identity as a dependency recomputed 121 operating points on every
  // telemetry tick — which is what made the charts hitch.
  const { cloudFraction, ambientC, dayOfYear } = weather;
  return useMemo(() => {
    const sky = { cloudFraction, ambientC, dayOfYear };
    const points = [];
    for (let i = 0; i <= 120; i++) {
      const hour = TIME_MIN + ((TIME_MAX - TIME_MIN) * i) / 120;
      const pos = sunPosition(hour, SITE.latitude, dayOfYear);
      const aim = trackingOrientation(pos);
      points.push({
        hour: Number(hour.toFixed(3)),
        altitude: Math.max(pos.altitude, 0),
        azimuth: pos.azimuth,
        tracking: operatingPoint(spec, pos, aim.tilt, aim.azimuth, sky).powerAc,
        fixed: operatingPoint(spec, pos, fixedTilt, fixedAzimuth, sky).powerAc,
      });
    }
    return points;
  }, [spec, cloudFraction, ambientC, dayOfYear, fixedTilt, fixedAzimuth]);
}

/* ==========================================================================
   Power through the day
   ========================================================================== */

export function SolarDayChart() {
  const solar = useSimulation((s) => s.solar);
  const panel = useSimulation(selectSolarPanel);
  const spec = SOLAR_ARRAY;

  const data = useDailyCurve(spec, solar.weather, solar.manual.tilt, solar.manual.azimuth);
  const peak = Math.max(...data.map((d) => Math.max(d.tracking, d.fixed)), 1);
  const { divisor, unit } = powerAxisUnit(peak);

  return (
    <ChartBlock
      title={T.chartSolarDayTitle}
      subtitle={T.chartSolarDaySubtitle}
      unit={unit}
      legend={[
        { label: T.legendTracking, colour: TRACKING_COLOUR },
        { label: T.legendFixed, colour: FIXED_COLOUR, dashed: true },
      ]}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 16, left: 0 }}>
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

          {/* The gap between the two curves is the tracking gain. */}
          <Area
            type="monotone"
            dataKey="tracking"
            stroke="none"
            fill={tint(TRACKING_COLOUR, 0.86)}
            isAnimationActive={false}
            tooltipType="none"
          />
          <Line
            type="monotone"
            dataKey="fixed"
            name={T.legendFixed}
            stroke={FIXED_COLOUR}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="tracking"
            name={T.legendTracking}
            stroke={TRACKING_COLOUR}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={false}
          />

          <ReferenceLine x={12} stroke={INK_SOFT} strokeDasharray="3 3" />
          {panel && (
            <ReferenceDot
              x={Number(Math.min(Math.max(solar.timeOfDay, TIME_MIN), TIME_MAX).toFixed(3))}
              y={panel.powerAc}
              r={4.5}
              fill={solar.trackingEnabled ? TRACKING_COLOUR : FIXED_COLOUR}
              stroke="#fff"
              strokeWidth={2}
              isFront
            />
          )}

          <Tooltip
            cursor={{ stroke: INK_SOFT, strokeDasharray: '3 3' }}
            content={(props) => <Tip {...props} formatter={(v) => powerString(v)} />}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartBlock>
  );
}

/* ==========================================================================
   The sun's path
   ========================================================================== */

export function SunPathChart() {
  const solar = useSimulation((s) => s.solar);
  const spec = SOLAR_ARRAY;
  const data = useDailyCurve(spec, solar.weather, solar.manual.tilt, solar.manual.azimuth);

  return (
    <ChartBlock
      title={T.chartSunPathTitle}
      subtitle={T.chartSunPathSubtitle}
      unit={UNITS.degree}
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
    </ChartBlock>
  );
}

/* ==========================================================================
   Panel
   ========================================================================== */

export default function SolarChartPanel() {
  return (
    <>
      <SolarDayChart />
      <SunPathChart />
    </>
  );
}
