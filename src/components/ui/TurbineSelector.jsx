/**
 * Turbine selection.
 *
 * Each option carries its own live output, so the list doubles as a
 * three-way comparison even when you are not in comparison mode -- pull the
 * wind slider and you can watch all three respond at once.
 */

import { TURBINES } from '../../physics/turbineSpecs.js';
import { useSimulation } from '../../state/simulationStore.js';
import { powerString, number } from '../../utils/format.js';
import { STATUS_LABEL, T } from '../../i18n/strings.js';
import { Section } from './primitives.jsx';

export default function TurbineSelector() {
  const selectedId = useSimulation((s) => s.selectedId);
  const select = useSimulation((s) => s.select);
  const turbines = useSimulation((s) => s.telemetry.turbines);
  const running = useSimulation((s) => s.running);

  return (
    <Section title={T.selectTurbine} aside={`${TURBINES.length}`}>
      <ul className="turbine-list">
        {TURBINES.map((spec) => {
          const live = turbines[spec.id];
          const tone = running[spec.id] ? (STATUS_LABEL[live?.status]?.tone ?? 'idle') : 'idle';

          return (
            <li key={spec.id}>
              <button
                type="button"
                className="turbine-option"
                style={{ '--accent': spec.accent }}
                aria-pressed={selectedId === spec.id}
                onClick={() => select(spec.id)}
              >
                <span className="turbine-option__chip" aria-hidden="true" />
                <span className="turbine-option__body">
                  <span className="turbine-option__name">{spec.name.kk}</span>
                  <span className="turbine-option__meta">
                    {spec.typeCode}
                    {' · Ø '}
                    <span className="num">{number(spec.rotor.diameter, 2)}</span>
                    {' m'}
                  </span>
                </span>
                <span className="turbine-option__power num">
                  <span className="pulse" data-state={tone} aria-hidden="true" />
                  {powerString(live?.powerElectrical ?? 0)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
