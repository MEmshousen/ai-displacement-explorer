// The shape of the two files the data step writes, shared by the step (which writes them), the
// browser (which reads the Explorer data) and Astro (which reads the Headline findings).

import { METRICS, type MetricSource, type ValidChoices } from '../selection';

/** The dataset columns one metric is computed from. */
export function sourceColumns(source: MetricSource): string[] {
  return source.kind === 'column' ? [source.column] : [source.numerator, source.denominator];
}

/** Every dataset column the six metrics need: the only value columns the Explorer data ships. */
export const EXPLORER_COLUMNS: readonly string[] = [
  ...new Set(METRICS.flatMap((metric) => sourceColumns(metric.source))),
];

/**
 * Every country x Sector x quarter cell of the dataset. The three lists are what a Selection may
 * hold, so the whole object can be passed wherever `ValidChoices` is wanted.
 */
export interface ExplorerData extends ValidChoices {
  /** Country details, each list in step with `countries` (the ISO3 codes). */
  readonly countryNames: readonly string[];
  readonly regions: readonly string[];
  readonly incomeGroups: readonly string[];
  /**
   * One array per dataset column in `EXPLORER_COLUMNS`, keyed by the column's name. The cell for
   * country c, Sector s and quarter q (positions in the lists above) is at
   * `(c * sectors.length + s) * quarters.length + q`. Values are decimal fractions rounded to
   * four places: 0.0406 means 4.06%.
   */
  readonly columns: Readonly<Record<string, readonly number[]>>;
}

/** A 2020 average beside the average of the latest four quarters. */
export interface Comparison {
  readonly baseline: number;
  readonly latest: number;
}

/**
 * Everything the four Headline findings and their charts need. Shares are decimal fractions
 * (0.087 means 8.7%); Replacement rates are new roles per 100 displaced. All are simple averages
 * over dataset rows, because the dataset has no workforce sizes to weight by.
 */
export interface Findings {
  /** What a Selection may hold, so pages can build their controls without the Explorer data. */
  readonly choices: ValidChoices;
  readonly periods: {
    /** The quarters of 2020. */
    readonly baseline: readonly string[];
    /** The latest four quarters, oldest first. */
    readonly latest: readonly string[];
  };
  /** Finding 1: 2020 against the latest four quarters, across all rows. */
  readonly headline: {
    readonly displacement: Comparison;
    readonly netChange: Comparison;
  };
  /** Finding 1's chart: one point per quarter, averaged across all rows. */
  readonly trend: {
    readonly quarters: readonly string[];
    readonly displacement: readonly number[];
    readonly netChange: readonly number[];
  };
  /** Finding 2: Displacement in the latest four quarters, highest first. */
  readonly sectors: readonly { readonly sector: string; readonly displacement: number }[];
  /** Finding 3: the latest four quarters by income group, from high income to low. */
  readonly incomeGroups: readonly {
    readonly incomeGroup: string;
    readonly countries: number;
    readonly displacement: number;
    /** Null only if nothing was displaced. */
    readonly replacementRate: number | null;
  }[];
  /** Finding 4: women's share of each Sector's workforce and of its displaced roles, all quarters. */
  readonly women: readonly {
    readonly sector: string;
    readonly workforce: number;
    readonly displaced: number;
  }[];
}
