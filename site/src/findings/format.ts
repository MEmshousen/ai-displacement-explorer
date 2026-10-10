// How the Headline findings write their numbers, in the text, the summary strip and the charts.
// Built on the Selection's metric formats so a figure reads the same here as in the Explorer.

import { formatMetric, trueMinus } from '../selection';

/** A share of the workforce to one decimal place: 0.0869 as "8.7%". */
export function share(value: number): string {
  return formatMetric('displacement', value);
}

/** Net change to one decimal place, unsigned unless negative: -0.0327 as "−3.3%". */
export function netChange(value: number): string {
  return formatMetric('displacement', value);
}

/** New roles per 100 displaced, as a whole number: 74.7 as "75". */
export function replacementRate(value: number | null): string {
  return formatMetric('replacement-rate', value);
}

/** A share as a whole percentage: 0.608 as "61%". Used for women's shares and axis ticks. */
export function wholeShare(value: number): string {
  return trueMinus(`${Math.round(value * 100)}%`);
}

/** The distance between two shares in whole percentage points: 0.79 and 0.95 give 16. */
export function pointGap(from: number, to: number): number {
  return Math.round((to - from) * 100);
}

/** A gap in points with its sign and unit: 16 as "+16 pts", 1 as "+1 pt". */
export function signedPoints(points: number): string {
  const sign = points > 0 ? '+' : points < 0 ? '−' : '';
  const size = Math.abs(points);
  return `${sign}${size} ${size === 1 ? 'pt' : 'pts'}`;
}

/** "Upper Middle Income" as "Upper middle income": income groups in sentence case. */
export function incomeGroupLabel(incomeGroup: string): string {
  return incomeGroup.charAt(0) + incomeGroup.slice(1).toLowerCase();
}

/** "2026-Q2" as "2026 Q2", for visible text. */
export function quarterLabel(quarter: string): string {
  return quarter.replace('-', ' ');
}
