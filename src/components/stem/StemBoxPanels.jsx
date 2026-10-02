/**
 * Rail contents for the STEM box mode.
 *
 *   BoxControls   left rail: which box, the build, the device controls
 *   BoxDashboard  right rail: live readings and the step list
 *   BoxTheory     right rail, theory tab: the physics and the print
 */
import { useBox, stepState } from '../../stem/boxStore.js';
import { STEPS, SOLAR_PARTS, WIND_PARTS } from '../../stem/boxAssembly.js';
import { partName } from '../../stem/partNames.js';
import { T, UNITS } from '../../i18n/strings.js';
import { number, powerString, energyString } from '../../utils/format.js';
import {
  Section, Reading, Toggle, Notice, PlayIcon, PauseIcon, ResetIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from '../ui/primitives.jsx';

const ACCENT = { solar: '#b45309', wind: '#1d6fb0' };

function Slider({
  label, note, value, min, max, step = 1, unit, onChange, format, disabled,
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

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          className="segmented__option"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// left rail
// ---------------------------------------------------------------------------
function AssemblySection() {
  const focus = useBox((s) => s.focus);
  const assembly = useBox((s) => s.assembly);
  const target = useBox((s) => s.target);
  const speed = useBox((s) => s.speed);
  const showLabels = useBox((s) => s.showLabels);
  const {
    setFocus, play, stop, step, scrub, setSpeed, toggleLabels,
  } = useBox.getState();

  const ids = focus === 'both' ? ['solar', 'wind'] : [focus];
  const value = ids.reduce((sum, id) => sum + assembly[id], 0) / ids.length;
  const moving = ids.some((id) => target[id] != null);
  const done = value >= 0.999;

  return (
    <Section title={T.boxAssembly} aside={`${number(value * 100, 0)} %`}>
      <Segmented
        label={T.boxChoose}
        value={focus}
        onChange={setFocus}
        options={[['both', T.boxBoth], ['solar', T.boxSolarShort], ['wind', T.boxWindShort]]}
      />

      <div className="button-row" style={{ marginTop: 10 }}>
        {moving ? (
          <button type="button" className="button button--stop" onClick={stop}>
            <PauseIcon />
            {T.boxStop}
          </button>
        ) : (
          <button
            type="button"
            className="button button--primary"
            onClick={() => play(done ? 0 : 1)}
          >
            {done ? <ResetIcon /> : <PlayIcon />}
            {done ? T.boxDisassemble : T.boxAssemble}
          </button>
        )}
        <button type="button" className="button" aria-label={T.boxPrevStep} title={T.boxPrevStep} onClick={() => step(-1)}>
          <ChevronLeftIcon />
        </button>
        <button type="button" className="button" aria-label={T.boxNextStep} title={T.boxNextStep} onClick={() => step(1)}>
          <ChevronRightIcon />
        </button>
      </div>

      <Slider
        label={T.boxProgress}
        value={value}
        min={0}
        max={1}
        step={0.001}
        onChange={scrub}
        format={(v) => `${number(v * 100, 0)}`}
        unit="%"
      />
      <Slider
        label={T.boxSpeed}
        value={speed}
        min={0.25}
        max={3}
        step={0.25}
        onChange={setSpeed}
        format={(v) => `×${number(v, 2)}`}
      />
      <Toggle label={T.boxLabels} pressed={showLabels} onChange={toggleLabels} />
    </Section>
  );
}

function DeviceToggle({ id }) {
  const out = useBox((s) => s.out[id]);
  const ready = useBox((s) => s.assembly[id] >= 0.999);
  const toggleOut = useBox((s) => s.toggleOut);
  return (
    <div className="device-row">
      <span className="device-row__state">{out ? T.boxOutside : T.boxInside}</span>
      <button type="button" className="button" disabled={!ready} onClick={() => toggleOut(id)}>
        {out ? T.boxPutBack : T.boxTakeOut}
      </button>
    </div>
  );
}

function SolarDeviceSection() {
  const s = useBox((st) => st.telemetry.solar);
  const ready = useBox((st) => st.assembly.solar >= 0.999);
  const setSolar = useBox((st) => st.setSolar);

  return (
    <Section title={T.boxSolarName} aside={powerString(s.power)}>
      <div className="panel-heading" style={{ '--accent': ACCENT.solar }}>
        <span className="panel-heading__name">{T.boxDevice}</span>
        <span className="panel-heading__power num">{powerString(s.power)}</span>
      </div>
      {!ready && <Notice>{T.boxNotReady}</Notice>}
      <DeviceToggle id="solar" />

      <Toggle label={T.boxLampOn} pressed={s.lampOn} onChange={() => setSolar({ lampOn: !s.lampOn })} />
      <Toggle label={T.boxLampMoving} pressed={s.lampMoving} onChange={() => setSolar({ lampMoving: !s.lampMoving })} />
      <Slider
        label={T.boxLampAngle}
        note={T.boxLampAngleNote}
        value={s.lampAngle}
        min={15}
        max={165}
        unit={UNITS.degree}
        onChange={(v) => setSolar({ lampAngle: v, lampMoving: false })}
      />
      <Slider
        label={T.boxLampPower}
        value={s.lampPower * 100}
        min={10}
        max={100}
        unit="%"
        onChange={(v) => setSolar({ lampPower: v / 100 })}
      />
      <Toggle label={T.boxTracking} pressed={s.tracking} onChange={() => setSolar({ tracking: !s.tracking })} />
      <p className="chain__note">{T.boxTrackingNote}</p>
    </Section>
  );
}

function WindDeviceSection() {
  const w = useBox((st) => st.telemetry.wind);
  const ready = useBox((st) => st.assembly.wind >= 0.999);
  const setWind = useBox((st) => st.setWind);

  return (
    <Section title={T.boxWindName} aside={powerString(w.power)}>
      <div className="panel-heading" style={{ '--accent': ACCENT.wind }}>
        <span className="panel-heading__name">{T.boxDevice}</span>
        <span className="panel-heading__power num">{powerString(w.power)}</span>
      </div>
      {!ready && <Notice>{T.boxNotReady}</Notice>}
      <DeviceToggle id="wind" />

      <Toggle label={T.boxFanOn} pressed={w.fanOn} onChange={() => setWind({ fanOn: !w.fanOn })} />
      <Slider
        label={T.boxWindSpeed}
        value={w.speed}
        min={0}
        max={8}
        step={0.1}
        unit={UNITS.windSpeed}
        onChange={(v) => setWind({ speed: v })}
      />
      <Slider
        label={T.boxWindDir}
        note={T.boxWindDirNote}
        value={w.direction}
        min={-90}
        max={90}
        unit={UNITS.degree}
        onChange={(v) => setWind({ direction: v })}
      />
    </Section>
  );
}

export function BoxControls() {
  const focus = useBox((s) => s.focus);
  return (
    <>
      <AssemblySection />
      {focus !== 'wind' && <SolarDeviceSection />}
      {focus !== 'solar' && <WindDeviceSection />}
      <Notice>{T.boxOutNote}</Notice>
    </>
  );
}

// ---------------------------------------------------------------------------
// right rail
// ---------------------------------------------------------------------------
function StepList({ id }) {
  const assembly = useBox((s) => s.assembly[id]);
  const st = stepState(id, assembly);
  const name = id === 'solar' ? T.boxSolarName : T.boxWindName;

  return (
    <Section
      title={`${T.boxStepsTitle} — ${name}`}
      aside={st.done ? T.boxDone : T.boxStepOf(st.index + 1, st.n)}
    >
      {assembly <= 0.001 && <p className="chain__note">{T.boxExploded}</p>}
      <ol className="step-list" style={{ '--accent': ACCENT[id] }}>
        {STEPS[id].map((step, i) => {
          const state = st.done || i < st.index || (i === st.index && st.within > 0.999)
            ? 'done'
            : i === st.index && (st.within > 0 || assembly > 0) ? 'active' : 'todo';
          return (
            <li key={step.key} className="step-list__item" data-state={state}>
              <span className="step-list__num num">{i + 1}</span>
              <span className="step-list__text">{step.kk}</span>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function SolarReadings() {
  const s = useBox((st) => st.telemetry.solar);
  return (
    <Section title={T.boxSolarName} aside={s.out ? T.boxOutside : T.boxInside}>
      <Reading label={T.boxPanelPower} value={powerString(s.power)} emphasis />
      <Reading label={T.boxVolts} value={number(s.volts, 2)} unit="V" />
      <Reading label={T.boxAmps} value={number(s.amps * 1000, 0)} unit="mA" />
      <Reading label={T.boxTheta} value={s.theta == null ? '—' : number(s.theta, 1)} unit={UNITS.degree} note={`cos θ = ${number(s.cosTheta, 3)}`} />
      <Reading label={T.boxIrradiance} value={number(s.irradiance, 0)} unit="W/m²" />
      <Reading label={T.boxDistance} value={number(s.distance * 100, 1)} unit="cm" />
      <Reading label={T.boxPan} value={number(s.pan, 1)} unit={UNITS.degree} />
      <Reading label={T.boxTilt} value={number(s.tilt, 1)} unit={UNITS.degree} />
      <Reading label={T.boxFlatPower} value={powerString(s.flatPower)} />
      <Reading label={T.boxEnergy} value={energyString(s.energy)} />
    </Section>
  );
}

function WindReadings() {
  const w = useBox((st) => st.telemetry.wind);
  return (
    <Section title={T.boxWindName} aside={w.out ? T.boxOutside : T.boxInside}>
      <Reading label={T.boxGenPower} value={powerString(w.power)} emphasis />
      <Reading label={T.boxVolts} value={number(w.volts, 2)} unit="V" />
      <Reading label={T.boxAmps} value={number(w.amps * 1000, 0)} unit="mA" />
      <Reading label={T.boxRpm} value={number(w.rpm, 0)} unit="rpm" />
      <Reading label={T.boxLambda} value={number(w.lambda, 2)} />
      <Reading label={T.boxCp} value={number(w.cp, 3)} />
      <Reading label={T.boxAvailable} value={powerString(w.available)} />
      <Reading label={T.boxRotorPower} value={powerString(w.aero)} />
      <Reading label={T.boxLed} value={w.ledOn ? T.boxLedOn : T.boxLedOff} />
      <Reading label={T.boxEnergy} value={energyString(w.energy)} />
    </Section>
  );
}

export function BoxDashboard() {
  const focus = useBox((s) => s.focus);
  const resetEnergy = useBox((s) => s.resetEnergy);
  return (
    <>
      {focus !== 'wind' && <StepList id="solar" />}
      {focus !== 'solar' && <StepList id="wind" />}
      {focus !== 'wind' && <SolarReadings />}
      {focus !== 'solar' && <WindReadings />}
      <div className="button-row" style={{ padding: '0 16px 16px' }}>
        <button type="button" className="button" onClick={resetEnergy}>
          <ResetIcon />
          {T.boxResetEnergy}
        </button>
      </div>
    </>
  );
}

function PartsList({ id, table }) {
  const groups = new Map();
  for (const p of table) {
    const code = p.id.split('#')[0];
    groups.set(code, (groups.get(code) ?? 0) + 1);
  }
  return (
    <Section title={`${T.boxPartsTitle} — ${id === 'solar' ? T.boxSolarName : T.boxWindName}`} aside={T.boxPartsCount(table.length)}>
      {[...groups].map(([code, count]) => (
        <Reading key={code} label={`${code} · ${partName(code)}`} value={`× ${count}`} />
      ))}
    </Section>
  );
}

export function BoxTheory() {
  return (
    <>
      <Section title={T.boxTheorySolarTitle}>
        <p className="prose">{T.boxTheorySolarBody}</p>
      </Section>
      <Section title={T.boxTheoryDistanceTitle}>
        <p className="prose">{T.boxTheoryDistanceBody}</p>
      </Section>
      <Section title={T.boxTheoryWindTitle}>
        <p className="prose">{T.boxTheoryWindBody}</p>
      </Section>
      <Section title={T.boxTheoryPrintTitle}>
        <p className="prose">{T.boxTheoryPrintBody}</p>
        <Notice>{T.boxModelNote}</Notice>
      </Section>
      <PartsList id="solar" table={SOLAR_PARTS} />
      <PartsList id="wind" table={WIND_PARTS} />
    </>
  );
}
