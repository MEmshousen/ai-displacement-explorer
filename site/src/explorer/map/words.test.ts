import { describe, expect, it } from 'vitest';
import { countryLabel, mapSubtitle, mapSummary, mapTitle } from './words';

const all = { metric: 'displacement', sector: null, quarter: '2026-Q2' } as const;

describe('mapTitle', () => {
  it('names the metric, the Sector and the quarter', () => {
    expect(mapTitle(all)).toBe('Displacement in all Sectors, 2026-Q2');
    expect(mapTitle({ metric: 'net-change', sector: 'Finance & Banking', quarter: '2021-Q3' })).toBe(
      'Net change in Finance & Banking, 2021-Q3',
    );
  });
});

describe('mapSubtitle', () => {
  it('starts with what a value counts', () => {
    expect(mapSubtitle(all)).toMatch(/^% of the Sector workforce, by country\./);
    expect(mapSubtitle({ ...all, metric: 'replacement-rate' })).toMatch(
      /^New roles per 100 displaced, by country\./,
    );
  });
});

describe('countryLabel', () => {
  it('writes the value in the metric format', () => {
    expect(countryLabel('displacement', { name: 'Germany', value: 0.0406 })).toBe('Germany: 4.1%');
    expect(countryLabel('net-change', { name: 'Kenya', value: -0.006 })).toBe('Kenya: -0.6%');
    expect(countryLabel('replacement-rate', { name: 'Chile', value: null })).toBe('Chile: No value');
  });
});

describe('mapSummary', () => {
  const countries = [
    { name: 'Aland', value: 0.01 },
    { name: 'Bland', value: 0.09 },
    { name: 'Cland', value: 0.05 },
    { name: 'Dland', value: null },
    { name: 'Eland', value: 0.03 },
    { name: 'Fland', value: 0.07 },
  ];

  it('names the highest and lowest countries and counts those with a value', () => {
    expect(mapSummary(all, countries, 2)).toBe(
      'Displacement in all Sectors, 2026-Q2. Highest: Bland (9.0%), Fland (7.0%). ' +
        'Lowest: Aland (1.0%), Eland (3.0%). 5 countries have a value; every other country is shown as no data.',
    );
  });

  it('never names a country at both ends', () => {
    expect(mapSummary(all, countries.slice(0, 3))).toBe(
      'Displacement in all Sectors, 2026-Q2. Highest: Bland (9.0%). Lowest: Aland (1.0%). ' +
        '3 countries have a value; every other country is shown as no data.',
    );
  });

  it('copes with one country and with none', () => {
    expect(mapSummary(all, countries.slice(0, 1))).toBe(
      'Displacement in all Sectors, 2026-Q2. Aland (1.0%). 1 country has a value; every other country is shown as no data.',
    );
    expect(mapSummary(all, [{ name: 'Dland', value: null }])).toBe(
      'Displacement in all Sectors, 2026-Q2. No country has a value.',
    );
  });
});
