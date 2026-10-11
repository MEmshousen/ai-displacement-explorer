import { describe, expect, it } from 'vitest';
import { DataStepError, parseCsv, readDataset } from './dataset';
import { SMALL_HEADER, SMALL_SIZE, readRealCsv, smallRows, toCsv } from './testing';

const DISPLACED = 'pct_sector_workforce_displaced';

/** The problems the step reports for a CSV, or [] if it accepts it. */
function problemsWith(csv: string): readonly string[] {
  try {
    readDataset(csv, SMALL_SIZE);
    return [];
  } catch (error) {
    if (error instanceof DataStepError) return error.problems;
    throw error;
  }
}

describe('parseCsv', () => {
  it('honours quoted fields, escaped quotes, CRLF and a byte order mark', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['1', ''],
    ]);
  });
});

describe('the real CSV', () => {
  const dataset = readDataset(readRealCsv());

  it('holds every one of the 80 x 10 x 26 cells', () => {
    expect(dataset.countries).toHaveLength(80);
    expect(dataset.sectors).toHaveLength(10);
    expect(dataset.quarters).toHaveLength(26);
    for (const column of Object.values(dataset.columns)) expect(column).toHaveLength(20_800);
  });

  it('puts the lists in a fixed order: ISO3 codes, Sector names, quarters oldest first', () => {
    const codes = dataset.countries.map((country) => country.iso3);
    expect(codes).toEqual([...codes].sort());
    expect(dataset.sectors).toEqual([...dataset.sectors].sort());
    expect(dataset.quarters[0]).toBe('2020-Q1');
    expect(dataset.quarters.at(-1)).toBe('2026-Q2');
  });

  it('places a known row in its cell', () => {
    // CSV line 2: United States, Technology & Software, 2020-Q1, displaced 0.0406.
    const cell =
      (dataset.countries.findIndex((country) => country.iso3 === 'USA') * 10 +
        dataset.sectors.indexOf('Technology & Software')) *
      26;
    expect(dataset.columns[DISPLACED][cell]).toBe(0.0406);
    expect(dataset.countries.find((country) => country.iso3 === 'USA')).toEqual({
      iso3: 'USA',
      name: 'United States',
      region: 'North America',
      incomeGroup: 'High Income',
    });
  });
});

describe('refusing bad data', () => {
  it('accepts a complete small dataset', () => {
    expect(problemsWith(toCsv(smallRows()))).toEqual([]);
  });

  it('ignores row order and blanks in columns it does not need', () => {
    const rows = smallRows().reverse();
    rows[0].data_source_notes = '';
    const dataset = readDataset(toCsv(rows), SMALL_SIZE);
    expect(dataset.countries.map((country) => country.iso3)).toEqual(['NGA', 'USA']);
    expect(dataset.quarters).toEqual(['2020-Q1', '2020-Q2']);
  });

  it('fails on the wrong number of rows, naming the missing cell', () => {
    const problems = problemsWith(toCsv(smallRows().slice(0, -1)));
    expect(problems).toContain('expected 8 rows (2 countries x 2 Sectors x 2 quarters), found 7');
    expect(problems).toContain('missing cell: NGA, Retail & E-Commerce, 2020-Q2');
  });

  it('fails on a duplicated cell even when the row count is right', () => {
    const rows = smallRows();
    rows[7] = { ...rows[0] };
    const problems = problemsWith(toCsv(rows));
    expect(problems).toContain('duplicated cell: USA, Finance & Banking, 2020-Q1 (lines 2 and 9)');
    expect(problems).toContain('missing cell: NGA, Retail & E-Commerce, 2020-Q2');
  });

  it('fails on a blank needed value', () => {
    const rows = smallRows();
    rows[2][DISPLACED] = ' ';
    expect(problemsWith(toCsv(rows))).toEqual([`line 4: "${DISPLACED}" is blank`]);
  });

  it('fails on a needed value that is not a number', () => {
    const rows = smallRows();
    rows[2][DISPLACED] = 'n/a';
    expect(problemsWith(toCsv(rows))).toEqual([`line 4: "${DISPLACED}" is not a number ("n/a")`]);
  });

  it('fails on a blank country, Sector or quarter', () => {
    const rows = smallRows();
    rows[0].industry_sector = '';
    expect(problemsWith(toCsv(rows))).toContain('line 2: "industry_sector" is blank');
  });

  it('fails when a needed column is absent', () => {
    const header = SMALL_HEADER.filter((column) => column !== DISPLACED);
    expect(problemsWith(toCsv(smallRows(), header))).toEqual([`the "${DISPLACED}" column is missing`]);
  });

  it('fails when a country changes its details between rows', () => {
    const rows = smallRows();
    rows[1].income_group = 'Low Income';
    expect(problemsWith(toCsv(rows))).toEqual([
      'line 3: USA is given a different name, region or income group than earlier',
    ]);
  });

  it('fails on too many countries even if every cell is filled', () => {
    const extra = smallRows()
      .slice(0, 4)
      .map((row) => ({ ...row, country: 'Germany', iso3_code: 'DEU', region: 'Europe' }));
    const problems = problemsWith(toCsv([...smallRows(), ...extra]));
    expect(problems).toContain('expected 2 countries, found 3');
  });

  it('says which file is at fault and lists what is wrong', () => {
    const rows = smallRows();
    rows[2][DISPLACED] = '';
    expect(() => readDataset(toCsv(rows), SMALL_SIZE)).toThrow(
      'Data step failed: ai_workforce_displacement_global_2020_2026.csv cannot be used.\n' +
        `  - line 4: "${DISPLACED}" is blank`,
    );
  });

  it('cuts a long list of problems short', () => {
    // Eight blank Displacement values and five blank adoption values: thirteen problems.
    const rows = smallRows();
    rows.forEach((row, index) => {
      row[DISPLACED] = '';
      if (index < 5) row.ai_adoption_index = '';
    });
    const message = (() => {
      try {
        readDataset(toCsv(rows), SMALL_SIZE);
        return '';
      } catch (error) {
        return (error as Error).message;
      }
    })();
    expect(message.split('\n')).toHaveLength(14);
    expect(message).toMatch(/\(and 1 more\)$/);
  });

  it('holds the real dataset to 80 x 10 x 26 by default', () => {
    expect(() => readDataset(toCsv(smallRows()))).toThrow(
      'expected 20,800 rows (80 countries x 10 Sectors x 26 quarters), found 8',
    );
  });
});
