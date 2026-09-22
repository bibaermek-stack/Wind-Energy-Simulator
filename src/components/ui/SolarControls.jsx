/**
 * Solar controls: time of day, tracking, panel orientation, weather.
 *
 * The time slider is annotated with sunrise, solar noon and sunset for the
 * site, the way the wind slider is annotated with cut-in, rated and
 * cut-out -- so the control itself shows where the interesting moments are.
 *
 * The tilt and azimuth sliders are disabled while tracking is on, rather
 * than hidden. Watching them move by themselves is how you see that the
 * tracker is doing something, and it makes the comparison with manual
 * control concrete.
 */

import {
  SOLAR_ARRAY, SITE,
  TIME_MIN, TIME_MAX, TIME_DEFAULT,
  TILT_MIN, TILT_MAX, AZIMUTH_MIN, AZIMUTH_MAX,
  TEMPERATURE_MIN, TEMPERATURE_MAX,
} from '../../physics/solar/solarSpecs.js';
import { TIME_SCALES } from '../../physics/solar/SolarEngine.js';
import { formatHour } from '../../physics/solar/sunPosition.js';
import { useSimulation, selectSolarPanel } from '../../state/simulationStore.js';
import { T, UNITS, cloudDescriptor } from '../../i18n/strings.js';
import { number } from '../../utils/format.js';
import {
  Section, Reading, Toggle, PlayIcon, PauseIcon, ResetIcon,
} from './primitives.jsx';

/** A labelled slider with a value readout. */
function Slider({
  label, note, value, min, max, step = 1, unit, disabled, onChange, format,
}) {
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <div className={`field ${disabled ? 'is-disabled' : ''}`}>
      <div className="field__head">
        <span className="field__label">
          {label}
          {note && <span className="reading__note">{note}</span>}
        </span>
        <span className="field__value num">
          {format ? format(value) : number(value, step < 1 ? 1 : 0)}
          {unit && <span className="reading__unit">{unit}</span>}
        </span>
      </div>
      <input
        className="slider"
        style={{ '--fill': fill }}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export default function SolarControls() {
  const solar = useSimulation((s) => s.solar);
  const panel = useSimulation(selectSolarPanel);
  const timeScale = useSimulation((s) => s.solarTimeScale);

  const setTimeOfDay = useSimulation((s) => s.setTimeOfDay);
  const toggleSolarRunning = useSimulation((s) => s.toggleSolarRunning);
  const setSolarTimeScale = useSimulation((s) => s.setSolarTimeScale);
  const setTracking = useSimulation((s) => s.setTracking);
  const setPanelOrientation = useSimulation((s) => s.setPanelOrientation);
  const setWeather = useSimulation((s) => s.setWeather);
  const resetSolar = useSimulation((s) => s.resetSolar);

  const showRays = useSimulation((s) => s.showRays);
  const showLabels = useSimulation((s) => s.showLabels);
  const showTechnical = useSimulation((s) => s.showTechnical);
  const toggle = useSimulation((s) => s.toggle);

  const { sun, daylight, weather, trackingEnabled, manual, running } = solar;
  const spec = SOLAR_ARRAY;

  const scale = (h) => `${((h - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100}%`;
  const marks = [
    daylight.sunrise != null && { kind: 'cut-in', hour: daylight.sunrise, label: T.sunrise },
    { kind: 'rated', hour: 12, label: T.solarNoon },
    daylight.sunset != null && { kind: 'cut-out', hour: daylight.sunset, label: T.sunset },
  ].filter(Boolean).filter((m) => m.hour >= TIME_MIN && m.hour <= TIME_MAX);

  return (
    <>
      <Section title={T.timeOfDay} aside={`${SITE.latitude}°N`}>
        <div className="wind-readout">
          <span className="wind-readout__value num">{formatHour(solar.timeOfDay)}</span>
          <span className="wind-readout__descriptor">
            {sun.altitude > 0
              ? `${T.sunAltitude} ${number(sun.altitude, 1)}°`
              : T.belowHorizon}
          </span>
        </div>

        <input
          className="slider"
          style={{ '--fill': scale(solar.timeOfDay) }}
          type="range"
          min={TIME_MIN}
          max={TIME_MAX}
          step={1 / 60}
          value={Math.min(Math.max(solar.timeOfDay, TIME_MIN), TIME_MAX)}
          aria-label={T.timeOfDay}
          onChange={(e) => setTimeOfDay(Number(e.target.value))}
          onDoubleClick={() => setTimeOfDay(TIME_DEFAULT)}
        />

        <div className="wind-scale">
          {marks.map((mark) => (
            <span
              key={mark.kind}
              className="wind-scale__mark"
              data-kind={mark.kind}
              style={{ left: scale(mark.hour) }}
              title={`${mark.label} — ${formatHour(mark.hour)}`}
            >
              <span className="num">{formatHour(mark.hour)}</span>
            </span>
          ))}
        </div>

        <div className="button-row" style={{ marginTop: 8 }}>
          <button
            type="button"
            className={`button ${running ? 'button--stop' : 'button--primary'}`}
            onClick={toggleSolarRunning}
          >
            {running ? <PauseIcon /> : <PlayIcon />}
            {running ? T.pause : T.start}
          </button>
          <button type="button" className="button" onClick={resetSolar}>
            <ResetIcon />
            {T.reset}
          </button>
        </div>

        <div className="reading" style={{ marginTop: 10, borderTop: '1px solid var(--rule)' }}>
          <span className="reading__label">
            {T.timeScale}
            <span className="reading__note">{T.timeScaleHint}</span>
          </span>
        </div>
        <div className="segmented" role="group" aria-label={T.timeScale}>
          {TIME_SCALES.map((value) => (
            <button
              key={value}
              type="button"
              className="segmented__option"
              aria-pressed={timeScale === value}
              onClick={() => setSolarTimeScale(value)}
            >
              {`×${value}`}
            </button>
          ))}
        </div>
      </Section>

      <Section title={T.panelSection} aside={trackingEnabled ? T.trackingOn : T.trackingOff}>
        <Toggle
          label={T.tracking}
          pressed={trackingEnabled}
          onChange={() => setTracking(!trackingEnabled)}
        />
        <p className="chain__note" style={{ marginBottom: 10 }}>
          {trackingEnabled ? T.trackingNote : T.trackingManualNote}
        </p>

        <Slider
          label={T.panelTilt}
          note={T.panelTiltNote}
          value={trackingEnabled ? (panel?.tilt ?? 0) : manual.tilt}
          min={TILT_MIN}
          max={TILT_MAX}
          step={1}
          unit={UNITS.degree}
          disabled={trackingEnabled}
          onChange={(tilt) => setPanelOrientation({ tilt })}
        />

        <Slider
          label={T.panelAzimuth}
          note={T.panelAzimuthNote}
          value={trackingEnabled ? (panel?.azimuth ?? 180) : manual.azimuth}
          min={AZIMUTH_MIN}
          max={AZIMUTH_MAX}
          step={1}
          unit={UNITS.degree}
          disabled={trackingEnabled}
          onChange={(azimuth) => setPanelOrientation({ azimuth })}
        />

        <Reading
          label={T.incidenceAngle}
          value={number(panel?.incidenceDeg ?? 0, 1)}
          unit={UNITS.degree}
          note={`cos θ = ${number(panel?.cosTheta ?? 0, 3)}`}
          emphasis
        />
      </Section>

      <Section title={T.weather}>
        <Slider
          label={T.cloudCover}
          note={T.cloudCoverNote}
          value={weather.cloudFraction * 100}
          min={0}
          max={100}
          step={1}
          unit={UNITS.percent}
          onChange={(v) => setWeather({ cloudFraction: v / 100 })}
          format={(v) => `${number(v, 0)}`}
        />
        <p className="chain__note" style={{ marginTop: -4, marginBottom: 8 }}>
          {cloudDescriptor(weather.cloudFraction)}
        </p>

        <Slider
          label={T.ambientTemperature}
          value={weather.ambientC}
          min={TEMPERATURE_MIN}
          max={TEMPERATURE_MAX}
          step={1}
          unit={UNITS.celsius}
          onChange={(ambientC) => setWeather({ ambientC })}
        />

        <Reading
          label={T.cellTemperature}
          value={number(panel?.cellTemperature ?? 0, 1)}
          unit={UNITS.celsius}
          note={T.cellTemperatureNote}
        />
      </Section>

      <Section title={T.view}>
        <div className="toggle-list">
          <Toggle label={T.flowRays} pressed={showRays} onChange={() => toggle('showRays')} />
          <Toggle label={T.showLabels} pressed={showLabels} onChange={() => toggle('showLabels')} />
          <Toggle
            label={T.showTechnical}
            pressed={showTechnical}
            onChange={() => toggle('showTechnical')}
          />
        </div>
      </Section>
    </>
  );
}
