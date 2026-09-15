/**
 * The scientific charts.
 *
 * Conventions, applied to every chart in this file:
 *
 *   - One y-scale per chart. Power and rotor speed never share an axis;
 *     they are separate charts, because a dual-axis plot invites false
 *     readings of where two unrelated curves "cross".
 *   - Within one turbine's chart, the three power levels are a sequential
 *     ramp of that turbine's own hue -- palest for the wind's total, the
 *     accent itself for the electrical output -- so the chart is tied to
 *     the machine selected in the scene. They are additionally separated
 *     by mark type (filled area / dashed line / solid line), so the
 *     reading never rests on colour alone.
 *   - Across turbines, the three identity colours are fixed and never
 *     reassigned: #1d4ed8, #0d9488, #b45309, validated for CVD separation
 *     and contrast against a white surface.
 *   - Grid and axes are recessive hairlines. No value is printed on every
 *     point; the hover tooltip carries exact figures.
 *   - The live operating point is marked on the steady-state curves, so
 *     the slider position and the curve are legibly the same fact.
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, LineChart, AreaChart,
  Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot, Legend,
} from 'recharts';

import { TURBINES, TURBINE_BY_ID } from '../../physics/turbineSpecs.js';
import {
  characteristicCurve, powerCoefficient, ratedWindSpeed, totalEfficiency,
} from '../../physics/windPower.js';
import {
  CURVE_SAMPLES, WIND_SPEED_MIN, WIND_SPEED_MAX, BETZ_LIMIT,
} from '../../physics/constants.js';
import { useSimulation } from '../../state/simulationStore.js';
import { T, UNITS } from '../../i18n/strings.js';
import {
  axisPower, powerAxisUnit, energyAxisUnit, number, powerString, energyString,
} from '../../utils/format.js';

/* ==========================================================================
   Shared chart furniture
   ========================================================================== */

const RULE = '#dae4ef';
const INK_SOFT = '#64798f';
const CHART_HEIGHT = 168;

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

/** Mixes a hex colour towards white. Used for the sequential ramps. */
function tint(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (channel) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

/**
 * A chart with its title, subtitle and legend.
 *
 * The y-axis unit is carried in the subtitle rather than as a rotated axis
 * label. A rotated label has to be offset past the tick text, and at this
 * panel width it collides with the ticks at exactly the moment the numbers
 * get long -- which is when they matter most.
 */
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
                  height: item.area ? 7 : 3,
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

function Tip({ active, payload, label, heading, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__head">{heading(label)}</div>
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

/* ==========================================================================
   Wind speed -> electrical power
   ========================================================================== */

export function PowerCurveChart() {
  const selectedId = useSimulation((s) => s.selectedId);
  const airDensity = useSimulation((s) => s.airDensity);
  const live = useSimulation((s) => s.telemetry.turbines[s.selectedId]);
  const spec = TURBINE_BY_ID[selectedId];

  const data = useMemo(
    () => characteristicCurve(spec, CURVE_SAMPLES, WIND_SPEED_MIN, WIND_SPEED_MAX, airDensity),
    [spec, airDensity],
  );

  // Only the two curves that share a scale are plotted here. The wind's
  // own kinetic power is deliberately absent: it grows as v^3 and reaches
  // 57 MW at 30 m/s on this machine -- 32x its rated output -- so putting
  // it on this axis would squash the actual power curve into a flat line
  // along the bottom. That comparison is made honestly in the power-chain
  // cascade on the Live tab, where the bars are drawn to true proportion.
  //
  // Aerodynamic power stays bounded because above rated wind the blades
  // pitch, holding rotor power at ratedPower / eta.
  const axisMax = (spec.ratedPower / totalEfficiency(spec)) * 1.1;
  const { divisor, unit } = powerAxisUnit(axisMax);
  const rated = ratedWindSpeed(spec, airDensity);

  return (
    <ChartBlock
      title={T.chartPowerTitle}
      subtitle={T.chartPowerSubtitle}
      unit={unit}
      legend={[
        { label: T.legendAerodynamic, colour: tint(spec.accent, 0.45), dashed: true },
        { label: T.legendElectrical, colour: spec.accent },
        { label: 'cut-in', colour: '#15803d', dashed: true },
        { label: 'rated', colour: INK_SOFT, dashed: true },
        { label: 'cut-out', colour: '#b91c1c', dashed: true },
      ]}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 16, left: 0 }}>
          <CartesianGrid stroke={RULE} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="windSpeed"
            type="number"
            domain={[WIND_SPEED_MIN, WIND_SPEED_MAX]}
            ticks={[0, 5, 10, 15, 20, 25, 30]}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: RULE }}
            label={{ value: T.axisWindSpeed, position: 'insideBottom', offset: -10, style: axisLabelStyle }}
          />
          <YAxis
            domain={[0, axisMax]}
            allowDataOverflow
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => axisPower(v, divisor)}
          />

          <Area
            type="monotone"
            dataKey="electrical"
            legendType="none"
            stroke="none"
            fill={tint(spec.accent, 0.88)}
            fillOpacity={1}
            isAnimationActive={false}
            tooltipType="none"
          />
          <Line
            type="monotone"
            dataKey="aerodynamic"
            name={T.legendAerodynamic}
            stroke={tint(spec.accent, 0.45)}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="electrical"
            name={T.legendElectrical}
            stroke={spec.accent}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={false}
          />

          {/* The three operating thresholds. Left unlabelled on the plot --
              at this width "rated" and "cut-out" collide in the middle of
              the plateau. They are colour-coded to match the ticks under
              the wind slider (green / blue / red) and named in the legend
              below, so the same three colours mean the same three speeds
              everywhere in the interface. */}
          <ReferenceLine x={spec.cutInSpeed} stroke="#15803d" strokeDasharray="3 3" />
          <ReferenceLine x={rated} stroke={INK_SOFT} strokeDasharray="3 3" />
          <ReferenceLine x={spec.cutOutSpeed} stroke="#b91c1c" strokeDasharray="3 3" />

          {live && (
            <ReferenceDot
              x={Number(live.windSpeed.toFixed(2))}
              y={Math.min(live.powerElectrical, axisMax)}
              r={4.5}
              fill={spec.accent}
              stroke="#fff"
              strokeWidth={2}
              isFront
            />
          )}

          <Tooltip
            cursor={{ stroke: INK_SOFT, strokeDasharray: '3 3' }}
            content={(props) => (
              <Tip
                {...props}
                heading={(v) => `${number(Number(v), 1)} ${UNITS.windSpeed}`}
                formatter={(value) => powerString(value)}
              />
            )}
          />
          <Legend content={() => null} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartBlock>
  );
}

/* ==========================================================================
   Wind speed -> rotor speed
   ========================================================================== */

export function RpmCurveChart() {
  const selectedId = useSimulation((s) => s.selectedId);
  const airDensity = useSimulation((s) => s.airDensity);
  const live = useSimulation((s) => s.telemetry.turbines[s.selectedId]);
  const spec = TURBINE_BY_ID[selectedId];

  const data = useMemo(
    () => characteristicCurve(spec, CURVE_SAMPLES, WIND_SPEED_MIN, WIND_SPEED_MAX, airDensity),
    [spec, airDensity],
  );

  return (
    <ChartBlock title={T.chartRpmTitle} subtitle={T.chartRpmSubtitle} unit={UNITS.rpm}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 16, left: 0 }}>
          <CartesianGrid stroke={RULE} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="windSpeed"
            type="number"
            domain={[WIND_SPEED_MIN, WIND_SPEED_MAX]}
            ticks={[0, 5, 10, 15, 20, 25, 30]}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: RULE }}
            label={{ value: T.axisWindSpeed, position: 'insideBottom', offset: -10, style: axisLabelStyle }}
          />
          <YAxis
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Line
            type="monotone"
            dataKey="rpm"
            name={T.axisRpm}
            stroke={spec.accent}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={false}
          />
          <ReferenceLine x={spec.cutOutSpeed} stroke="#b91c1c" strokeDasharray="3 3" />
          {live && (
            <ReferenceDot
              x={Number(live.windSpeed.toFixed(2))}
              y={live.rpm}
              r={4.5}
              fill={spec.accent}
              stroke="#fff"
              strokeWidth={2}
              isFront
            />
          )}
          <Tooltip
            cursor={{ stroke: INK_SOFT, strokeDasharray: '3 3' }}
            content={(props) => (
              <Tip
                {...props}
                heading={(v) => `${number(Number(v), 1)} ${UNITS.windSpeed}`}
                formatter={(value) => `${number(value, 1)} ${UNITS.rpm}`}
              />
            )}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartBlock>
  );
}

/* ==========================================================================
   Cp against tip-speed ratio
   ========================================================================== */

export function CpCurveChart() {
  const selectedId = useSimulation((s) => s.selectedId);
  const live = useSimulation((s) => s.telemetry.turbines[s.selectedId]);
  const spec = TURBINE_BY_ID[selectedId];

  const data = useMemo(() => {
    const points = [];
    for (let lambda = 0; lambda <= 16; lambda += 0.1) {
      points.push({ lambda: Number(lambda.toFixed(1)), cp: powerCoefficient(lambda, spec) });
    }
    return points;
  }, [spec]);

  return (
    <ChartBlock title={T.chartCpTitle} subtitle={T.chartCpSubtitle} unit={T.axisCp}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 16, left: 0 }}>
          <CartesianGrid stroke={RULE} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="lambda"
            type="number"
            domain={[0, 16]}
            ticks={[0, 4, 8, 12, 16]}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: RULE }}
            label={{ value: T.axisLambda, position: 'insideBottom', offset: -10, style: axisLabelStyle }}
          />
          <YAxis
            domain={[0, 0.62]}
            ticks={[0, 0.2, 0.4, 0.6]}
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Area
            type="monotone"
            dataKey="cp"
            name={T.axisCp}
            stroke={spec.accent}
            strokeWidth={2}
            fill={tint(spec.accent, 0.86)}
            isAnimationActive={false}
          />
          <ReferenceLine
            y={BETZ_LIMIT}
            stroke="#0d1b2a"
            strokeDasharray="4 3"
            label={{ value: `${T.legendBetz} ${BETZ_LIMIT.toFixed(3)}`, position: 'insideTopRight', style: { ...axisLabelStyle, fill: '#0d1b2a' } }}
          />
          {live && live.tipSpeedRatio > 0 && (
            <ReferenceDot
              x={Number(live.tipSpeedRatio.toFixed(1))}
              y={live.cp}
              r={4.5}
              fill={spec.accent}
              stroke="#fff"
              strokeWidth={2}
              isFront
            />
          )}
          <Tooltip
            cursor={{ stroke: INK_SOFT, strokeDasharray: '3 3' }}
            content={(props) => (
              <Tip
                {...props}
                heading={(v) => `λ = ${number(Number(v), 1)}`}
                formatter={(value) => number(value, 3)}
              />
            )}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartBlock>
  );
}

/* ==========================================================================
   Energy accumulated over simulated time
   ========================================================================== */

/** One turbine's energy trace. Own y-scale, own unit, shared time axis. */
function EnergyTrace({ spec, history, showTimeAxis }) {
  const data = history.map((sample) => ({ t: sample.t, energy: sample.energy }));
  const peak = Math.max(...data.map((row) => row.energy), 1e-9);
  const { divisor, unit } = energyAxisUnit(peak);
  const latest = data[data.length - 1]?.energy ?? 0;

  return (
    <div className="trace">
      <div className="trace__head">
        <span className="trace__name">
          <span className="trace__swatch" style={{ background: spec.accent }} />
          {spec.shortName.kk}
        </span>
        <span className="trace__value num">{energyString(latest)}</span>
      </div>
      <ResponsiveContainer width="100%" height={showTimeAxis ? 84 : 66}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: showTimeAxis ? 16 : 2, left: 0 }}>
          <CartesianGrid stroke={RULE} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={showTimeAxis ? tickStyle : false}
            tickLine={false}
            axisLine={{ stroke: RULE }}
            height={showTimeAxis ? 30 : 1}
            tickFormatter={(v) => `${Math.round(v)}s`}
            label={showTimeAxis
              ? { value: T.axisTime, position: 'insideBottom', offset: -10, style: axisLabelStyle }
              : undefined}
          />
          <YAxis
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={46}
            tickCount={3}
            tickFormatter={(v) => axisPower(v, divisor)}
          />
          <Area
            type="monotone"
            dataKey="energy"
            name={`${spec.shortName.kk}, ${unit}`}
            stroke={spec.accent}
            strokeWidth={2}
            fill={tint(spec.accent, 0.88)}
            isAnimationActive={false}
          />
          <Tooltip
            cursor={{ stroke: INK_SOFT, strokeDasharray: '3 3' }}
            content={(props) => (
              <Tip
                {...props}
                heading={(v) => `${Math.round(Number(v))} s`}
                formatter={(value) => energyString(value)}
              />
            )}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Energy accumulated over simulated time.
 *
 * For all three turbines this is drawn as small multiples -- one trace per
 * machine, each with its own y-scale -- rather than three lines on one
 * axis. Their outputs differ by three orders of magnitude (hundreds of kWh
 * against hundreds of Wh), so a shared linear axis pins two of the three
 * flat against zero and the comparison it appears to offer is unreadable.
 * Each trace prints its own running total, and the table below gives the
 * absolute figures side by side, which is where that comparison belongs.
 */
export function EnergyChart({ allTurbines = false }) {
  const selectedId = useSimulation((s) => s.selectedId);
  const turbines = useSimulation((s) => s.telemetry.turbines);
  const spec = TURBINE_BY_ID[selectedId];

  const series = allTurbines ? TURBINES : [spec];
  const ready = series.every((s) => (turbines[s.id]?.history?.length ?? 0) >= 2);

  if (!ready) {
    return (
      <ChartBlock title={T.chartEnergyTitle} subtitle={T.chartEnergySubtitle}>
        <div className="chart-empty">{T.noDataYet}</div>
      </ChartBlock>
    );
  }

  return (
    <ChartBlock
      title={T.chartEnergyTitle}
      subtitle={allTurbines ? T.chartEnergyPerScale : T.chartEnergySubtitle}
    >
      {series.map((s, index) => (
        <EnergyTrace
          key={s.id}
          spec={s}
          history={turbines[s.id].history}
          showTimeAxis={index === series.length - 1}
        />
      ))}
    </ChartBlock>
  );
}
