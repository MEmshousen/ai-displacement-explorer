// The trend chart's geometry: the y axis, the year ticks, the line paths and the positions of the
// labels at the line ends. Pure functions of numbers, with no DOM, so all of it is unit tested.

import { scaleLinear } from 'd3-scale';
import { line as lineShape } from 'd3-shape';
import { getMetric, trueMinus, type MetricId } from '../../selection';

export interface YAxis {
  /** The rounded range the axis covers, low then high. */
  readonly domain: readonly [number, number];
  /** Tick values inside the domain, low to high. */
  readonly ticks: readonly number[];
}

/**
 * A y axis that suits any of the metrics. It starts at zero when the values sit near it, as
 * Displacement's do; covers both sides of zero for Net change; and otherwise frames the values,
 * so a metric that stays around 50% is not flattened against the top of the chart.
 */
export function yAxis(values: readonly (number | null)[], tickCount = 4): YAxis {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  let low = finite.length ? Math.min(...finite) : 0;
  let high = finite.length ? Math.max(...finite) : 1;

  // Pull the axis to zero when the values start within half their own height of it.
  if (low > 0 && low <= high / 2) low = 0;
  if (high < 0 && high >= low / 2) high = 0;

  if (low === high) {
    // A flat line: give it room rather than a zero-height axis.
    const room = Math.abs(low) * 0.1 || 1;
    low = low > 0 && low - room < 0 ? 0 : low - room;
    high += room;
  }

  const scale = scaleLinear().domain([low, high]).nice(tickCount);
  const [from, to] = scale.domain();
  return { domain: [from, to], ticks: scale.ticks(tickCount) };
}

/**
 * Writes an axis tick in the metric's style with only the decimals the ticks need: "5%" rather
 * than "5.0%", but "2.5%" when the ticks are 2.5 points apart. Signed metrics keep their plus,
 * and a negative tick takes a true minus sign.
 */
export function formatTick(metric: MetricId, value: number, ticks: readonly number[]): string {
  const { style, signed } = getMetric(metric).format;
  const shown = (tick: number) => (style === 'percent' ? tick * 100 : tick);

  let digits = 0;
  while (digits < 3 && ticks.some((tick) => Math.abs(shown(tick) * 10 ** digits - Math.round(shown(tick) * 10 ** digits)) > 1e-6)) {
    digits++;
  }
  return trueMinus(
    new Intl.NumberFormat('en-US', {
      style: style === 'percent' ? 'percent' : 'decimal',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      signDisplay: signed ? 'exceptZero' : 'negative',
    }).format(value),
  );
}

/** Below this width the chart is "narrow": a phone, or half of a tablet's or small laptop's panel. */
export const NARROW_CHART = 360;

/**
 * How much of the chart's width the names at the line ends may take; a longer name is cut short
 * with an ellipsis. A narrow chart gives them less, so the plot keeps most of the width.
 */
export function endLabelRoom(width: number): number {
  return width < NARROW_CHART ? Math.max(64, width * 0.28) : width * 0.34;
}

export interface YearTick {
  /** The position of the year's first quarter in the list of quarters. */
  readonly index: number;
  /** "2024" */
  readonly label: string;
}

/**
 * A tick at the first quarter of each year, thinned to every second or third year when the plot
 * is too narrow for the labels to sit side by side.
 */
export function yearTicks(
  quarters: readonly string[],
  plotWidth: number,
  labelWidth: number,
): YearTick[] {
  const years: YearTick[] = [];
  quarters.forEach((quarter, index) => {
    if (quarter.endsWith('-Q1')) years.push({ index, label: quarter.slice(0, 4) });
  });
  if (years.length < 2 || quarters.length < 2) return years;

  const perYear = (plotWidth / (quarters.length - 1)) * (years[1].index - years[0].index);
  const every = Math.max(1, Math.ceil((labelWidth + 8) / perYear));
  return years.filter((_, position) => position % every === 0);
}

/**
 * The SVG path for one line. A "no value" quarter breaks the line, leaving a gap rather than a
 * stroke across it; a value with gaps on both sides is drawn as a dot by the round line caps.
 */
export function linePath(
  values: readonly (number | null)[],
  x: (index: number) => number,
  y: (value: number) => number,
): string {
  const shape = lineShape<number | null>()
    .defined((value) => value !== null)
    .x((_, index) => x(index))
    .y((value) => y(value!));
  return shape([...values]) ?? '';
}

/**
 * Moves labels apart so none overlap. Each label wants to sit at its target; the result keeps
 * them in the same top-to-bottom order, at least `gap` apart and inside `min` to `max` (when
 * they fit at all), each as near its target as its neighbours allow. Returned in input order.
 */
export function spreadLabels(
  targets: readonly number[],
  gap: number,
  min: number,
  max: number,
): number[] {
  const order = targets.map((_, index) => index).sort((a, b) => targets[a] - targets[b]);
  const placed: number[] = [];

  // Top down: push each label below the one above it.
  order.forEach((index, position) => {
    const floor = position === 0 ? min : placed[position - 1] + gap;
    placed.push(Math.max(targets[index], floor));
  });
  // Bottom up: pull back anything that was pushed past the bottom.
  for (let position = placed.length - 1; position >= 0; position--) {
    const ceiling = position === placed.length - 1 ? max : placed[position + 1] - gap;
    placed[position] = Math.max(min, Math.min(placed[position], ceiling));
  }

  const result = new Array<number>(targets.length);
  order.forEach((index, position) => (result[index] = placed[position]));
  return result;
}
