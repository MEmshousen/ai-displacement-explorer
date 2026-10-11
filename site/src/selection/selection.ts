import { DEFAULT_METRIC, isMetricId, type MetricId } from './metrics';

/** The most countries that can be pinned for comparison on the trend chart. */
export const MAX_PINNED = 3;

/** The single shared choice that drives every view in the Explorer. */
export interface Selection {
  readonly metric: MetricId;
  /** A Sector name exactly as the dataset spells it, or null for all Sectors. */
  readonly sector: string | null;
  /** A quarter label such as "2024-Q3". */
  readonly quarter: string;
  /** An ISO3 country code, or null for no country. */
  readonly country: string | null;
  /** Up to MAX_PINNED distinct ISO3 codes, in the order they were pinned. */
  readonly pinned: readonly string[];
}

/** What the dataset allows a Selection to hold. Supplied by the data step. */
export interface ValidChoices {
  /** Sector names as the dataset spells them. */
  readonly sectors: readonly string[];
  /** Quarter labels in the form "YYYY-Qn". Must not be empty. */
  readonly quarters: readonly string[];
  /** ISO3 country codes. */
  readonly countries: readonly string[];
}

/**
 * A proposed change to a Selection. Fields left out are untouched; values are unchecked, so this
 * is also the shape of whatever was read from a URL.
 */
export interface SelectionPatch {
  readonly metric?: string | null;
  readonly sector?: string | null;
  readonly quarter?: string | null;
  readonly country?: string | null;
  readonly pinned?: readonly string[];
}

/**
 * A quarter as a person reads it: "2026-Q2" as "2026 Q2". The Selection, the data and the URL keep
 * the hyphenated form; every view and Headline finding writes quarters through this.
 */
export function quarterLabel(quarter: string): string {
  return quarter.replace('-', ' ');
}

/** "YYYY-Qn" labels sort chronologically as plain strings. */
export function latestQuarter(choices: ValidChoices): string {
  const latest = [...choices.quarters].sort().at(-1);
  if (latest === undefined) throw new Error('A Selection needs at least one valid quarter.');
  return latest;
}

export function defaultSelection(choices: ValidChoices): Selection {
  return {
    metric: DEFAULT_METRIC,
    sector: null,
    quarter: latestQuarter(choices),
    country: null,
    pinned: [],
  };
}

/**
 * Applies a patch on top of a Selection. Any field the patch gets wrong keeps the value from
 * `base`; unknown or repeated pinned countries are dropped and the rest cut to MAX_PINNED.
 * Never throws.
 */
export function applyPatch(base: Selection, patch: SelectionPatch, choices: ValidChoices): Selection {
  let { metric, sector, quarter, country, pinned } = base;

  if (isMetricId(patch.metric)) metric = patch.metric;

  if (patch.sector === null) sector = null;
  else if (patch.sector !== undefined && choices.sectors.includes(patch.sector)) sector = patch.sector;

  if (typeof patch.quarter === 'string' && choices.quarters.includes(patch.quarter)) {
    quarter = patch.quarter;
  }

  if (patch.country === null) country = null;
  else if (patch.country !== undefined && choices.countries.includes(patch.country)) {
    country = patch.country;
  }

  if (Array.isArray(patch.pinned)) {
    const known = patch.pinned.filter((code) => choices.countries.includes(code));
    pinned = [...new Set(known)].slice(0, MAX_PINNED);
  }

  return { metric, sector, quarter, country, pinned };
}

export function sameSelection(a: Selection, b: Selection): boolean {
  return (
    a.metric === b.metric &&
    a.sector === b.sector &&
    a.quarter === b.quarter &&
    a.country === b.country &&
    a.pinned.length === b.pinned.length &&
    a.pinned.every((code, index) => code === b.pinned[index])
  );
}

// --- URL query string ---------------------------------------------------------------------
//
//   ?metric=net-change&sector=finance-banking&quarter=2024-Q3&country=USA&pin=DEU&pin=JPN
//
// A field at its default is left out, so the default Selection is the bare address.

const PARAMS = ['metric', 'sector', 'quarter', 'country', 'pin'] as const;

/** "Finance & Banking" -> "finance-banking": Sector names are full of characters URLs escape. */
export function sectorSlug(sector: string): string {
  return sector
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Reads a Selection from a query string, with or without its leading "?". Anything missing,
 * invalid or unknown falls back to the default for that field. Never throws.
 */
export function parseSelection(search: string, choices: ValidChoices): Selection {
  const params = new URLSearchParams(search);
  const slug = params.get('sector')?.toLowerCase();

  const patch: SelectionPatch = {
    metric: params.get('metric')?.toLowerCase(),
    sector: choices.sectors.find((sector) => sectorSlug(sector) === slug),
    quarter: params.get('quarter')?.toUpperCase(),
    country: params.get('country')?.toUpperCase(),
    pinned: params.getAll('pin').map((code) => code.toUpperCase()),
  };
  return applyPatch(defaultSelection(choices), patch, choices);
}

/**
 * Writes a Selection as a query string: "" for the default Selection, otherwise "?...".
 * Parameters in `currentSearch` that are not part of the Selection are carried over.
 */
export function serialiseSelection(
  selection: Selection,
  choices: ValidChoices,
  currentSearch = '',
): string {
  const defaults = defaultSelection(choices);
  const params = new URLSearchParams(currentSearch);
  for (const name of PARAMS) params.delete(name);

  if (selection.metric !== defaults.metric) params.set('metric', selection.metric);
  if (selection.sector !== null) params.set('sector', sectorSlug(selection.sector));
  if (selection.quarter !== defaults.quarter) params.set('quarter', selection.quarter);
  if (selection.country !== null) params.set('country', selection.country);
  for (const code of selection.pinned) params.append('pin', code);

  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}
