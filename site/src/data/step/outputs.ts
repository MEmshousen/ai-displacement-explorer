// Turns a checked Dataset into the two things the site loads: the Explorer data (every cell,
// fetched by the browser) and the Headline findings (read by Astro at build time).

import { getMetric, type MetricId } from '../../selection';
import { EXPLORER_COLUMNS, type ExplorerData, type Findings } from '../shape';
import { INCOME_GROUPS, WORKFORCE_FEMALE, type Dataset } from './dataset';

const round = (value: number, places: number) => Number(value.toFixed(places));

/** The year the headline numbers compare the latest four quarters against. */
const BASELINE_YEAR = '2020';

/** Every cell, with only the columns the six metrics need, rounded to four places. */
export function buildExplorerData(dataset: Dataset): ExplorerData {
  return {
    sectors: dataset.sectors,
    quarters: dataset.quarters,
    countries: dataset.countries.map((country) => country.iso3),
    countryNames: dataset.countries.map((country) => country.name),
    regions: dataset.countries.map((country) => country.region),
    incomeGroups: dataset.countries.map((country) => country.incomeGroup),
    columns: Object.fromEntries(
      EXPLORER_COLUMNS.map((column) => [
        column,
        dataset.columns[column].map((value) => round(value, 4)),
      ]),
    ),
  };
}

function columnOf(id: MetricId): string {
  const { source } = getMetric(id);
  if (source.kind !== 'column') throw new Error(`${id} is not read from a single column.`);
  return source.column;
}

/** The four Headline findings, as simple averages over dataset rows. */
export function buildFindings(dataset: Dataset): Findings {
  const { countries, sectors, quarters, columns } = dataset;
  const displacement = columns[columnOf('displacement')];
  const netChange = columns[columnOf('net-change')];
  const womenDisplaced = columns[columnOf('women-share')];
  const womenWorkforce = columns[WORKFORCE_FEMALE];

  const replacement = getMetric('replacement-rate').source;
  if (replacement.kind !== 'ratio') throw new Error('Replacement rate is not a ratio.');
  const newRoles = columns[replacement.numerator];
  const displaced = columns[replacement.denominator];

  // The rows in view: every cell whose country, Sector and quarter pass the three tests.
  type Scope = { country?: (c: number) => boolean; sector?: number; quarter?: (q: number) => boolean };
  const rows = ({ country, sector, quarter }: Scope): number[] => {
    const cells: number[] = [];
    for (let c = 0; c < countries.length; c++) {
      if (country && !country(c)) continue;
      for (let s = 0; s < sectors.length; s++) {
        if (sector !== undefined && s !== sector) continue;
        for (let q = 0; q < quarters.length; q++) {
          if (!quarter || quarter(q)) cells.push((c * sectors.length + s) * quarters.length + q);
        }
      }
    }
    return cells;
  };
  const sum = (column: readonly number[], cells: number[]) =>
    cells.reduce((total, cell) => total + column[cell], 0);
  const mean = (column: readonly number[], cells: number[]) => round(sum(column, cells) / cells.length, 4);

  const inBaseline = (q: number) => quarters[q].startsWith(`${BASELINE_YEAR}-`);
  const inLatest = (q: number) => q >= quarters.length - 4;
  const baselineRows = rows({ quarter: inBaseline });
  const latestRows = rows({ quarter: inLatest });

  return {
    choices: { sectors, quarters, countries: countries.map((country) => country.iso3) },
    periods: {
      baseline: quarters.filter((_, q) => inBaseline(q)),
      latest: quarters.filter((_, q) => inLatest(q)),
    },
    headline: {
      displacement: {
        baseline: mean(displacement, baselineRows),
        latest: mean(displacement, latestRows),
      },
      netChange: { baseline: mean(netChange, baselineRows), latest: mean(netChange, latestRows) },
    },
    trend: {
      quarters,
      displacement: quarters.map((_, q) => mean(displacement, rows({ quarter: (other) => other === q }))),
      netChange: quarters.map((_, q) => mean(netChange, rows({ quarter: (other) => other === q }))),
    },
    sectors: sectors
      .map((sector, s) => ({
        sector,
        displacement: mean(displacement, rows({ sector: s, quarter: inLatest })),
      }))
      .sort((a, b) => b.displacement - a.displacement),
    incomeGroups: INCOME_GROUPS.map((incomeGroup) => {
      const inGroup = (c: number) => countries[c].incomeGroup === incomeGroup;
      const cells = rows({ country: inGroup, quarter: inLatest });
      const totalDisplaced = sum(displaced, cells);
      return {
        incomeGroup,
        countries: countries.filter((_, c) => inGroup(c)).length,
        displacement: mean(displacement, cells),
        replacementRate:
          totalDisplaced === 0
            ? null
            : round((replacement.scale * sum(newRoles, cells)) / totalDisplaced, 1),
      };
    }).filter((group) => group.countries > 0),
    women: sectors.map((sector, s) => {
      const cells = rows({ sector: s });
      return {
        sector,
        workforce: mean(womenWorkforce, cells),
        displaced: mean(womenDisplaced, cells),
      };
    }),
  };
}
