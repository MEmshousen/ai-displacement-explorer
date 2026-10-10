import { describe, expect, it } from 'vitest';
import type { Findings } from '../data/shape';
import { CLERICAL_SECTOR, findingFacts, WOMEN_FINDING_LINK, wordingProblems, yearlyAverages } from './facts';
import {
  incomeGroupLabel,
  netChange,
  pointGap,
  replacementRate,
  share,
  signedPoints,
  wholeShare,
} from './format';

/** A small set of findings for which every claim in the fixed wording holds. */
function sample(): Findings {
  return {
    choices: { sectors: [], quarters: ['2020-Q1'], countries: ['USA'] },
    periods: { baseline: ['2020-Q1', '2020-Q2'], latest: ['2021-Q1', '2021-Q2'] },
    headline: {
      displacement: { baseline: 0.0273, latest: 0.0869 },
      netChange: { baseline: -0.0094, latest: -0.0327 },
    },
    trend: {
      quarters: ['2020-Q1', '2020-Q2', '2021-Q1', '2021-Q2'],
      displacement: [0.02, 0.03, 0.08, 0.09],
      netChange: [-0.008, -0.01, -0.03, -0.035],
    },
    sectors: [
      { sector: CLERICAL_SECTOR, displacement: 0.1419 },
      { sector: 'Finance & Banking', displacement: 0.0934 },
      { sector: 'Education & Research', displacement: 0.0391 },
      { sector: 'Healthcare & Life Sciences', displacement: 0.0325 },
    ],
    incomeGroups: [
      { incomeGroup: 'High Income', countries: 31, displacement: 0.1311, replacementRate: 74.7 },
      { incomeGroup: 'Upper Middle Income', countries: 22, displacement: 0.0684, replacementRate: 55.4 },
      { incomeGroup: 'Low Income', countries: 3, displacement: 0.0467, replacementRate: 19.6 },
    ],
    women: [
      { sector: CLERICAL_SECTOR, workforce: 0.79, displaced: 0.95 },
      { sector: 'Healthcare & Life Sciences', workforce: 0.72, displaced: 0.7575 },
      { sector: 'Finance & Banking', workforce: 0.48, displaced: 0.5043 },
    ],
  };
}

describe('formats', () => {
  it('writes shares to one decimal place with a true minus sign', () => {
    expect(share(0.0869)).toBe('8.7%');
    expect(netChange(-0.0327)).toBe('−3.3%');
    expect(netChange(-0.0094)).toBe('−0.9%');
  });

  it('writes Replacement rate as a whole number', () => {
    expect(replacementRate(74.7)).toBe('75');
    expect(replacementRate(19.6)).toBe('20');
  });

  it('writes whole percentages, including axis ticks below zero', () => {
    expect(wholeShare(0.79)).toBe('79%');
    expect(wholeShare(0.608)).toBe('61%');
    expect(wholeShare(-0.04)).toBe('−4%');
    expect(wholeShare(0)).toBe('0%');
  });

  it('measures and writes a gap in whole percentage points', () => {
    expect(pointGap(0.79, 0.95)).toBe(16);
    expect(pointGap(0.72, 0.7575)).toBe(4);
    expect(signedPoints(16)).toBe('+16 pts');
    expect(signedPoints(1)).toBe('+1 pt');
    expect(signedPoints(-2)).toBe('−2 pts');
    expect(signedPoints(0)).toBe('0 pts');
  });

  it('writes income groups in sentence case', () => {
    expect(incomeGroupLabel('Upper Middle Income')).toBe('Upper middle income');
  });
});

describe('the fourth finding\'s Explorer link', () => {
  it('opens women\'s share with all Sectors, so the Sector bars show the contrast', () => {
    expect(WOMEN_FINDING_LINK).toEqual({ metric: 'women-share' });
  });
});

describe('findingFacts', () => {
  it('picks out the rows the text is written around', () => {
    const facts = findingFacts(sample());
    expect(facts.topSector.sector).toBe(CLERICAL_SECTOR);
    expect(facts.lowestSector.sector).toBe('Healthcare & Life Sciences');
    expect(facts.secondLowestSector.sector).toBe('Education & Research');
    expect(facts.highIncome.countries).toBe(31);
    expect(facts.lowIncome.countries).toBe(3);
    expect(facts.clerical.displaced).toBe(0.95);
  });

  it('gives the widest gap among the other Sectors, leaving the clerical Sector out', () => {
    expect(findingFacts(sample()).widestOtherGap).toBe(4);
  });

  it('throws when the clerical Sector is missing', () => {
    const findings = sample();
    expect(() => findingFacts({ ...findings, women: findings.women.slice(1) })).toThrow();
  });
});

describe('yearlyAverages', () => {
  it('averages a quarterly series by calendar year, oldest first', () => {
    const averages = yearlyAverages(['2021-Q1', '2020-Q1', '2020-Q2'], [9, 1, 3]);
    expect(averages).toEqual([2, 9]);
  });
});

describe('wordingProblems', () => {
  it('finds nothing wrong when the data supports the wording', () => {
    expect(wordingProblems(sample())).toEqual([]);
  });

  it('flags "tripled" when Displacement only doubled', () => {
    const findings = sample();
    const headline = { ...findings.headline, displacement: { baseline: 0.04, latest: 0.08 } };
    expect(wordingProblems({ ...findings, headline })).toEqual(['"Displacement tripled"']);
  });

  it('flags "rose every year" when a year dips', () => {
    const findings = sample();
    const trend = { ...findings.trend, displacement: [0.05, 0.06, 0.04, 0.05] };
    expect(wordingProblems({ ...findings, trend })).toEqual(['"Displacement rose every year"']);
  });

  it('flags "less than a third" when a low Sector is too close to the top one', () => {
    const findings = sample();
    const sectors = findings.sectors.map((row) =>
      row.sector === 'Education & Research' ? { ...row, displacement: 0.06 } : row,
    );
    expect(wordingProblems({ ...findings, sectors })).toEqual(['"at less than a third of that"']);
  });

  it('flags "rise with income" when Replacement rate is out of order or missing', () => {
    const findings = sample();
    const outOfOrder = findings.incomeGroups.map((group, index) =>
      index === 1 ? { ...group, replacementRate: 80 } : group,
    );
    const missing = findings.incomeGroups.map((group, index) =>
      index === 2 ? { ...group, replacementRate: null } : group,
    );
    const wording = '"Displacement and Replacement rate both rise with income"';
    expect(wordingProblems({ ...findings, incomeGroups: outOfOrder })).toEqual([wording]);
    expect(wordingProblems({ ...findings, incomeGroups: missing })).toEqual([wording]);
  });

  it('flags "One Sector stands apart" when another Sector has a comparable gap', () => {
    const findings = sample();
    const women = findings.women.map((row) =>
      row.sector === 'Finance & Banking' ? { ...row, displaced: 0.6 } : row,
    );
    expect(wordingProblems({ ...findings, women })).toEqual(['"One Sector stands apart"']);
  });
});
