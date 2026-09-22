/**
 * The physics behind the solar simulation.
 *
 * Like the wind theory panel, every number quoted here is computed from the
 * same functions the simulation runs on, so the prose cannot drift out of
 * agreement with the model on screen.
 */

import { SOLAR_PANELS, PANEL_BY_ID, SITE, STC_IRRADIANCE } from '../../physics/solar/solarSpecs.js';
import { formatHour } from '../../physics/solar/sunPosition.js';
import { useSimulation, selectSolarPanel } from '../../state/simulationStore.js';
import { T, UNITS } from '../../i18n/strings.js';
import { number, percent, powerString } from '../../utils/format.js';
import { Section, Reading, Notice } from './primitives.jsx';

function Block({ title, children }) {
  return (
    <div className="theory-block">
      <h3 className="theory-block__title">{title}</h3>
      <div className="prose">{children}</div>
    </div>
  );
}

function Formula({ expression, terms }) {
  return (
    <div className="formula">
      <p className="formula__expression num">{expression}</p>
      {terms && (
        <dl className="formula__terms">
          {terms.map(([symbol, meaning]) => (
            <div key={symbol} className="formula__term">
              <dt className="num">{symbol}</dt>
              <dd>{meaning}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default function SolarTheory() {
  const solar = useSimulation((s) => s.solar);
  const panel = useSimulation(selectSolarPanel);
  // The theory text is written about Panel 1, the tracker: it is the one
  // whose behaviour the physics section explains. The other two appear in
  // the tracking block below, where the comparison is the point.
  const spec = PANEL_BY_ID.auto;

  if (!panel) return null;

  return (
    <Section title={T.theorySolarTitle} aside={spec.typeCode}>
      <Notice signal>{T.solarModelNotice}</Notice>

      <Block title={T.theoryFormulaTitle}>
        <Formula
          expression="P = G · A · η · cos θ"
          terms={[
            ['P', `электр қуаты — ${powerString(panel.powerAc)}`],
            ['G', `радиация — ${number(panel.planeIrradiance, 0)} ${UNITS.irradiance}`],
            ['A', `панель ауданы — ${number(spec.apertureArea, 2)} ${UNITS.squareMetre}`],
            ['η', `ПӘК — ${percent(spec.efficiency, 0)}`],
            ['θ', `түсу бұрышы — ${number(panel.incidenceDeg, 1)}°`],
          ]}
        />
        <p>{T.theorySolarFormulaNote}</p>
        <p>
          {`Қазір: ${number(panel.planeIrradiance, 0)} ${UNITS.irradiance} × `}
          {`${number(spec.apertureArea, 2)} ${UNITS.squareMetre} = `}
          {`${powerString(panel.powerIncident)} жарық қуаты, одан `}
          <strong>{powerString(panel.powerAc)}</strong>
          {` электр энергиясы алынады (${percent(panel.systemEfficiency, 1)}).`}
        </p>
      </Block>

      <Block title={T.theorySunPathTitle}>
        <Formula
          expression="sin α = sin φ · sin δ + cos φ · cos δ · cos H"
          terms={[
            ['α', `күннің биіктігі — ${number(solar.sun.altitude, 1)}°`],
            ['φ', `ендік — ${SITE.latitude}°N (${SITE.name.kk})`],
            ['δ', `күн еңкеюі — ${number(solar.sun.declination, 2)}°`],
            ['H', `сағаттық бұрыш — ${number(solar.sun.hourAngle, 1)}°`],
          ]}
        />
        <p>{T.theorySunPathBody}</p>
        {solar.daylight.sunrise != null && (
          <div style={{ marginTop: 10 }}>
            <Reading label={T.sunrise} value={formatHour(solar.daylight.sunrise)} />
            <Reading label={T.sunset} value={formatHour(solar.daylight.sunset)} />
            <Reading
              label={T.daylight}
              value={`${number(solar.daylight.daylight, 2)} сағат`}
            />
          </div>
        )}
      </Block>

      <Block title={T.theoryIncidenceTitle}>
        <Formula
          expression="cos θ = n⃗ · s⃗"
          terms={[
            ['n⃗', 'панель нормалының бірлік векторы'],
            ['s⃗', 'күнге бағытталған бірлік вектор'],
          ]}
        />
        <p>{T.theoryIncidenceBody}</p>
        <p>
          <strong>
            {`Қазір: θ = ${number(panel.incidenceDeg, 1)}°, cos θ = ${number(panel.cosTheta, 3)} — `}
            {`панель мүмкін радиацияның ${percent(panel.cosTheta, 0)} бөлігін алады.`}
          </strong>
        </p>
      </Block>

      <Block title={T.theoryTrackingTitle}>
        <p>{T.theoryTrackingBody}</p>
        <div style={{ marginTop: 10 }}>
          {SOLAR_PANELS.map((p) => {
            const live = solar.panels[p.id];
            return (
              <Reading
                key={p.id}
                label={p.shortName.kk}
                value={`${number(live?.specificYield ?? 0, 0)} W/m²`}
                note={`θ = ${number(live?.incidenceDeg ?? 0, 1)}°  ·  cos θ = ${number(live?.cosTheta ?? 0, 3)}`}
                emphasis={p.mode === 'auto'}
              />
            );
          })}
        </div>
      </Block>

      <Block title={T.theoryTemperatureTitle}>
        <Formula
          expression="T_cell = T_air + (NOCT − 20)/800 · G"
          terms={[
            ['T_cell', `элемент температурасы — ${number(panel.cellTemperature, 1)} ${UNITS.celsius}`],
            ['T_air', `ауа температурасы — ${number(solar.weather.ambientC, 0)} ${UNITS.celsius}`],
            ['NOCT', `${spec.noct} ${UNITS.celsius}`],
          ]}
        />
        <p>{T.theoryTemperatureBody}</p>
        <p>
          <strong>
            {`Қазір температура әсері: ${percent(panel.temperatureFactor - 1, 1)}.`}
          </strong>
        </p>
      </Block>

      <div style={{ marginTop: 16 }}>
        <Notice>{T.solarExampleNotice}</Notice>
      </div>

      <div style={{ marginTop: 10 }}>
        <Notice>
          {`STC: ${STC_IRRADIANCE} ${UNITS.irradiance}, 25 ${UNITS.celsius} — `}
          {'панельдер осы стандартты жағдайда сыналады.'}
        </Notice>
      </div>
    </Section>
  );
}
