/**
 * Wind speed, simulation transport, and view toggles.
 *
 * The slider's scale is annotated with the selected machine's cut-in,
 * rated and cut-out speeds, so the control itself shows where the
 * interesting thresholds are and the marks move when you change turbine.
 */

import { useMemo } from 'react';

import { TURBINE_BY_ID, TURBINE_IDS } from '../../physics/turbineSpecs.js';
import { ratedWindSpeed } from '../../physics/windPower.js';
import {
  WIND_SPEED_MIN, WIND_SPEED_MAX, WIND_SPEED_DEFAULT,
} from '../../physics/constants.js';
import { useSimulation } from '../../state/simulationStore.js';
import { T, UNITS, windDescriptor } from '../../i18n/strings.js';
import { number } from '../../utils/format.js';
import {
  Section, Toggle, PlayIcon, PauseIcon, ResetIcon,
} from './primitives.jsx';

const TIME_SCALES = [1, 10, 60, 300];

export default function WindControls() {
  const windSpeed = useSimulation((s) => s.windSpeed);
  const setWindSpeed = useSimulation((s) => s.setWindSpeed);
  const airDensity = useSimulation((s) => s.airDensity);
  const timeScale = useSimulation((s) => s.timeScale);
  const setTimeScale = useSimulation((s) => s.setTimeScale);

  const selectedId = useSimulation((s) => s.selectedId);
  const comparisonMode = useSimulation((s) => s.comparisonMode);
  const running = useSimulation((s) => s.running);
  const toggleRunning = useSimulation((s) => s.toggleRunning);
  const setAllRunning = useSimulation((s) => s.setAllRunning);
  const reset = useSimulation((s) => s.reset);

  const showParticles = useSimulation((s) => s.showParticles);
  const showLabels = useSimulation((s) => s.showLabels);
  const showTechnical = useSimulation((s) => s.showTechnical);
  const toggle = useSimulation((s) => s.toggle);

  const spec = TURBINE_BY_ID[selectedId];

  // In comparison mode the transport acts on all three at once; otherwise
  // it acts on the machine you have selected.
  const anyRunning = comparisonMode
    ? TURBINE_IDS.some((id) => running[id])
    : running[selectedId];

  const marks = useMemo(() => {
    const scale = (v) => `${((v - WIND_SPEED_MIN) / (WIND_SPEED_MAX - WIND_SPEED_MIN)) * 100}%`;
    return [
      { kind: 'cut-in', value: spec.cutInSpeed, label: 'cut-in', left: scale(spec.cutInSpeed) },
      { kind: 'rated', value: ratedWindSpeed(spec, airDensity), label: 'rated', left: scale(ratedWindSpeed(spec, airDensity)) },
      { kind: 'cut-out', value: spec.cutOutSpeed, label: 'cut-out', left: scale(spec.cutOutSpeed) },
    ];
  }, [spec, airDensity]);

  const fill = `${((windSpeed - WIND_SPEED_MIN) / (WIND_SPEED_MAX - WIND_SPEED_MIN)) * 100}%`;

  const handleTransport = () => {
    if (comparisonMode) setAllRunning(!anyRunning);
    else toggleRunning(selectedId);
  };

  return (
    <>
      <Section title={T.windControls}>
        <div className="wind-readout">
          <span className="wind-readout__value num">{number(windSpeed, 1)}</span>
          <span className="wind-readout__unit">{UNITS.windSpeed}</span>
          <span className="wind-readout__descriptor">{windDescriptor(windSpeed)}</span>
        </div>

        <input
          className="slider"
          style={{ '--fill': fill }}
          type="range"
          min={WIND_SPEED_MIN}
          max={WIND_SPEED_MAX}
          step={0.1}
          value={windSpeed}
          aria-label={`${T.windSpeed}, ${UNITS.windSpeed}`}
          onChange={(event) => setWindSpeed(Number(event.target.value))}
          onDoubleClick={() => setWindSpeed(WIND_SPEED_DEFAULT)}
        />

        <div className="wind-scale">
          {marks.map((mark) => (
            <span
              key={mark.kind}
              className="wind-scale__mark"
              data-kind={mark.kind}
              style={{ left: mark.left }}
              title={`${mark.label} — ${number(mark.value, 1)} ${UNITS.windSpeed}`}
            >
              <span className="num">{number(mark.value, 1)}</span>
            </span>
          ))}
        </div>

        <div className="reading" style={{ borderTop: '1px solid var(--rule)' }}>
          <span className="reading__label">
            {T.airDensity}
            <span className="reading__note">{T.airDensityHint}</span>
          </span>
          <span className="reading__value num">
            {number(airDensity, 3)}
            <span className="reading__unit">{UNITS.density}</span>
          </span>
        </div>
      </Section>

      <Section
        title={T.simulation}
        aside={comparisonMode ? T.sameWindNotice : spec.typeCode}
      >
        <div className="button-row">
          <button
            type="button"
            className={`button ${anyRunning ? 'button--stop' : 'button--primary'}`}
            onClick={handleTransport}
          >
            {anyRunning ? <PauseIcon /> : <PlayIcon />}
            {anyRunning
              ? (comparisonMode ? T.pauseAll : T.pause)
              : (comparisonMode ? T.startAll : T.start)}
          </button>
          <button
            type="button"
            className="button"
            onClick={() => reset(comparisonMode ? undefined : selectedId)}
          >
            <ResetIcon />
            {comparisonMode ? T.resetAll : T.reset}
          </button>
        </div>

        <div className="reading" style={{ marginTop: 10, borderTop: '1px solid var(--rule)' }}>
          <span className="reading__label">
            {T.timeScale}
            <span className="reading__note">{T.timeScaleHint}</span>
          </span>
        </div>
        <div className="segmented" role="group" aria-label={T.timeScale}>
          {TIME_SCALES.map((scale) => (
            <button
              key={scale}
              type="button"
              className="segmented__option"
              aria-pressed={timeScale === scale}
              onClick={() => setTimeScale(scale)}
            >
              {`×${scale}`}
            </button>
          ))}
        </div>
      </Section>

      <Section title={T.view}>
        <div className="toggle-list">
          <Toggle label={T.showParticles} pressed={showParticles} onChange={() => toggle('showParticles')} />
          <Toggle label={T.showLabels} pressed={showLabels} onChange={() => toggle('showLabels')} />
          <Toggle label={T.showTechnical} pressed={showTechnical} onChange={() => toggle('showTechnical')} />
        </div>
      </Section>
    </>
  );
}

