// The map's colour classes: up to five, with boundaries at the fifths of every value the metric
// takes in the Sector across all quarters. They are worked out once per metric and Sector and do
// not move with the quarter, so a country that changes colour while the quarters play has really changed.

import { quantileSorted } from 'd3-array';
import { formatMetric, getMetric, type MetricId } from '../../selection';

/** How many steps the --chart-ramp tokens have. */
export const RAMP_STEPS = 5;

export interface ColourClasses {
  readonly metric: MetricId;
  /**
   * The boundaries between classes, lowest first: at most four, each rounded to the places the
   * metric is written to, so the legend states them exactly. A value on a boundary belongs to the
   * class above it.
   */
  readonly boundaries: readonly number[];
  /**
   * The ramp step, 1 (the weak end) to 5 (the strong end), of each class from the lowest values to
   * the highest. The steps run the other way for a metric whose low values are the strong end.
   * The strong end is the darkest colour in the light theme and the lightest in the dark theme.
   */
  readonly steps: readonly number[];
  /** The lowest and highest values the classes were built from, rounded; null if there were none. */
  readonly extent: readonly [number, number] | null;
}

/**
 * Which end of a metric the strong end of the ramp marks. Net change is negative where roles were
 * lost, so its low end is the strong one: on every metric about roles lost, stronger means more lost.
 */
export function strongEnd(metric: MetricId): 'high' | 'low' {
  return metric === 'net-change' ? 'low' : 'high';
}

/**
 * What the legend says the strong end means. The scale is always drawn with that end on the right,
 * and the sentence names it by its place, not its shade: the strong end is the darkest colour in
 * one theme and the lightest in the other.
 */
export function scaleMeans(metric: MetricId): string {
  const most = 'The right-hand end of the scale marks the';
  switch (metric) {
    case 'displacement':
      return `${most} most Displacement`;
    case 'net-change':
      return `${most} largest net loss of roles`;
    case 'replacement-rate':
      return `${most} highest Replacement rate`;
    case 'ai-adoption':
      return `${most} most AI adoption`;
    case 'wage-premium':
      return `${most} highest wage premium`;
    case 'women-share':
      return `${most} highest women's share`;
  }
}

/** A value rounded to the places the metric is written to: 0.04062 (4.1%) becomes 0.041. */
export function roundToFormat(metric: MetricId, value: number): number {
  const { style, digits } = getMetric(metric).format;
  return Number(value.toFixed(style === 'percent' ? digits + 2 : digits));
}

/** The ramp steps for a number of classes, spread over the ramp: three classes use 1, 3 and 5. */
function spreadSteps(count: number): number[] {
  if (count === 1) return [Math.ceil(RAMP_STEPS / 2)];
  return Array.from({ length: count }, (_, index) => 1 + Math.round((index * (RAMP_STEPS - 1)) / (count - 1)));
}

/**
 * Builds the classes from every value in view: all countries, all quarters. Values that round to
 * the same boundary share one, so a metric that barely varies gets fewer than five classes.
 */
export function colourClasses(metric: MetricId, values: readonly (number | null)[]): ColourClasses {
  const sorted = values
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .map((value) => roundToFormat(metric, value))
    .sort((a, b) => a - b);

  const boundaries: number[] = [];
  for (let step = 1; step < RAMP_STEPS; step++) {
    const boundary = roundToFormat(metric, quantileSorted(sorted, step / RAMP_STEPS) ?? NaN);
    // A boundary at the lowest value would leave the class below it empty.
    if (boundary > sorted[0] && boundary !== boundaries.at(-1)) boundaries.push(boundary);
  }

  const steps = spreadSteps(boundaries.length + 1);
  return {
    metric,
    boundaries,
    steps: strongEnd(metric) === 'low' ? steps.reverse() : steps,
    extent: sorted.length === 0 ? null : [sorted[0], sorted[sorted.length - 1]],
  };
}

/** The ramp step, 1 to 5, a value is coloured with; null for no value. */
export function stepOf(classes: ColourClasses, value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  // Rounded as it is written, so a tooltip's number and its colour never disagree.
  const rounded = roundToFormat(classes.metric, value);
  const index = classes.boundaries.filter((boundary) => rounded >= boundary).length;
  return classes.steps[index];
}

export interface LegendClass {
  /** The ramp step, 1 to 5. */
  readonly step: number;
  /**
   * The class in words: "Under 2.5%", "2.5% to under 4.0%", "8.5% or more". A metric that barely
   * varies has one class, named by its values: "95.0%", or "49.1% to 49.3%".
   */
  readonly range: string;
}

export interface Legend {
  /** The classes from the weak end of the ramp to the strong end: left to right in the legend. */
  readonly classes: readonly LegendClass[];
  /** The boundary between each class and the next, in the same order, in the metric's format. */
  readonly boundaries: readonly string[];
}

/** The one class of a metric that barely varies, named by the values it holds. */
function everyValue({ metric, extent }: ColourClasses): string {
  if (!extent) return 'No values';
  const [lowest, highest] = extent.map((value) => formatMetric(metric, value));
  return lowest === highest ? lowest : `${lowest} to ${highest}`;
}

/** The legend, weak end first, so it reads low to high except where the low end is the strong one. */
export function legend(classes: ColourClasses): Legend {
  const marks = classes.boundaries.map((boundary) => formatMetric(classes.metric, boundary));
  const ranges = classes.steps.map((step, index) => {
    const from = marks[index - 1];
    const to = marks[index];
    let range = everyValue(classes);
    if (from && to) range = `${from} to under ${to}`;
    else if (to) range = `Under ${to}`;
    else if (from) range = `${from} or more`;
    return { step, range };
  });

  return strongEnd(classes.metric) === 'low'
    ? { classes: ranges.reverse(), boundaries: marks.reverse() }
    : { classes: ranges, boundaries: marks };
}
