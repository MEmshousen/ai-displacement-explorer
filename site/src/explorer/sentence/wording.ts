// The words of the Selection sentence, and the lists its pickers offer. Pure: no DOM here, so the
// sentence can be checked to read naturally in every state.

import { MAX_PINNED, quarterLabel, type MetricId, type Selection } from '../../selection';

/** The four parts of the Selection a word in the sentence stands for. */
export type SentenceField = 'metric' | 'sector' | 'quarter' | 'country';

export const SENTENCE_FIELDS: readonly SentenceField[] = ['metric', 'sector', 'quarter', 'country'];

/** The picker choice that stands for null: all Sectors, or no country. */
export const NONE = '';

export const ALL_SECTORS = 'all Sectors';
export const NO_COUNTRY = 'no country';

/**
 * How each metric is written inside the sentence. `lead` is what comes before the clickable word
 * ("Showing the Replacement rate"); `word` is the metric's label, in lower case where the label
 * is not one of the glossary's capitalised terms.
 */
const METRIC_WORDING: Readonly<Record<MetricId, { readonly lead: string; readonly word: string }>> = {
  displacement: { lead: 'Showing ', word: 'Displacement' },
  'net-change': { lead: 'Showing ', word: 'Net change' },
  'replacement-rate': { lead: 'Showing the ', word: 'Replacement rate' },
  'ai-adoption': { lead: 'Showing the ', word: 'AI adoption index' },
  'wage-premium': { lead: 'Showing the ', word: 'AI skills wage premium' },
  'women-share': { lead: 'Showing ', word: "women's share of displaced roles" },
};

/** The metric as its clickable word reads: "Displacement", "women's share of displaced roles". */
export function metricWord(metric: MetricId): string {
  return METRIC_WORDING[metric].word;
}

/**
 * The sentence, cut into the four clickable words and the plain text around them:
 * `gaps[0]`, metric, `gaps[1]`, Sector, `gaps[2]`, quarter, `gaps[3]`, country, `gaps[4]`.
 */
export interface Sentence {
  readonly words: Readonly<Record<SentenceField, string>>;
  readonly gaps: readonly [string, string, string, string, string];
}

/**
 * Writes a Selection as a sentence. `countryName` is the selected country's name, and is ignored
 * when the Selection has no country.
 */
export function sentence(selection: Selection, countryName?: string): Sentence {
  const { lead, word } = METRIC_WORDING[selection.metric];
  return {
    words: {
      metric: word,
      sector: selection.sector ?? ALL_SECTORS,
      quarter: quarterLabel(selection.quarter),
      country: selection.country === null ? NO_COUNTRY : (countryName ?? selection.country),
    },
    gaps: [lead, ' in ', ' for ', ', with ', ' selected.'],
  };
}

/** The whole sentence as plain text. */
export function sentenceText({ words, gaps }: Sentence): string {
  return SENTENCE_FIELDS.map((field, index) => gaps[index] + words[field]).join('') + gaps[4];
}

/** One labelled group of choices in a picker. */
export interface ChoiceGroup {
  readonly label: string;
  readonly choices: readonly { readonly value: string; readonly label: string }[];
}

/** The quarters grouped by year, in the order given: "2024" holding 2024 Q1 to 2024 Q4. */
export function quartersByYear(quarters: readonly string[]): ChoiceGroup[] {
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const quarter of quarters) {
    const year = quarter.slice(0, 4);
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push({ value: quarter, label: quarterLabel(quarter) });
  }
  return [...groups].map(([label, choices]) => ({ label, choices }));
}

/** The countries grouped by region, regions and the countries in each sorted by name. */
export function countriesByRegion(
  countries: readonly { readonly iso3: string; readonly name: string; readonly region: string }[],
): ChoiceGroup[] {
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const { iso3, name, region } of countries) {
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region)!.push({ value: iso3, label: name });
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([label, choices]) => ({
      label,
      choices: choices.sort((a, b) => a.label.localeCompare(b.label, 'en')),
    }));
}

// --- Pinned countries -----------------------------------------------------------------------

/** Where pinning stands for a Selection: what to say, and what can still be pinned. */
export interface Pinning {
  /** No more countries can be pinned until one is removed. */
  readonly full: boolean;
  /** "None pinned", "2 of 3 pinned". */
  readonly count: string;
  /** The selected country's code if it could be pinned now, otherwise null. */
  readonly selectedToPin: string | null;
}

export function pinning({ country, pinned }: Selection): Pinning {
  const full = pinned.length >= MAX_PINNED;
  return {
    full,
    count: pinned.length === 0 ? 'None pinned' : `${pinned.length} of ${MAX_PINNED} pinned`,
    selectedToPin: country !== null && !full && !pinned.includes(country) ? country : null,
  };
}

/** The pinned countries with one more at the end. Unchanged if it is pinned already or there is no room. */
export function withPin(pinned: readonly string[], code: string): readonly string[] {
  return pinned.includes(code) || pinned.length >= MAX_PINNED ? pinned : [...pinned, code];
}

export function withoutPin(pinned: readonly string[], code: string): readonly string[] {
  return pinned.filter((other) => other !== code);
}
