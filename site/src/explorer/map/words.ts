// The words the map pane writes from the Selection: its title, its subtitle, and the text
// alternative that says for a screen reader what the colours show.

import { formatMetric, getMetric, quarterLabel, type Selection } from '../../selection';

type MapSelection = Pick<Selection, 'metric' | 'sector' | 'quarter'>;

export interface CountryValue {
  readonly name: string;
  readonly value: number | null;
}

/** "Displacement in all Sectors, 2026 Q2". */
export function mapTitle({ metric, sector, quarter }: MapSelection): string {
  return `${getMetric(metric).label} in ${sector ?? 'all Sectors'}, ${quarterLabel(quarter)}`;
}

/** What a value counts: "% of the Sector workforce, by country". */
export function mapSubtitle({ metric }: MapSelection): string {
  const { unit } = getMetric(metric);
  return `${unit.charAt(0).toUpperCase()}${unit.slice(1)}, by country`;
}

/** The line under the map saying what choosing a country does. */
export function mapHint(hasCountry: boolean): string {
  return hasCountry
    ? 'Choose the outlined country again to clear it.'
    : 'Choose a country to follow it in the other views.';
}

/**
 * The line under the Play button. The colours are fixed across all quarters, so the latest quarter
 * shows little contrast; from there Play starts again at the first quarter, and the line says so.
 * At any other quarter Play carries on from where it is, and the line is empty.
 */
export function playHint(quarters: readonly string[], quarter: string): string {
  return quarter === quarters.at(-1) ? `Press play to watch the map change from ${quarters[0].slice(0, 4)}.` : '';
}

/** "Germany: 4.1%". */
export function countryLabel(metric: Selection['metric'], { name, value }: CountryValue): string {
  return `${name}: ${formatMetric(metric, value)}`;
}

/**
 * The map in a sentence or two: the countries with the highest and lowest values, and how many
 * have one. Ties keep the order the countries came in.
 */
export function mapSummary(selection: MapSelection, countries: readonly CountryValue[], ends = 3): string {
  const withValue = countries.filter((country) => country.value !== null);
  const title = mapTitle(selection);
  if (withValue.length === 0) return `${title}. No country has a value.`;

  const ranked = [...withValue].sort((a, b) => b.value! - a.value!);
  const list = (entries: readonly CountryValue[]) =>
    entries.map((country) => `${country.name} (${formatMetric(selection.metric, country.value)})`).join(', ');

  const count = Math.min(ends, Math.floor(ranked.length / 2));
  const extremes =
    count === 0
      ? `${list(ranked)}.`
      : `Highest: ${list(ranked.slice(0, count))}. Lowest: ${list(ranked.slice(-count).reverse())}.`;
  const covered = `${withValue.length} ${withValue.length === 1 ? 'country has' : 'countries have'} a value`;
  return `${title}. ${extremes} ${covered}; every other country is shown as no data.`;
}
