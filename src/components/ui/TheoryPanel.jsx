/**
 * The physics behind the simulation, written for a student reading it
 * beside the running scene.
 *
 * Every number quoted here is computed from the same functions the
 * simulation uses, not typed in as prose -- so the text cannot drift out
 * of agreement with the model.
 */

import { BETZ_LIMIT, AIR_DENSITY_SEA_LEVEL } from '../../physics/constants.js';
import { TURBINE_BY_ID } from '../../physics/turbineSpecs.js';
import { sweptArea, ratedWindSpeed } from '../../physics/windPower.js';
import { useSimulation } from '../../state/simulationStore.js';
import { T, UNITS } from '../../i18n/strings.js';
import { number, percent, powerString } from '../../utils/format.js';
import { Section, Notice } from './primitives.jsx';

function Block({ title, children }) {
  return (
    <div className="theory-block">
      <h3 className="theory-block__title">{title}</h3>
      <div className="prose">{children}</div>
    </div>
  );
}

/**
 * A formula with its symbol legend.
 *
 * `terms` is a list of [symbol, meaning] pairs, set one per line as a
 * definition list rather than run together on one line -- a legend is
 * looked up symbol by symbol, not read as a sentence.
 */
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

export default function TheoryPanel() {
  const selectedId = useSimulation((s) => s.selectedId);
  const live = useSimulation((s) => s.telemetry.turbines[s.selectedId]);
  const airDensity = useSimulation((s) => s.airDensity);
  const spec = TURBINE_BY_ID[selectedId];
  const area = sweptArea(spec);

  return (
    <Section title={T.theory} aside={spec.typeCode}>
      <Notice signal>{T.theoryModelNotice}</Notice>

      <Block title={T.theoryFormulaTitle}>
        <Formula
          expression="P = ½ · ρ · A · v³ · Cp"
          terms={[
            ['P', `қуат, ${UNITS.watt}`],
            ['ρ', `ауа тығыздығы — ${number(airDensity, 3)} ${UNITS.density}`],
            ['A', `шарпылатын аудан — ${number(area, 1)} ${UNITS.squareMetre}`],
            ['v', `жел жылдамдығы, ${UNITS.windSpeed}`],
            ['Cp', 'қуат коэффициенті'],
          ]}
        />
        <p>{T.theoryFormulaNote}</p>
        <p>
          {spec.rotor.geometry === 'vertical'
            ? `Тік осьті H-ротор үшін жел тікбұрышты проекцияны «көреді», сондықтан A = D × H = ${number(spec.rotor.diameter, 2)} × ${number(spec.rotor.bladeHeight, 2)} = ${number(area, 1)} ${UNITS.squareMetre}.`
            : `Көлденең осьті ротор дөңгелек ауданды шарпиды: A = πR² = π × ${number(spec.rotor.diameter / 2, 2)}² = ${number(area, 1)} ${UNITS.squareMetre}.`}
        </p>
      </Block>

      <Block title={T.theoryBetzTitle}>
        <Formula expression={`Cp,max = 16/27 ≈ ${percent(BETZ_LIMIT, 1)}`} />
        <p>{T.theoryBetzBody}</p>
        {live && (
          <p>
            <strong>
              {`Қазір: Cp = ${number(live.cp, 3)} — бұл Betz шегінің ${percent(live.cp / BETZ_LIMIT, 0)}.`}
            </strong>
          </p>
        )}
      </Block>

      <Block title={T.theoryChainTitle}>
        <p>{T.theoryChainBody}</p>
        {live && (
          <div style={{ marginTop: 10 }}>
            <div className="reading">
              <span className="reading__label">
                {T.powerWind}
                <span className="reading__note">P = ½ρAv³</span>
              </span>
              <span className="reading__value num">{powerString(live.powerWind)}</span>
            </div>
            <div className="reading">
              <span className="reading__label">
                {T.powerAero}
                <span className="reading__note">{`× Cp = ${number(live.cp, 3)}`}</span>
              </span>
              <span className="reading__value num">{powerString(live.powerAero)}</span>
            </div>
            <div className="reading">
              <span className="reading__label">
                {T.powerMech}
                <span className="reading__note">{`× η = ${percent(spec.etaDrivetrain, 0)}`}</span>
              </span>
              <span className="reading__value num">{powerString(live.powerMech)}</span>
            </div>
            <div className="reading reading--emphasis">
              <span className="reading__label">
                {T.powerElectrical}
                <span className="reading__note">{`× η = ${percent(spec.etaGenerator, 0)}`}</span>
              </span>
              <span className="reading__value num">{powerString(live.powerElectrical)}</span>
            </div>
          </div>
        )}
      </Block>

      <Block title={T.theoryCpTitle}>
        <Formula
          expression="λ = ω · R / v"
          terms={[
            ['ω', 'бұрыштық жылдамдық, rad/s'],
            ['R', `ротор радиусы — ${number(spec.rotor.diameter / 2, 2)} ${UNITS.metre}`],
            ['v', `жел жылдамдығы, ${UNITS.windSpeed}`],
          ]}
        />
        <p>{T.theoryCpBody}</p>
        <p>
          {`Бұл турбина үшін оптималды мән λ = ${number(spec.lambdaOptimal, 1)}, сонда Cp = ${number(spec.cpMax, 2)}.`}
        </p>
      </Block>

      <Block title={T.theoryControlTitle}>
        <p>{T.theoryControlBody}</p>
        <div style={{ marginTop: 10 }}>
          <div className="reading">
            <span className="reading__label">{T.cutInSpeed}</span>
            <span className="reading__value num">
              {number(spec.cutInSpeed, 1)}
              <span className="reading__unit">{UNITS.windSpeed}</span>
            </span>
          </div>
          <div className="reading">
            <span className="reading__label">{T.ratedSpeed}</span>
            <span className="reading__value num">
              {number(ratedWindSpeed(spec, airDensity), 1)}
              <span className="reading__unit">{UNITS.windSpeed}</span>
            </span>
          </div>
          <div className="reading">
            <span className="reading__label">{T.cutOutSpeed}</span>
            <span className="reading__value num">
              {number(spec.cutOutSpeed, 1)}
              <span className="reading__unit">{UNITS.windSpeed}</span>
            </span>
          </div>
        </div>
      </Block>

      <Block title={T.theoryScaleTitle}>
        <p>{T.theoryScaleBody}</p>
      </Block>

      <div style={{ marginTop: 16 }}>
        <Notice>
          {`Есептеулер стандартты жағдайда жүргізіледі: ρ = ${AIR_DENSITY_SEA_LEVEL} ${UNITS.density} `}
          {'(теңіз деңгейі, 15 °C, 101,325 kPa).'}
        </Notice>
      </div>
    </Section>
  );
}
