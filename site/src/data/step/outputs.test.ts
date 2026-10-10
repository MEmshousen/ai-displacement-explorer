import { describe, expect, it } from 'vitest';
import { createExplorer } from '../explorer';
import { EXPLORER_COLUMNS } from '../shape';
import { readDataset } from './dataset';
import { buildExplorerData, buildFindings } from './outputs';
import { readRealCsv } from './testing';

const dataset = readDataset(readRealCsv());

/** A decimal fraction as a percentage to one place, the way the agreed figures are quoted. */
const pct = (fraction: number) => (fraction * 100).toFixed(1);

describe('the Headline findings, against the figures agreed in issue 2', () => {
  const findings = buildFindings(dataset);

  it('compares 2020 with the latest four quarters', () => {
    expect(findings.periods).toEqual({
      baseline: ['2020-Q1', '2020-Q2', '2020-Q3', '2020-Q4'],
      latest: ['2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2'],
    });
  });

  it('finding 1: Displacement went from 2.7% to 8.7%, Net change from -0.9% to -3.3%', () => {
    expect(pct(findings.headline.displacement.baseline)).toBe('2.7');
    expect(pct(findings.headline.displacement.latest)).toBe('8.7');
    expect(pct(findings.headline.netChange.baseline)).toBe('-0.9');
    expect(pct(findings.headline.netChange.latest)).toBe('-3.3');
  });

  it('finding 1: has a quarterly point for Displacement and Net change', () => {
    expect(findings.trend.quarters).toEqual(dataset.quarters);
    expect(findings.trend.displacement).toHaveLength(26);
    expect(findings.trend.netChange).toHaveLength(26);

    // The four 2020 quarters hold the same number of rows, so their mean is the 2020 average.
    const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean(findings.trend.displacement.slice(0, 4))).toBeCloseTo(
      findings.headline.displacement.baseline,
      4,
    );
    expect(mean(findings.trend.netChange.slice(-4))).toBeCloseTo(findings.headline.netChange.latest, 4);
  });

  it('finding 2: Sectors run from Administrative & Clerical at 14.2% to Healthcare at 3.3%', () => {
    expect(findings.sectors).toHaveLength(10);
    expect(findings.sectors[0].sector).toBe('Administrative & Clerical');
    expect(pct(findings.sectors[0].displacement)).toBe('14.2');
    expect(findings.sectors[9].sector).toBe('Healthcare & Life Sciences');
    expect(pct(findings.sectors[9].displacement)).toBe('3.3');

    const ranked = findings.sectors.map((entry) => entry.displacement);
    expect(ranked).toEqual([...ranked].sort((a, b) => b - a));
  });

  it('finding 3: by income group, Displacement 13.1%, 6.8%, 5.2%, 4.7%', () => {
    expect(findings.incomeGroups.map((group) => group.incomeGroup)).toEqual([
      'High Income',
      'Upper Middle Income',
      'Lower Middle Income',
      'Low Income',
    ]);
    expect(findings.incomeGroups.map((group) => pct(group.displacement))).toEqual([
      '13.1',
      '6.8',
      '5.2',
      '4.7',
    ]);
    expect(findings.incomeGroups.reduce((total, group) => total + group.countries, 0)).toBe(80);
  });

  it('finding 3: by income group, Replacement rate 75, 55, 35, 20', () => {
    expect(findings.incomeGroups.map((group) => group.replacementRate?.toFixed(0))).toEqual([
      '75',
      '55',
      '35',
      '20',
    ]);
  });

  it('finding 4: women are 79% of the clerical workforce and 95% of its displaced roles', () => {
    expect(findings.women.map((entry) => entry.sector)).toEqual(dataset.sectors);
    const clerical = findings.women.find((entry) => entry.sector === 'Administrative & Clerical')!;
    expect((clerical.workforce * 100).toFixed(0)).toBe('79');
    expect((clerical.displaced * 100).toFixed(0)).toBe('95');
  });

  it('finding 4: in every other Sector the two shares are within about 4 points', () => {
    for (const entry of findings.women) {
      if (entry.sector === 'Administrative & Clerical') continue;
      expect(Math.abs(entry.displaced - entry.workforce), entry.sector).toBeLessThan(0.045);
    }
  });

  it('carries the choices a Selection may hold', () => {
    expect(findings.choices.sectors).toHaveLength(10);
    expect(findings.choices.quarters).toHaveLength(26);
    expect(findings.choices.countries).toHaveLength(80);
    expect(findings.choices.countries).toContain('USA');
  });
});

describe('the Explorer data', () => {
  const data = buildExplorerData(dataset);

  it('ships exactly the six columns the metrics need, one value per cell', () => {
    expect(Object.keys(data.columns).sort()).toEqual(
      [
        'ai_adoption_index',
        'ai_skill_wage_premium_pct',
        'net_workforce_change_pct',
        'pct_displaced_roles_female',
        'pct_sector_workforce_displaced',
        'pct_sector_workforce_new_roles_created',
      ].sort(),
    );
    expect(Object.keys(data.columns)).toEqual(EXPLORER_COLUMNS);
    for (const column of Object.values(data.columns)) expect(column).toHaveLength(20_800);
  });

  it('stores each country once, keyed by ISO3 code', () => {
    expect(data.countries).toHaveLength(80);
    expect(new Set(data.countries).size).toBe(80);
    for (const code of data.countries) expect(code).toMatch(/^[A-Z]{3}$/);
    expect(data.countryNames).toHaveLength(80);
    expect(data.regions).toHaveLength(80);
    expect(data.incomeGroups).toHaveLength(80);
    expect(Object.keys(data).sort()).toEqual(
      ['columns', 'countries', 'countryNames', 'incomeGroups', 'quarters', 'regions', 'sectors'].sort(),
    );
  });

  it('stores plain decimal fractions at no more than four places', () => {
    for (const column of Object.values(data.columns)) {
      for (const value of column) expect(Number(value.toFixed(4))).toBe(value);
    }
  });

  it('gives the browser the same answers as the Headline findings', () => {
    const explorer = createExplorer(JSON.parse(JSON.stringify(data)));
    const findings = buildFindings(dataset);

    findings.trend.quarters.forEach((quarter, q) => {
      const scope = { country: null, sector: null, quarter };
      expect(explorer.value('displacement', scope)).toBeCloseTo(findings.trend.displacement[q], 4);
      expect(explorer.value('net-change', scope)).toBeCloseTo(findings.trend.netChange[q], 4);
    });
    expect(explorer.value('displacement', { country: 'USA', sector: 'Technology & Software', quarter: '2020-Q1' })).toBe(0.0406);
  });
});
