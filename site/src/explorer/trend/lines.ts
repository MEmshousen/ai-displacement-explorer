// What the trend chart draws for a Selection, and the words that go with it: the lines, the pane's
// title and subtitle, and the text alternative. No DOM here, so all of it is unit tested.

import type { Explorer } from '../../data/explorer';
import { formatMetric, getMetric, type Selection } from '../../selection';

export const GLOBAL_AVERAGE = 'Global average';

export interface TrendLine {
  /** An ISO3 code, or "global" for the global average. */
  readonly key: string;
  /** Sets the line's look. A country that is both selected and pinned is "selected". */
  readonly role: 'selected' | 'pinned' | 'global';
  readonly name: string;
  /** Whether the country is one of the Selection's pinned countries. */
  readonly pinned: boolean;
  /**
   * The country's position among the pinned countries, which picks a pinned line's stroke style.
   * It stays the same when another country is selected, so a pinned line never changes its look.
   */
  readonly slot: number | null;
  /** One value per quarter, in step with the dataset's quarters; null is "no value". */
  readonly values: readonly (number | null)[];
}

/**
 * The lines for a Selection, in reading order: the selected country, the pinned countries in the
 * order they were pinned, then the global average. A country never appears twice.
 */
export function trendLines(
  selection: Pick<Selection, 'metric' | 'sector' | 'country' | 'pinned'>,
  explorer: Pick<Explorer, 'overTime' | 'country'>,
): TrendLine[] {
  const name = (iso3: string) => explorer.country(iso3)?.name ?? iso3;
  const lines: TrendLine[] = [];

  const { country, pinned } = selection;
  if (country !== null) {
    const slot = pinned.indexOf(country);
    lines.push({
      key: country,
      role: 'selected',
      name: name(country),
      pinned: slot !== -1,
      slot: slot === -1 ? null : slot,
      values: explorer.overTime(selection, country),
    });
  }
  pinned.forEach((iso3, slot) => {
    if (iso3 === country) return;
    lines.push({
      key: iso3,
      role: 'pinned',
      name: name(iso3),
      pinned: true,
      slot,
      values: explorer.overTime(selection, iso3),
    });
  });
  lines.push({
    key: 'global',
    role: 'global',
    name: GLOBAL_AVERAGE,
    pinned: false,
    slot: null,
    values: explorer.overTime(selection, null),
  });
  return lines;
}

/**
 * A Selection as the trend chart draws it on a phone, where there is no pinning: the pinned
 * countries are left out, so the chart, its title and its text alternative match the controls on
 * screen. The Selection itself, and so the address, keeps them for a wider screen.
 */
export function withoutPinned<S extends Pick<Selection, 'pinned'>>(selection: S): S {
  return selection.pinned.length === 0 ? selection : { ...selection, pinned: [] };
}

/**
 * The name written at the end of a line. On a narrow chart the global average is just "Global":
 * the pane's title and the readout under the chart give it in full.
 */
export function endLabel(line: Pick<TrendLine, 'role' | 'name'>, narrow: boolean): string {
  return narrow && line.role === 'global' ? 'Global' : line.name;
}

/** Whether the chart shows only the global average, so the hint about the map is wanted. */
export function onlyGlobalAverage(lines: readonly TrendLine[]): boolean {
  return lines.every((line) => line.role === 'global');
}

const COUNTS = ['no', 'one', 'two', 'three'];

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** The pane's title: "Germany against the global average". */
export function trendTitle(lines: readonly TrendLine[]): string {
  const selected = lines.find((line) => line.role === 'selected');
  const pinned = lines.filter((line) => line.role === 'pinned');

  if (selected) {
    if (pinned.length === 0) return `${selected.name} against the global average`;
    const count = COUNTS[pinned.length] ?? String(pinned.length);
    const noun = pinned.length === 1 ? 'pinned country' : 'pinned countries';
    return `${selected.name} against the global average and ${count} ${noun}`;
  }
  if (pinned.length > 0) {
    return `${listNames(pinned.map((line) => line.name))} against the global average`;
  }
  return 'The global average over time';
}

/** The pane's subtitle: "Displacement, Finance & Banking, 2020-Q1 to 2026-Q2". */
export function trendSubtitle(
  selection: Pick<Selection, 'metric' | 'sector'>,
  quarters: readonly string[],
): string {
  const { label } = getMetric(selection.metric);
  return `${label}, ${selection.sector ?? 'all Sectors'}, ${quarters[0]} to ${quarters.at(-1)}`;
}

/**
 * The chart's text alternative: what is charted, then where each line starts and ends.
 * "Germany: 3.1% in 2020-Q1, 11.8% in 2026-Q2."
 */
export function trendSummary(
  selection: Pick<Selection, 'metric' | 'sector'>,
  lines: readonly TrendLine[],
  quarters: readonly string[],
): string {
  const { unit } = getMetric(selection.metric);
  const parts = [`Line chart. ${trendSubtitle(selection, quarters)}, in ${unit}.`];

  for (const line of lines) {
    const first = line.values.findIndex((value) => value !== null);
    const last = line.values.findLastIndex((value) => value !== null);
    if (first === -1) {
      parts.push(`${line.name}: no value in any quarter.`);
      continue;
    }
    const at = (index: number) =>
      `${formatMetric(selection.metric, line.values[index])} in ${quarters[index]}`;
    parts.push(`${line.name}: ${first === last ? at(first) : `${at(first)}, ${at(last)}`}.`);
  }
  return parts.join(' ');
}

/** One line of the readout as a sentence, for the screen reader: "Germany 11.8%". */
export function readoutText(
  selection: Pick<Selection, 'metric'>,
  lines: readonly TrendLine[],
  quarters: readonly string[],
  index: number,
): string {
  const values = lines.map((line) => `${line.name} ${formatMetric(selection.metric, line.values[index])}`);
  return `${quarters[index]}: ${values.join(', ')}`;
}
