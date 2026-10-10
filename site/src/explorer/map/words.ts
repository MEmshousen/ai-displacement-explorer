// The words the map pane writes from the Selection: its title, its subtitle, and the text
// alternative that says for a screen reader what the colours show.

import { formatMetric, getMetric, type Selection } from '../../selection';

type MapSelection = Pick<Selection, 'metric' | 'sector' | 'quarter'>;

export interface CountryValue {
  readonly name: string;
  readonly value: number | null;
}

/** "Displacement in all Sectors, 2026-Q2". */
export function mapTitle({ metric, sector, quarter }: MapSelection): string {
  return `${getMetric(metric).label} in ${sector ?? 'all Sectors'}, ${quarter}`;
}

/** What a value counts, and what the map is for. */
export function mapSubtitle({ metric }: MapSelection): string {
  const { unit } = getMetric(metric);
  return `${unit.charAt(0).toUpperCase()}${unit.slice(1)}, by country. Choose a country to follow it in the other views.`;
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
