// The browser's side of the data: fetches the Explorer data once and answers any view's question
// about it. "All Sectors", the global average and Replacement rate are computed here from the
// cells, as simple averages over the rows in view; nothing is precomputed.

import { getMetric, type MetricId, type Selection, type ValidChoices } from '../selection';
import { sourceColumns, type ExplorerData } from './shape';

export type { ExplorerData } from './shape';

export interface CountryInfo {
  readonly iso3: string;
  readonly name: string;
  readonly region: string;
  readonly incomeGroup: string;
}

/** The rows a value is taken over. Null means all of them: all Sectors, or the global average. */
export interface Scope {
  /** An ISO3 code, or null for the global average across every country. */
  readonly country: string | null;
  /** A Sector name, or null for all Sectors. */
  readonly sector: string | null;
  /** A quarter label such as "2024-Q3". */
  readonly quarter: string;
}

/**
 * Lookups over the Explorer data. Every value is in the metric's own unit (see `formatMetric`):
 * a decimal fraction, the 0 to 1 index, or new roles per 100 displaced. Null means "no value",
 * which only Replacement rate gives, when nothing was displaced in the rows in view.
 *
 * A Selection can be passed wherever part of one is asked for. Sectors, quarters and countries
 * must be ones from `choices`, as a Selection's always are; anything else throws a RangeError.
 */
export interface Explorer {
  /** What a Selection may hold. */
  readonly choices: ValidChoices;
  /** All countries, in the order of `choices.countries`. */
  readonly countries: readonly CountryInfo[];
  /** Details for one ISO3 code, or undefined if the dataset has no such country. */
  country(iso3: string): CountryInfo | undefined;

  /** One number: the metric over the rows in scope. */
  value(metric: MetricId, scope: Scope): number | null;

  /** For the world map: every country's value for the Selection's metric, Sector and quarter. */
  byCountry(
    selection: Pick<Selection, 'metric' | 'sector' | 'quarter'>,
  ): { readonly country: CountryInfo; readonly value: number | null }[];

  /**
   * For the trend chart: one value per quarter, in step with `choices.quarters`, for the
   * Selection's metric and Sector. `country` is an ISO3 code (the selected country or a pinned
   * one), or null for the global average.
   */
  overTime(selection: Pick<Selection, 'metric' | 'sector'>, country: string | null): (number | null)[];

  /**
   * For the Sector bars: every Sector's value for the Selection's metric and quarter, in the
   * Selection's country or, with no country, as the global average.
   */
  bySector(
    selection: Pick<Selection, 'metric' | 'quarter' | 'country'>,
  ): { readonly sector: string; readonly value: number | null }[];
}

export function createExplorer(data: ExplorerData): Explorer {
  const { sectors, quarters, countries: codes } = data;
  const expectedLength = codes.length * sectors.length * quarters.length;

  const countries: CountryInfo[] = codes.map((iso3, c) => ({
    iso3,
    name: data.countryNames[c],
    region: data.regions[c],
    incomeGroup: data.incomeGroups[c],
  }));

  const column = (name: string): readonly number[] => {
    const values = data.columns[name];
    if (values?.length !== expectedLength) {
      throw new Error(`The Explorer data has no complete "${name}" column.`);
    }
    return values;
  };
  for (const metric of ['displacement', 'replacement-rate'] as const) {
    sourceColumns(getMetric(metric).source).forEach(column);
  }

  const position = (list: readonly string[], item: string, what: string): number => {
    const index = list.indexOf(item);
    if (index === -1) throw new RangeError(`The dataset has no ${what} "${item}".`);
    return index;
  };
  /** The positions in view: just the named one, or all of them for null. */
  const span = (list: readonly string[], item: string | null, what: string): [number, number] => {
    if (item === null) return [0, list.length];
    const index = position(list, item, what);
    return [index, index + 1];
  };

  const value = (metric: MetricId, scope: Scope): number | null => {
    const { source } = getMetric(metric);
    const [countryFrom, countryTo] = span(codes, scope.country, 'country');
    const [sectorFrom, sectorTo] = span(sectors, scope.sector, 'Sector');
    const q = position(quarters, scope.quarter, 'quarter');

    // Simple sums over the rows in view. A ratio divides the two sums; it never averages ratios.
    const top = column(source.kind === 'column' ? source.column : source.numerator);
    const bottom = source.kind === 'ratio' ? column(source.denominator) : null;
    let topSum = 0;
    let bottomSum = 0;
    for (let c = countryFrom; c < countryTo; c++) {
      for (let s = sectorFrom; s < sectorTo; s++) {
        const cell = (c * sectors.length + s) * quarters.length + q;
        topSum += top[cell];
        if (bottom) bottomSum += bottom[cell];
      }
    }

    if (source.kind === 'column') {
      return topSum / ((countryTo - countryFrom) * (sectorTo - sectorFrom));
    }
    return bottomSum === 0 ? null : (source.scale * topSum) / bottomSum;
  };

  return {
    choices: { sectors, quarters, countries: codes },
    countries,
    country: (iso3) => countries[codes.indexOf(iso3)],
    value,
    byCountry: ({ metric, sector, quarter }) =>
      countries.map((country) => ({
        country,
        value: value(metric, { country: country.iso3, sector, quarter }),
      })),
    overTime: ({ metric, sector }, country) =>
      quarters.map((quarter) => value(metric, { country, sector, quarter })),
    bySector: ({ metric, quarter, country }) =>
      sectors.map((sector) => ({ sector, value: value(metric, { country, sector, quarter }) })),
  };
}

// --- Fetching -----------------------------------------------------------------------------

/**
 * The address of the Explorer data under the site's base path, which may or may not end in a
 * slash depending on the configured base.
 */
export function explorerDataUrl(baseUrl: string = import.meta.env.BASE_URL): string {
  return `${baseUrl.replace(/\/?$/, '/')}data/explorer.json`;
}

let loading: Promise<Explorer> | undefined;

/**
 * Fetches the Explorer data and wraps it in its lookups. The file is fetched once however many
 * views ask; a failed fetch is forgotten, so asking again retries. Call it from a view's own
 * script, so the fetch starts after the Headline findings have painted.
 */
export function loadExplorer(): Promise<Explorer> {
  loading ??= fetchExplorer(explorerDataUrl()).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

export async function fetchExplorer(url: string, fetcher: typeof fetch = fetch): Promise<Explorer> {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`Could not load the Explorer data (${response.status} from ${url}).`);
  }
  return createExplorer((await response.json()) as ExplorerData);
}
