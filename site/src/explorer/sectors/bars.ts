// The pure logic behind the Sector bars: the ranking, the fixed scale and the pane's text. Nothing
// here touches the page; `view.ts` does the drawing.

import { scaleLinear } from 'd3-scale';
import { quarterLabel, type Metric, type MetricId } from '../../selection';

/** One Sector's value, as `explorer.bySector()` gives it. Null is "no value". */
export interface SectorValue {
  readonly sector: string;
  readonly value: number | null;
}

const hasValue = (value: number | null): value is number => value !== null && Number.isFinite(value);

/** Which way a ranking runs. */
export type RankOrder = 'highest first' | 'lowest first';

/**
 * The order that puts the most affected Sector at the top: Net change runs from the lowest value,
 * the most roles lost, and every other metric from the highest.
 */
export function rankOrder(metric: MetricId): RankOrder {
  return metric === 'net-change' ? 'lowest first' : 'highest first';
}

/**
 * The Sector names ranked in the given order, with "no value" last. Sectors that tie keep the
 * order they had in `previous` (the ranking before this one), so two equal bars do not swap back
 * and forth while the quarter plays; with no previous ranking they keep the given order.
 */
export function rankSectors(
  values: readonly SectorValue[],
  previous: readonly string[] = [],
  order: RankOrder = 'highest first',
): string[] {
  const direction = order === 'lowest first' ? -1 : 1;
  const before = (sector: string, fallback: number): number => {
    const index = previous.indexOf(sector);
    return index === -1 ? previous.length + fallback : index;
  };
  return values
    .map(({ sector, value }, index) => ({ sector, value, tie: before(sector, index) }))
    .sort((a, b) => {
      if (hasValue(a.value) && hasValue(b.value) && a.value !== b.value) return direction * (b.value - a.value);
      if (hasValue(a.value) !== hasValue(b.value)) return hasValue(a.value) ? -1 : 1;
      return a.tie - b.tie;
    })
    .map(({ sector }) => sector);
}

/** The lowest and highest value the bars' scale covers. Always includes zero. */
export type Domain = readonly [low: number, high: number];

/**
 * One scale for every quarter: from the lowest to the highest value any Sector takes in any of
 * the given quarters, stretched to include zero. Because it does not depend on the quarter, the
 * bars grow and shrink as time plays instead of the scale moving under them.
 */
export function fixedDomain(quarters: readonly (readonly SectorValue[])[]): Domain {
  let low = 0;
  let high = 0;
  for (const values of quarters) {
    for (const { value } of values) {
      if (!hasValue(value)) continue;
      if (value < low) low = value;
      if (value > high) high = value;
    }
  }
  return low === high ? [0, 1] : [low, high];
}

/** Where one bar sits on its track, as fractions of the track's width. */
export interface BarShape {
  /** The bar's left edge. */
  readonly start: number;
  readonly length: number;
}

export interface BarScale {
  /** Where the zero line sits: 0 when every value is positive, 1 when every value is negative. */
  readonly zero: number;
  /** A bar from the zero line to the value: rightwards if positive, leftwards if negative. */
  bar(value: number | null): BarShape | null;
}

export function barScale(domain: Domain): BarScale {
  const x = scaleLinear().domain(domain).range([0, 1]).clamp(true);
  const zero = x(0);
  return {
    zero,
    bar(value) {
      if (!hasValue(value)) return null;
      const end = x(value);
      return { start: Math.min(zero, end), length: Math.abs(end - zero) };
    },
  };
}

/** The pane's title: "Sectors in Germany, 2026 Q2". With no country it names the global average. */
export function viewTitle(countryName: string | null, quarter: string): string {
  return countryName === null
    ? `Sectors, global average, ${quarterLabel(quarter)}`
    : `Sectors in ${countryName}, ${quarterLabel(quarter)}`;
}

/**
 * The pane's subtitle: the metric, what its values count, and which way the ranking runs. A phrase
 * with no full stop, like the other panes' subtitles.
 */
export function viewSubtitle(metric: Pick<Metric, 'id' | 'label' | 'unit'>): string {
  return `${metric.label} (${metric.unit}), ${rankOrder(metric.id)}`;
}

/** The line under the bars saying what choosing a bar does. */
export function viewHint(sector: string | null): string {
  return sector === null
    ? 'Choose a bar to see that Sector across the Explorer.'
    : 'Choose the highlighted bar again for all Sectors.';
}
