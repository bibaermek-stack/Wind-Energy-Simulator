/**
 * Small shared building blocks.
 *
 * A "reading" is the atom of this interface: a label on the left, a
 * monospaced figure on the right, a hairline between it and the next one.
 * Nearly every panel is a stack of these.
 */

import { formatPower, formatEnergy } from '../../utils/format.js';

export function Section({ title, aside, children, className = '' }) {
  return (
    <section className={`section ${className}`}>
      {(title || aside) && (
        <header className="section__head">
          {title && <h2 className="section__title">{title}</h2>}
          {aside && <span className="section__aside">{aside}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * One measured value.
 *
 * @param {string} label
 * @param {string|number} value  already formatted
 * @param {string} [unit]
 * @param {string} [note]        a short explanation under the label
 */
export function Reading({ label, value, unit, note, emphasis = false }) {
  return (
    <div className={`reading ${emphasis ? 'reading--emphasis' : ''}`}>
      <span className="reading__label">
        {label}
        {note && <span className="reading__note">{note}</span>}
      </span>
      <span className="reading__value num">
        {value}
        {unit && <span className="reading__unit">{unit}</span>}
      </span>
    </div>
  );
}

/** A reading whose value is a power in watts, with its own unit prefix. */
export function PowerReading({ label, watts, note, emphasis }) {
  const { value, unit } = formatPower(watts);
  return <Reading label={label} value={value} unit={unit} note={note} emphasis={emphasis} />;
}

/** A reading whose value is an energy in watt-hours. */
export function EnergyReading({ label, wattHours, note, emphasis }) {
  const { value, unit } = formatEnergy(wattHours);
  return <Reading label={label} value={value} unit={unit} note={note} emphasis={emphasis} />;
}

export function Toggle({ label, pressed, onChange }) {
  return (
    <button type="button" className="toggle" aria-pressed={pressed} onClick={onChange}>
      <span>{label}</span>
      <span className="toggle__switch" aria-hidden="true" />
    </button>
  );
}

export function Notice({ children, signal = false }) {
  return <p className={`notice ${signal ? 'notice--signal' : ''}`}>{children}</p>;
}

/* ==========================================================================
   Icons — drawn inline, 14px, 1.6 stroke, to match the type weight
   ========================================================================== */

const iconProps = {
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export const PlayIcon = () => (
  <svg {...iconProps}><path d="M4.5 3.2 12.5 8l-8 4.8z" fill="currentColor" stroke="none" /></svg>
);

export const PauseIcon = () => (
  <svg {...iconProps}><path d="M5.5 3v10M10.5 3v10" /></svg>
);

export const ResetIcon = () => (
  <svg {...iconProps}>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.9-4.16" />
    <path d="M13.5 1.5V4.5H10.5" />
  </svg>
);

export const ChevronLeftIcon = () => (
  <svg {...iconProps} width={12} height={12}><path d="M10 2.5 4.5 8l5.5 5.5" /></svg>
);

export const ChevronRightIcon = () => (
  <svg {...iconProps} width={12} height={12}><path d="M6 2.5 11.5 8 6 13.5" /></svg>
);

/** The three-blade rotor used as the application mark. */
export const RotorMark = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <g fill="currentColor">
      <path d="M12 11.1c.3-2.6.3-5.3-.1-7.9-.1-.7.4-1.2 1-1 1.7.5 3 1.9 3.5 3.6.6 2.1-.3 4.3-2.2 5.4z" />
      <path d="M12.7 12.6c2.3 1.3 4.7 2.4 7.2 3.2.7.2.8.9.3 1.3-1.3 1.2-3.2 1.6-4.9 1.1-2.1-.6-3.5-2.5-3.5-4.7z" />
      <path d="M11.3 12.6c-.1 2.2-1.5 4.1-3.6 4.7-1.7.5-3.6.1-4.9-1.1-.5-.4-.4-1.1.3-1.3 2.5-.8 4.9-1.9 7.2-3.2z" />
    </g>
    <circle cx="12" cy="12" r="1.7" fill="currentColor" />
  </svg>
);
