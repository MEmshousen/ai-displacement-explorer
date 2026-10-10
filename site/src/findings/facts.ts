// The facts the Headline findings' text turns on, read from the findings data, and a check that
// the agreed wording ("tripled", "less than a third", "rise with income") still describes them.

import type { Findings } from '../data/shape';
import type { SelectionPatch } from '../selection';
import { pointGap } from './format';

/** The Sector the fourth Headline finding is about. */
export const CLERICAL_SECTOR = 'Administrative & Clerical';

/**
 * What the fourth finding's "See this in the Explorer" link opens: women's share with all Sectors,
 * so the Sector bars show the Sector standing apart. Choosing the Sector itself would leave every
 * country with the same value and the map one flat colour.
 */
export const WOMEN_FINDING_LINK: SelectionPatch = { metric: 'women-share' };

type SectorRow = Findings['sectors'][number];
type IncomeGroupRow = Findings['incomeGroups'][number];
type WomenRow = Findings['women'][number];

export interface FindingFacts {
  /** Finding 2: the Sector with the highest Displacement, and the two with the lowest. */
  readonly topSector: SectorRow;
  readonly lowestSector: SectorRow;
  readonly secondLowestSector: SectorRow;
  /** Finding 3: the two ends of the income groups. */
  readonly highIncome: IncomeGroupRow;
  readonly lowIncome: IncomeGroupRow;
  /** Finding 4: the clerical Sector, and the widest gap in any other Sector in whole points. */
  readonly clerical: WomenRow;
  readonly widestOtherGap: number;
}

/** Throws if the data lacks a row the findings are written around. */
export function findingFacts(findings: Findings): FindingFacts {
  const { sectors, incomeGroups, women } = findings;
  const clerical = women.find((row) => row.sector === CLERICAL_SECTOR);
  if (sectors.length < 3 || incomeGroups.length < 2 || !clerical) {
    throw new Error('The findings data is missing rows the Headline findings are written around.');
  }
  const otherGaps = women
    .filter((row) => row !== clerical)
    .map((row) => Math.abs(row.displaced - row.workforce));

  return {
    topSector: sectors[0],
    lowestSector: sectors[sectors.length - 1],
    secondLowestSector: sectors[sectors.length - 2],
    highIncome: incomeGroups[0],
    lowIncome: incomeGroups[incomeGroups.length - 1],
    clerical,
    widestOtherGap: pointGap(0, Math.max(...otherGaps)),
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** The average of a quarterly series for each calendar year, oldest first. */
export function yearlyAverages(quarters: readonly string[], values: readonly number[]): number[] {
  const byYear = new Map<string, number[]>();
  quarters.forEach((quarter, index) => {
    const year = quarter.slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), values[index]]);
  });
  return [...byYear.keys()].sort().map((year) => mean(byYear.get(year)!));
}

function strictly(values: readonly number[], direction: 'rising' | 'falling'): boolean {
  return values.every(
    (value, index) =>
      index === 0 || (direction === 'rising' ? value > values[index - 1] : value < values[index - 1]),
  );
}

/**
 * The claims in the fixed wording of the findings that the data no longer supports; empty when
 * every one holds. The numbers in the text come from the data, but these words do not, so the
 * page refuses to build rather than print a sentence the data contradicts.
 */
export function wordingProblems(findings: Findings): string[] {
  const facts = findingFacts(findings);
  const { headline, trend, incomeGroups, women } = findings;
  const problems: string[] = [];
  const claim = (holds: boolean, wording: string) => {
    if (!holds) problems.push(wording);
  };

  const growth = headline.displacement.latest / headline.displacement.baseline;
  claim(growth >= 2.5 && growth < 3.5, '"Displacement tripled"');
  claim(headline.netChange.latest < headline.netChange.baseline, '"Net change fell"');
  claim(
    strictly(yearlyAverages(trend.quarters, trend.displacement), 'rising'),
    '"Displacement rose every year"',
  );
  claim(
    strictly(yearlyAverages(trend.quarters, trend.netChange), 'falling') &&
      trend.netChange.every((value) => value < 0),
    '"Net change moved further below zero"',
  );

  const third = facts.topSector.displacement / 3;
  claim(
    facts.lowestSector.displacement < third && facts.secondLowestSector.displacement < third,
    '"at less than a third of that"',
  );

  claim(
    strictly(
      incomeGroups.map((group) => group.displacement),
      'falling',
    ) &&
      incomeGroups.every((group) => group.replacementRate !== null) &&
      strictly(
        incomeGroups.map((group) => group.replacementRate ?? 0),
        'falling',
      ),
    '"Displacement and Replacement rate both rise with income"',
  );

  const clericalGap = facts.clerical.displaced - facts.clerical.workforce;
  claim(
    women.every(
      (row) => row === facts.clerical || Math.abs(row.displaced - row.workforce) < clericalGap / 2,
    ),
    '"One Sector stands apart"',
  );

  return problems;
}
