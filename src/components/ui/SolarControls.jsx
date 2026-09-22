/**
 * Solar controls: time, then one section per panel, then weather.
 *
 * The sections are ordered the way the lesson runs -- the sun first,
 * because everything else depends on it, then the three panels in the
 * order they are numbered, then the sky they all share.
 *
 * Panel 1's tilt and azimuth sliders stay visible while it is tracking,
 * disabled but live. Watching them drive themselves is how you see the
 * tracker working, and it makes the contrast with Panel 2's hand controls
 * immediate.
 */

import {
  PANEL_BY_ID, SITE,
  TIME_MIN, TIME_MAX, TIME_DEFAULT,
  TILT_MIN, TILT_MAX, AZIMUTH_MIN, AZIMUTH_MAX,
  FIXED_TILT, FIXED_AZIMUTH,
  TEMPERATURE_MIN, TEMPERATURE_MAX,
} from '../../physics/solar/solarSpecs.js';
import { TIME_SCALES } from '../../physics/solar/SolarEngine.js';
import { formatHour } from '../../physics/solar/sunPosition.js';
import { useSimulation } from '../../state/simulationStore.js';
import { T, UNITS, cloudDescriptor } from '../../i18n/strings.js';
import { number, powerString } from '../../utils/format.js';
import {
  Section, Reading, Toggle, PlayIcon, PauseIcon, ResetIcon,
} from './primitives.jsx';

/** A labelled slider with its own value readout. */
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

/** The coloured heading that opens each panel's section. */
function PanelHeading({ spec, panel }) {
  return (
    <div className="panel-heading" style={{ '--accent': spec.accent }}>
      <span className="panel-heading__name">{spec.name.kk}</span>
      <span className="panel-heading__power num">{powerString(panel?.powerAc ?? 0)}</span>
    </div>
  );
}

function SunSection() {
  const solar = useSimulation((s) => s.solar);
  const timeScale = useSimulation((s) => s.solarTimeScale);
  const setTimeOfDay = useSimulation((s) => s.setTimeOfDay);
  const toggleSolarRunning = useSimulation((s) => s.toggleSolarRunning);
  const setSolarTimeScale = useSimulation((s) => s.setSolarTimeScale);
  const resetSolar = useSimulation((s) => s.resetSolar);

  const { sun, daylight, running } = solar;
  const scale = (h) => `${((h - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100}%`;

  const marks = [
    daylight.sunrise != null && { kind: 'cut-in', hour: daylight.sunrise, label: T.sunrise },
    { kind: 'rated', hour: 12, label: T.solarNoon },
    daylight.sunset != null && { kind: 'cut-out', hour: daylight.sunset, label: T.sunset },
  ].filter(Boolean).filter((m) => m.hour >= TIME_MIN && m.hour <= TIME_MAX);

  return (
    <Section title={T.timeOfDay} aside={`${SITE.latitude}°N`}>
      <div className="wind-readout">
        <span className="wind-readout__value num">{formatHour(solar.timeOfDay)}</span>
        <span className="wind-readout__descriptor">
          {sun.altitude > 0 ? `${T.sunAltitude} ${number(sun.altitude, 1)}°` : T.belowHorizon}
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
  );
}

/** Panel 1: the tracker, with its on/off switch. */
function AutoPanelSection() {
  const spec = PANEL_BY_ID.auto;
  const panel = useSimulation((s) => s.solar.panels.auto);
  const autoTracking = useSimulation((s) => s.solar.autoTracking);
  const setAutoTracking = useSimulation((s) => s.setAutoTracking);

  return (
    <Section title={T.panel1} aside={autoTracking ? T.trackingOn : T.trackingOff}>
      <PanelHeading spec={spec} panel={panel} />

      <Toggle
        label={T.autoTracking}
        pressed={autoTracking}
        onChange={() => setAutoTracking(!autoTracking)}
      />
      <p className="chain__note" style={{ marginBottom: 10 }}>
        {autoTracking ? T.autoTrackingOnNote : T.autoTrackingOffNote}
      </p>

      <Slider
        label={T.panelTilt}
        value={panel?.tilt ?? 0}
        min={TILT_MIN}
        max={TILT_MAX}
        unit={UNITS.degree}
        disabled
        onChange={() => {}}
        format={(v) => number(v, 1)}
      />
      <Slider
        label={T.panelAzimuth}
        value={panel?.azimuth ?? 180}
        min={AZIMUTH_MIN}
        max={AZIMUTH_MAX}
        unit={UNITS.degree}
        disabled
        onChange={() => {}}
        format={(v) => number(v, 1)}
      />

      <Reading
        label={T.alignmentAngle}
        value={number(panel?.incidenceDeg ?? 0, 1)}
        unit={UNITS.degree}
        note={`${T.cosTheta} = ${number(panel?.cosTheta ?? 0, 3)}`}
        emphasis
      />
    </Section>
  );
}

/** Panel 2: the hand controls. */
function ManualPanelSection() {
  const spec = PANEL_BY_ID.manual;
  const panel = useSimulation((s) => s.solar.panels.manual);
  const manual = useSimulation((s) => s.solar.manual);
  const setPanelOrientation = useSimulation((s) => s.setPanelOrientation);

  return (
    <Section title={T.panel2} aside={T.modeManual}>
      <PanelHeading spec={spec} panel={panel} />

      <Slider
        label={T.panelTilt}
        note={T.panelTiltNote}
        value={manual.tilt}
        min={TILT_MIN}
        max={TILT_MAX}
        unit={UNITS.degree}
        onChange={(tilt) => setPanelOrientation({ tilt })}
      />
      <Slider
        label={T.panelAzimuth}
        note={T.panelAzimuthNote}
        value={manual.azimuth}
        min={AZIMUTH_MIN}
        max={AZIMUTH_MAX}
        unit={UNITS.degree}
        onChange={(azimuth) => setPanelOrientation({ azimuth })}
      />

      <Reading
        label={T.alignmentAngle}
        value={number(panel?.incidenceDeg ?? 0, 1)}
        unit={UNITS.degree}
        note={`${T.cosTheta} = ${number(panel?.cosTheta ?? 0, 3)}`}
        emphasis
      />
    </Section>
  );
}

/** Panel 3: read-only. */
function FixedPanelSection() {
  const spec = PANEL_BY_ID.fixed;
  const panel = useSimulation((s) => s.solar.panels.fixed);

  return (
    <Section title={T.panel3} aside={T.modeFixed}>
      <PanelHeading spec={spec} panel={panel} />
      <p className="chain__note" style={{ marginBottom: 8 }}>{T.fixedPanelNote}</p>

      <Reading label={T.panelTilt} value={number(FIXED_TILT, 0)} unit={UNITS.degree} />
      <Reading label={T.panelAzimuth} value={number(FIXED_AZIMUTH, 0)} unit={UNITS.degree} />
      <Reading
        label={T.alignmentAngle}
        value={number(panel?.incidenceDeg ?? 0, 1)}
        unit={UNITS.degree}
        note={`${T.cosTheta} = ${number(panel?.cosTheta ?? 0, 3)}`}
        emphasis
      />
    </Section>
  );
}

function WeatherSection() {
  const weather = useSimulation((s) => s.solar.weather);
  const setWeather = useSimulation((s) => s.setWeather);

  return (
    <Section title={T.weather}>
      <Slider
        label={T.cloudCover}
        note={T.cloudCoverNote}
        value={weather.cloudFraction * 100}
        min={0}
        max={100}
        unit={UNITS.percent}
        onChange={(v) => setWeather({ cloudFraction: v / 100 })}
        format={(v) => number(v, 0)}
      />
      <p className="chain__note" style={{ marginTop: -4, marginBottom: 8 }}>
        {cloudDescriptor(weather.cloudFraction)}
      </p>

      <Slider
        label={T.ambientTemperature}
        value={weather.ambientC}
        min={TEMPERATURE_MIN}
        max={TEMPERATURE_MAX}
        unit={UNITS.celsius}
        onChange={(ambientC) => setWeather({ ambientC })}
      />
    </Section>
  );
}

function ViewSection() {
  const showRays = useSimulation((s) => s.showRays);
  const showLabels = useSimulation((s) => s.showLabels);
  const showTechnical = useSimulation((s) => s.showTechnical);
  const toggle = useSimulation((s) => s.toggle);

  return (
    <Section title={T.view}>
      <div className="toggle-list">
        <Toggle label={T.flowRays} pressed={showRays} onChange={() => toggle('showRays')} />
        <Toggle label={T.showLabels} pressed={showLabels} onChange={() => toggle('showLabels')} />
        <Toggle label={T.showTechnical} pressed={showTechnical} onChange={() => toggle('showTechnical')} />
      </div>
    </Section>
  );
}

export default function SolarControls() {
  return (
    <>
      <SunSection />
      <AutoPanelSection />
      <ManualPanelSection />
      <FixedPanelSection />
      <WeatherSection />
      <ViewSection />
    </>
  );
}

