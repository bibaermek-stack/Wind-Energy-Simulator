/**
 * The datasheet for the selected machine.
 *
 * Rotor dimensions are measured from the .glb geometry; everything else is
 * an example parameter set. The notice at the top says so, because a
 * student reading these numbers should know which are properties of the
 * model and which are stand-ins.
 */

import { TURBINE_BY_ID } from '../../physics/turbineSpecs.js';
import {
  sweptArea, ratedWindSpeed, ratedAngularVelocity,
} from '../../physics/windPower.js';
import { useSimulation } from '../../state/simulationStore.js';
import { T, UNITS } from '../../i18n/strings.js';
import { number, percent, powerString } from '../../utils/format.js';
import { Section, Reading, Notice } from './primitives.jsx';

export default function TechnicalParameters() {
  const selectedId = useSimulation((s) => s.selectedId);
  const airDensity = useSimulation((s) => s.airDensity);
  const showTechnical = useSimulation((s) => s.showTechnical);

  if (!showTechnical) return null;

  const spec = TURBINE_BY_ID[selectedId];
  const isVertical = spec.rotor.geometry === 'vertical';
  const area = sweptArea(spec);
  const ratedRpm = (ratedAngularVelocity(spec, airDensity) * 60) / (2 * Math.PI);

  return (
    <Section title={T.technicalParameters} aside={spec.typeCode}>
      <p className="prose" style={{ marginBottom: 12 }}>{spec.description.kk}</p>

      <div className="reading-grid">
        <Reading
          label={T.rotorDiameter}
          value={number(spec.rotor.diameter, 2)}
          unit={UNITS.metre}
        />
        {isVertical && (
          <Reading
            label={T.bladeHeight}
            value={number(spec.rotor.bladeHeight, 2)}
            unit={UNITS.metre}
          />
        )}
        <Reading label={T.bladeCount} value={spec.rotor.bladeCount} />
        <Reading
          label={T.sweptArea}
          value={number(area, 2)}
          unit={UNITS.squareMetre}
          note={isVertical ? T.sweptAreaFormulaV : T.sweptAreaFormulaH}
        />
        <Reading label={T.hubHeight} value={number(spec.hubHeight, 1)} unit={UNITS.metre} />
        <Reading label={T.ratedPower} value={powerString(spec.ratedPower)} emphasis />

        <Reading
          label={T.cutInSpeed}
          value={number(spec.cutInSpeed, 1)}
          unit={UNITS.windSpeed}
        />
        <Reading
          label={T.ratedSpeed}
          value={number(ratedWindSpeed(spec, airDensity), 1)}
          unit={UNITS.windSpeed}
        />
        <Reading
          label={T.cutOutSpeed}
          value={number(spec.cutOutSpeed, 1)}
          unit={UNITS.windSpeed}
        />
        <Reading label={T.ratedRpm} value={number(ratedRpm, 1)} unit={UNITS.rpm} />

        <Reading label={T.cpMax} value={number(spec.cpMax, 2)} />
        <Reading label={T.lambdaOptimal} value={number(spec.lambdaOptimal, 1)} />
        <Reading label={T.etaDrivetrain} value={percent(spec.etaDrivetrain, 0)} />
        <Reading label={T.etaGenerator} value={percent(spec.etaGenerator, 0)} />
      </div>

      <div style={{ marginTop: 12 }}>
        <Notice>{T.exampleParametersNotice}</Notice>
      </div>
    </Section>
  );
}
