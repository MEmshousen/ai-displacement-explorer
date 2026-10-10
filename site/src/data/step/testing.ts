// Test helpers for the data step: the real CSV, and small made-up CSVs to break on purpose.

import { readFileSync } from 'node:fs';
import { EXPLORER_COLUMNS } from '../shape';
import { CSV_NAME, WORKFORCE_FEMALE, type ExpectedSize } from './dataset';

export function readRealCsv(): string {
  return readFileSync(new URL(`../../../../${CSV_NAME}`, import.meta.url), 'utf8');
}

export const SMALL_SIZE: ExpectedSize = { countries: 2, sectors: 2, quarters: 2 };

const HEADER = [
  'record_id',
  'country',
  'iso3_code',
  'region',
  'income_group',
  'quarter_label',
  'industry_sector',
  ...EXPLORER_COLUMNS,
  WORKFORCE_FEMALE,
  'data_source_notes',
];

/** The rows of a valid 2 x 2 x 2 dataset, as objects keyed by column name. */
export function smallRows(): Record<string, string>[] {
  const countries = [
    ['United States', 'USA', 'North America', 'High Income'],
    ['Nigeria', 'NGA', 'Africa', 'Lower Middle Income'],
  ];
  const rows: Record<string, string>[] = [];
  for (const [country, iso3, region, incomeGroup] of countries) {
    for (const sector of ['Finance & Banking', 'Retail & E-Commerce']) {
      for (const quarter of ['2020-Q1', '2020-Q2']) {
        const row: Record<string, string> = {
          record_id: String(rows.length + 1),
          country,
          iso3_code: iso3,
          region,
          income_group: incomeGroup,
          quarter_label: quarter,
          industry_sector: sector,
          data_source_notes: 'Synthetic, "quoted", with commas',
        };
        for (const column of [...EXPLORER_COLUMNS, WORKFORCE_FEMALE]) row[column] = '0.1';
        rows.push(row);
      }
    }
  }
  return rows;
}

export function toCsv(rows: Record<string, string>[], header: string[] = HEADER): string {
  const quote = (field: string) => (/[",\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field);
  const lines = [header, ...rows.map((row) => header.map((column) => row[column] ?? ''))];
  return lines.map((fields) => fields.map(quote).join(',')).join('\n') + '\n';
}

export const SMALL_HEADER: readonly string[] = HEADER;
