/**
 * The charts tab: the four characteristics of the selected machine.
 *
 * Order is deliberate. Power first, because it is what the simulation is
 * about; then rotor speed, which explains the shape of the power curve;
 * then Cp against tip-speed ratio, which explains the rotor speed; then
 * energy over time, which is the integral of the first.
 */

import { TURBINE_BY_ID } from '../../physics/turbineSpecs.js';
import { useSimulation } from '../../state/simulationStore.js';
import { T } from '../../i18n/strings.js';
import { Section, Notice } from './primitives.jsx';
import {
  PowerCurveChart, RpmCurveChart, CpCurveChart, EnergyChart,
} from './PowerChart.jsx';

export default function ChartPanel() {
  const selectedId = useSimulation((s) => s.selectedId);
  const spec = TURBINE_BY_ID[selectedId];

  return (
    <Section title={T.charts} aside={spec.typeCode}>
      <Notice signal>{T.theoryModelNotice}</Notice>

      <div style={{ marginTop: 14 }}>
        <PowerCurveChart />
        <RpmCurveChart />
        <CpCurveChart />
        <EnergyChart />
      </div>
    </Section>
  );
}
