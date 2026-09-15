/**
 * Number formatting.
 *
 * The three turbines span six orders of magnitude of power (800 W to
 * 1.8 MW), so every power and energy readout picks its own unit prefix.
 * Kazakh uses a comma decimal separator and a space thousands separator,
 * which is what the kk-KZ locale gives us.
 */

/**
 * Kazakh number formatting, done explicitly rather than through Intl.
 *
 * Kazakhstan writes 1 234 567,89 -- a narrow space between thousands and a
 * comma for the decimal mark. Intl cannot be relied on for this: Chromium's
 * ICU data resolves the "kk" locale but formats it with US separators
 * (1,234,567.89), which is simply wrong, and the result would then differ
 * between browsers and between browser and Node. Formatting here keeps the
 * output correct and identical everywhere.
 *
 * U+202F (narrow no-break space) is used for grouping so a figure never
 * wraps across a line break inside its own digits.
 */
const GROUP_SEPARATOR = ' ';
const DECIMAL_SEPARATOR = ',';

function fixed(value, digits) {
  if (!Number.isFinite(value)) return '—';

  const negative = value < 0;
  const text = Math.abs(value).toFixed(digits);
  const [whole, fraction] = text.split('.');

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
  const sign = negative ? '−' : '';   // U+2212 minus, not a hyphen

  return fraction ? `${sign}${grouped}${DECIMAL_SEPARATOR}${fraction}` : `${sign}${grouped}`;
}

/**
 * Power with an automatically chosen SI prefix.
 * @returns {{value: string, unit: string}}
 */
export function formatPower(watts) {
  const w = Math.abs(watts);
  if (w >= 1e6) return { value: fixed(watts / 1e6, 2), unit: 'MW' };
  if (w >= 1e3) return { value: fixed(watts / 1e3, w >= 1e5 ? 0 : 1), unit: 'kW' };
  return { value: fixed(watts, w >= 100 ? 0 : 1), unit: 'W' };
}

/**
 * Energy with an automatically chosen SI prefix.
 * @returns {{value: string, unit: string}}
 */
export function formatEnergy(wattHours) {
  const wh = Math.abs(wattHours);
  if (wh >= 1e6) return { value: fixed(wattHours / 1e6, 2), unit: 'MWh' };
  if (wh >= 1e3) return { value: fixed(wattHours / 1e3, 2), unit: 'kWh' };
  return { value: fixed(wattHours, wh >= 100 ? 0 : 2), unit: 'Wh' };
}

/** Single-string version, for tables and tooltips. */
export function powerString(watts) {
  const { value, unit } = formatPower(watts);
  return `${value} ${unit}`;
}

export function energyString(wattHours) {
  const { value, unit } = formatEnergy(wattHours);
  return `${value} ${unit}`;
}

export function number(value, digits = 1) {
  return fixed(value, digits);
}

export function percent(fraction, digits = 1) {
  return `${fixed(fraction * 100, digits)} %`;
}

/** Seconds as h:mm:ss, for the elapsed simulated time readout. */
export function duration(seconds) {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Compact axis tick for power values, where the axis has a fixed unit.
 * Recharts passes raw watts; the unit is stated in the axis label instead.
 */
export function axisPower(watts, divisor) {
  const scaled = watts / divisor;
  if (scaled === 0) return '0';
  if (scaled >= 100) return fixed(scaled, 0);
  if (scaled >= 10) return fixed(scaled, 1);
  return fixed(scaled, 2);
}

/** Chooses one unit for a whole power axis, based on its maximum. */
export function powerAxisUnit(maxWatts) {
  if (maxWatts >= 1e6) return { divisor: 1e6, unit: 'MW' };
  if (maxWatts >= 1e3) return { divisor: 1e3, unit: 'kW' };
  return { divisor: 1, unit: 'W' };
}

export function energyAxisUnit(maxWattHours) {
  if (maxWattHours >= 1e6) return { divisor: 1e6, unit: 'MWh' };
  if (maxWattHours >= 1e3) return { divisor: 1e3, unit: 'kWh' };
  return { divisor: 1, unit: 'Wh' };
}
