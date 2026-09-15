/**
 * Comparison mode.
 *
 * All three machines are always being integrated by the engine, so this
 * view needs no special simulation path -- it simply reads the same
 * telemetry the dashboard does, for all three at once. The single wind
 * slider already applies to all of them, which is what makes the
 * comparison fair.
 *
 * The table is the accessible view of the bar chart above it: identical
 * numbers, in text, sortable by eye. That is deliberate, not redundant.
 */

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

import { TURBINES } from '../../physics/turbineSpecs.js';
import { sweptArea } from '../../physics/windPower.js';
import { useSimulation } from '../../state/simulationStore.js';
import { STATUS_LABEL, T, UNITS } from '../../i18n/strings.js';
import {
  powerString, energyString, number, percent,
} from '../../utils/format.js';
import { Section, Notice } from './primitives.jsx';
import { EnergyChart } from './PowerChart.jsx';

const RULE = '#dae4ef';
const INK_SOFT = '#64798f';

const tickStyle = {
  fill: INK_SOFT,
  fontSize: 10,
  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
};

/**
 * Output spans six orders of magnitude between the 1.8 MW machine and the
 * 800 W one, so an absolute bar chart would render the small turbine as a
 * line one pixel high. Capacity factor -- output as a fraction of each
 * machine's own rating -- is the comparison that actually fits on one
 * scale, and it is the more instructive one: it asks how hard each
 * turbine is working, not how big it is.
 */
function CapacityChart() {
  const turbines = useSimulation((s) => s.telemetry.turbines);

  const data = TURBINES.map((spec) => ({
    id: spec.id,
    name: spec.shortName.kk,
    accent: spec.accent,
    capacity: (turbines[spec.id]?.capacityFactor ?? 0) * 100,
    power: turbines[spec.id]?.powerElectrical ?? 0,
  }));

  return (
    <figure className="chart-block">
      <figcaption className="chart-block__head">
        <div className="chart-block__title">{T.chartComparisonTitle}</div>
        <div className="chart-block__subtitle">
          {`${T.capacityFactor}, ${UNITS.percent} — ${T.ofRated}`}
        </div>
      </figcaption>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={RULE} strokeDasharray="2 4" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: RULE }}
            unit="%"
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ ...tickStyle, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={78}
          />
          <Bar dataKey="capacity" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
            {data.map((row) => (
              <Cell key={row.id} fill={row.accent} />
            ))}
          </Bar>
          <Tooltip
            cursor={{ fill: 'rgba(13,27,42,0.04)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload;
              return (
                <div className="chart-tooltip">
                  <div className="chart-tooltip__head">{row.name}</div>
                  <div className="chart-tooltip__row">
                    <span>{T.electricalPower}</span>
                    <span className="chart-tooltip__value">{powerString(row.power)}</span>
                  </div>
                  <div className="chart-tooltip__row">
                    <span>{T.capacityFactor}</span>
                    <span className="chart-tooltip__value">{`${number(row.capacity, 1)} %`}</span>
                  </div>
                </div>
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

/** Rows of the comparison table, in the order a datasheet would use. */
function buildRows(turbines, running) {
  const cell = (fn) => TURBINES.map((spec) => fn(spec, turbines[spec.id]));

  return [
    {
      label: T.turbineType,
      values: cell((spec) => spec.typeCode),
      best: null,
    },
    {
      label: T.rotorDiameter,
      values: cell((spec) => `${number(spec.rotor.diameter, 2)} ${UNITS.metre}`),
      best: null,
    },
    {
      label: T.sweptArea,
      values: cell((spec) => `${number(sweptArea(spec), 1)} ${UNITS.squareMetre}`),
      raw: TURBINES.map((spec) => sweptArea(spec)),
    },
    {
      label: T.ratedPower,
      values: cell((spec) => powerString(spec.ratedPower)),
      raw: TURBINES.map((spec) => spec.ratedPower),
    },
    {
      label: T.windSpeed,
      values: cell((_, live) => `${number(live?.windSpeed ?? 0, 1)} ${UNITS.windSpeed}`),
      best: null,
    },
    {
      label: T.rotorSpeed,
      values: cell((_, live) => `${number(live?.rpm ?? 0, 1)} ${UNITS.rpm}`),
      raw: TURBINES.map((spec) => turbines[spec.id]?.rpm ?? 0),
    },
    {
      label: T.electricalPower,
      values: cell((_, live) => powerString(live?.powerElectrical ?? 0)),
      raw: TURBINES.map((spec) => turbines[spec.id]?.powerElectrical ?? 0),
    },
    {
      label: T.powerCoefficient,
      values: cell((_, live) => number(live?.cp ?? 0, 3)),
      raw: TURBINES.map((spec) => turbines[spec.id]?.cp ?? 0),
    },
    {
      label: T.overallEfficiency,
      values: cell((_, live) => percent(live?.overallEfficiency ?? 0, 1)),
      raw: TURBINES.map((spec) => turbines[spec.id]?.overallEfficiency ?? 0),
    },
    {
      label: T.capacityFactor,
      values: cell((_, live) => percent(live?.capacityFactor ?? 0, 0)),
      raw: TURBINES.map((spec) => turbines[spec.id]?.capacityFactor ?? 0),
    },
    {
      label: T.energyGenerated,
      values: cell((_, live) => energyString(live?.energyWh ?? 0)),
      raw: TURBINES.map((spec) => turbines[spec.id]?.energyWh ?? 0),
    },
    {
      label: T.status,
      values: cell((spec, live) => (
        STATUS_LABEL[running[spec.id] ? (live?.status ?? 'below-cut-in') : 'paused'].text
      )),
      best: null,
    },
  ];
}

export default function TurbineComparison() {
  const turbines = useSimulation((s) => s.telemetry.turbines);
  const running = useSimulation((s) => s.running);
  const select = useSimulation((s) => s.select);

  const rows = buildRows(turbines, running);

  return (
    <Section title={T.comparison} aside={`${TURBINES.length}`}>
      <p className="prose" style={{ marginBottom: 12 }}>{T.comparisonIntro}</p>

      <CapacityChart />
      <EnergyChart allTurbines />

      <div className="table-scroll" style={{ marginTop: 18 }}>
        <table className="compare-table">
          <caption className="visually-hidden">{T.comparison}</caption>
          <thead>
            <tr>
              <th scope="col">{T.parameter}</th>
              {TURBINES.map((spec) => (
                <th key={spec.id} scope="col" style={{ '--accent': spec.accent }}>
                  <button
                    type="button"
                    className="compare-table__head"
                    onClick={() => select(spec.id)}
                    title={spec.name.kk}
                  >
                    <span>{spec.shortName.kk}</span>
                    <span>{spec.typeCode}</span>
                    <span className="compare-table__accent" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const peak = row.raw ? Math.max(...row.raw) : null;
              return (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((value, index) => (
                    <td
                      key={TURBINES[index].id}
                      className="num"
                      data-best={peak != null && peak > 0 && row.raw[index] === peak}
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

      <div style={{ marginTop: 12 }}>
        <Notice>{T.relativeScaleNote}</Notice>
      </div>
    </Section>
  );
}
