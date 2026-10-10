// Reads the source CSV into a checked Dataset, or refuses it with a message that says what is
// wrong. Everything the step writes is built from the Dataset, never from the raw rows.

import { EXPLORER_COLUMNS } from '../shape';

export const CSV_NAME = 'ai_workforce_displacement_global_2020_2026.csv';

/** Women's share of the Sector workforce: read by a Headline finding, not shipped to the Explorer. */
export const WORKFORCE_FEMALE = 'pct_workforce_female';

/** Income groups as the dataset spells them, from high income to low. */
export const INCOME_GROUPS = [
  'High Income',
  'Upper Middle Income',
  'Lower Middle Income',
  'Low Income',
] as const;

const KEY = {
  country: 'country',
  iso3: 'iso3_code',
  region: 'region',
  incomeGroup: 'income_group',
  sector: 'industry_sector',
  quarter: 'quarter_label',
} as const;

const VALUE_COLUMNS: readonly string[] = [...EXPLORER_COLUMNS, WORKFORCE_FEMALE];

/** How many countries, Sectors and quarters the dataset must hold. */
export interface ExpectedSize {
  readonly countries: number;
  readonly sectors: number;
  readonly quarters: number;
}

export const EXPECTED_SIZE: ExpectedSize = { countries: 80, sectors: 10, quarters: 26 };

export interface Country {
  readonly iso3: string;
  readonly name: string;
  readonly region: string;
  readonly incomeGroup: string;
}

/** The dataset with every cell present exactly once and every needed value a number. */
export interface Dataset {
  /** Sorted by ISO3 code. */
  readonly countries: readonly Country[];
  /** Sorted by name. */
  readonly sectors: readonly string[];
  /** Oldest first. */
  readonly quarters: readonly string[];
  /**
   * The needed value columns at the CSV's own precision, keyed by column name. The cell for
   * country c, Sector s and quarter q is at `(c * sectors.length + s) * quarters.length + q`.
   */
  readonly columns: Readonly<Record<string, readonly number[]>>;
}

/** Thrown when the CSV cannot be used. Its message lists what is wrong. */
export class DataStepError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    const shown = problems.slice(0, MAX_PROBLEMS_SHOWN).map((problem) => `  - ${problem}`);
    const hidden = problems.length - shown.length;
    if (hidden > 0) shown.push(`  (and ${hidden} more)`);
    super(`Data step failed: ${CSV_NAME} cannot be used.\n${shown.join('\n')}`);
    this.name = 'DataStepError';
    this.problems = problems;
  }
}

const MAX_PROBLEMS_SHOWN = 12;

/** Splits CSV text into records of fields, honouring quoted fields. Blank lines are skipped. */
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  const endRecord = () => {
    record.push(field);
    field = '';
    if (record.length > 1 || record[0] !== '') records.push(record);
    record = [];
  };

  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') field += text[++i];
      else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n') endRecord();
    else if (char !== '\r') field += char;
  }
  if (field !== '' || record.length > 0) endRecord();
  return records;
}

/**
 * Parses and checks the CSV. Throws a DataStepError unless there is exactly one row for every
 * country x Sector x quarter cell of the expected size and no needed value is blank.
 */
export function readDataset(csvText: string, expected: ExpectedSize = EXPECTED_SIZE): Dataset {
  const [header = [], ...records] = parseCsv(csvText);

  const needed = [...Object.values(KEY), ...VALUE_COLUMNS];
  const absent = needed.filter((column) => !header.includes(column));
  if (absent.length > 0) {
    throw new DataStepError(absent.map((column) => `the "${column}" column is missing`));
  }
  const at = (column: string) => header.indexOf(column);
  const keyAt = Object.fromEntries(Object.entries(KEY).map(([name, column]) => [name, at(column)]));
  const valueAt = VALUE_COLUMNS.map(at);

  const problems: string[] = [];
  const count = (n: number) => n.toLocaleString('en-US');

  const expectedRows = expected.countries * expected.sectors * expected.quarters;
  if (records.length !== expectedRows) {
    problems.push(
      `expected ${count(expectedRows)} rows (${expected.countries} countries x ` +
        `${expected.sectors} Sectors x ${expected.quarters} quarters), found ${count(records.length)}`,
    );
  }

  // First pass: every row's keys, the lists they form, and one set of details per country.
  const countryByIso3 = new Map<string, Country>();
  const sectorSet = new Set<string>();
  const quarterSet = new Set<string>();
  const usable: { line: number; record: string[]; iso3: string; sector: string; quarter: string }[] = [];

  records.forEach((record, index) => {
    const line = index + 2; // the header is line 1
    const text = (name: keyof typeof KEY) => (record[keyAt[name]] ?? '').trim();

    const blank = (Object.keys(KEY) as (keyof typeof KEY)[]).filter((name) => text(name) === '');
    if (blank.length > 0) {
      for (const name of blank) problems.push(`line ${line}: "${KEY[name]}" is blank`);
      return;
    }

    const country: Country = {
      iso3: text('iso3'),
      name: text('country'),
      region: text('region'),
      incomeGroup: text('incomeGroup'),
    };
    const quarter = text('quarter');
    if (!/^[A-Z]{3}$/.test(country.iso3)) {
      problems.push(`line ${line}: "${country.iso3}" is not an ISO3 country code`);
    }
    if (!/^\d{4}-Q[1-4]$/.test(quarter)) {
      problems.push(`line ${line}: quarter "${quarter}" is not in the form YYYY-Qn`);
    }
    if (!(INCOME_GROUPS as readonly string[]).includes(country.incomeGroup)) {
      problems.push(`line ${line}: unknown income group "${country.incomeGroup}"`);
    }

    const known = countryByIso3.get(country.iso3);
    if (!known) countryByIso3.set(country.iso3, country);
    else if (
      known.name !== country.name ||
      known.region !== country.region ||
      known.incomeGroup !== country.incomeGroup
    ) {
      problems.push(
        `line ${line}: ${country.iso3} is given a different name, region or income group than earlier`,
      );
    }

    sectorSet.add(text('sector'));
    quarterSet.add(quarter);
    usable.push({ line, record, iso3: country.iso3, sector: text('sector'), quarter });
  });

  const countries = [...countryByIso3.values()].sort((a, b) => (a.iso3 < b.iso3 ? -1 : 1));
  const sectors = [...sectorSet].sort();
  const quarters = [...quarterSet].sort();

  const sizes = [
    ['countries', countries.length, expected.countries],
    ['Sectors', sectors.length, expected.sectors],
    ['quarters', quarters.length, expected.quarters],
  ] as const;
  for (const [what, found, wanted] of sizes) {
    if (found !== wanted) problems.push(`expected ${wanted} ${what}, found ${found}`);
  }

  // Second pass: place each row in its cell, catching duplicates and blank values.
  const countryIndex = new Map(countries.map((country, index) => [country.iso3, index]));
  const sectorIndex = new Map(sectors.map((sector, index) => [sector, index]));
  const quarterIndex = new Map(quarters.map((quarter, index) => [quarter, index]));
  const cellCount = countries.length * sectors.length * quarters.length;
  const filledAtLine = new Array<number>(cellCount).fill(0);
  const columns = VALUE_COLUMNS.map(() => new Array<number>(cellCount).fill(NaN));

  for (const { line, record, iso3, sector, quarter } of usable) {
    const cell =
      (countryIndex.get(iso3)! * sectors.length + sectorIndex.get(sector)!) * quarters.length +
      quarterIndex.get(quarter)!;
    if (filledAtLine[cell] !== 0) {
      problems.push(
        `duplicated cell: ${iso3}, ${sector}, ${quarter} (lines ${filledAtLine[cell]} and ${line})`,
      );
      continue;
    }
    filledAtLine[cell] = line;

    VALUE_COLUMNS.forEach((column, c) => {
      const raw = (record[valueAt[c]] ?? '').trim();
      const value = raw === '' ? NaN : Number(raw);
      if (raw === '') problems.push(`line ${line}: "${column}" is blank`);
      else if (!Number.isFinite(value)) problems.push(`line ${line}: "${column}" is not a number ("${raw}")`);
      columns[c][cell] = value;
    });
  }

  filledAtLine.forEach((line, cell) => {
    if (line !== 0) return;
    const quarter = quarters[cell % quarters.length];
    const sector = sectors[Math.floor(cell / quarters.length) % sectors.length];
    const country = countries[Math.floor(cell / (quarters.length * sectors.length))];
    problems.push(`missing cell: ${country.iso3}, ${sector}, ${quarter}`);
  });

  if (problems.length > 0) throw new DataStepError(problems);

  return {
    countries,
    sectors,
    quarters,
    columns: Object.fromEntries(VALUE_COLUMNS.map((column, c) => [column, columns[c]])),
  };
}
