import { describe, expect, it } from 'vitest';
import type { Selection } from '../selection';
import { createExplorer, explorerDataUrl, fetchExplorer, type ExplorerData } from './explorer';

const DISPLACED = 'pct_sector_workforce_displaced';
const NEW_ROLES = 'pct_sector_workforce_new_roles_created';

// Two countries x two Sectors x two quarters. Cell order: country, then Sector, then quarter.
//                    AAA Fin Q1,Q2 | AAA Ret Q1,Q2 | BBB Fin Q1,Q2 | BBB Ret Q1,Q2
const displaced = [0.1, 0.2, 0.3, 0.4, 0.02, 0.04, 0.06, 0];
const newRoles = [0.05, 0.1, 0.03, 0.2, 0.02, 0.01, 0, 0];

const data: ExplorerData = {
  sectors: ['Finance', 'Retail'],
  quarters: ['2025-Q1', '2025-Q2'],
  countries: ['AAA', 'BBB'],
  countryNames: ['Aland', 'Bland'],
  regions: ['North', 'South'],
  incomeGroups: ['High Income', 'Low Income'],
  columns: {
    [DISPLACED]: displaced,
    [NEW_ROLES]: newRoles,
    net_workforce_change_pct: displaced.map((value, cell) => newRoles[cell] - value),
    ai_adoption_index: [0.5, 0.6, 0.7, 0.8, 0.1, 0.2, 0.3, 0.4],
    ai_skill_wage_premium_pct: [0.1, 0.1, 0.1, 0.1, 0.2, 0.2, 0.2, 0.2],
    pct_displaced_roles_female: [0.4, 0.4, 0.6, 0.6, 0.5, 0.5, 0.5, 0.5],
  },
};

const explorer = createExplorer(data);

const selection: Selection = {
  metric: 'displacement',
  sector: null,
  quarter: '2025-Q1',
  country: null,
  pinned: [],
};

describe('value', () => {
  it('reads a single cell', () => {
    expect(explorer.value('displacement', { country: 'AAA', sector: 'Retail', quarter: '2025-Q2' })).toBe(0.4);
    expect(explorer.value('ai-adoption', { country: 'BBB', sector: 'Finance', quarter: '2025-Q1' })).toBe(0.1);
  });

  it('averages a country across all Sectors', () => {
    expect(explorer.value('displacement', { country: 'AAA', sector: null, quarter: '2025-Q1' })).toBeCloseTo(0.2);
  });

  it('averages one Sector across every country for the global average', () => {
    expect(explorer.value('displacement', { country: null, sector: 'Finance', quarter: '2025-Q1' })).toBeCloseTo(0.06);
  });

  it('averages every row of the quarter for the global average of all Sectors', () => {
    expect(explorer.value('displacement', { country: null, sector: null, quarter: '2025-Q1' })).toBeCloseTo(0.12);
    expect(explorer.value('net-change', { country: null, sector: null, quarter: '2025-Q1' })).toBeCloseTo(-0.095);
  });

  it('gives Replacement rate as 100 x new roles / displaced for one cell', () => {
    expect(explorer.value('replacement-rate', { country: 'AAA', sector: 'Finance', quarter: '2025-Q1' })).toBeCloseTo(50);
  });

  it('sums before dividing for Replacement rate, never averaging per-row rates', () => {
    // AAA in Q1: (0.05 + 0.03) / (0.1 + 0.3) = 20 per 100. The mean of 50 and 10 would be 30.
    expect(explorer.value('replacement-rate', { country: 'AAA', sector: null, quarter: '2025-Q1' })).toBeCloseTo(20);
    // Every row in Q1: 0.1 / 0.48.
    expect(explorer.value('replacement-rate', { country: null, sector: null, quarter: '2025-Q1' })).toBeCloseTo(100 * (0.1 / 0.48));
  });

  it('gives no value for Replacement rate when nothing was displaced', () => {
    expect(explorer.value('replacement-rate', { country: 'BBB', sector: 'Retail', quarter: '2025-Q2' })).toBeNull();
  });

  it('still gives a Replacement rate when only some rows in view have nothing displaced', () => {
    // BBB in Q2: 0.01 / (0.04 + 0).
    expect(explorer.value('replacement-rate', { country: 'BBB', sector: null, quarter: '2025-Q2' })).toBeCloseTo(25);
  });

  it('refuses a country, Sector or quarter the dataset does not have', () => {
    const scope = { country: 'AAA', sector: 'Finance', quarter: '2025-Q1' };
    expect(() => explorer.value('displacement', { ...scope, country: 'ZZZ' })).toThrow('The dataset has no country "ZZZ".');
    expect(() => explorer.value('displacement', { ...scope, sector: 'Mining' })).toThrow('The dataset has no Sector "Mining".');
    expect(() => explorer.value('displacement', { ...scope, quarter: '1999-Q1' })).toThrow(RangeError);
  });
});

describe('the three views', () => {
  it('byCountry gives the world map one value per country, taking a whole Selection', () => {
    expect(explorer.byCountry({ ...selection, sector: 'Retail', quarter: '2025-Q2' })).toEqual([
      { country: explorer.countries[0], value: 0.4 },
      { country: explorer.countries[1], value: 0 },
    ]);
  });

  it('byCountry averages all Sectors when the Selection has none', () => {
    const values = explorer.byCountry(selection).map((entry) => entry.value);
    expect(values[0]).toBeCloseTo(0.2);
    expect(values[1]).toBeCloseTo(0.04);
  });

  it('overTime gives the trend chart one value per quarter for a country', () => {
    expect(explorer.overTime({ metric: 'displacement', sector: 'Finance' }, 'BBB')).toEqual([0.02, 0.04]);
  });

  it('overTime gives the global average for no country, with gaps where there is no value', () => {
    const average = explorer.overTime(selection, null);
    expect(average[0]).toBeCloseTo(0.12);
    expect(average[1]).toBeCloseTo(0.16);

    expect(explorer.overTime({ metric: 'replacement-rate', sector: 'Retail' }, 'BBB')).toEqual([0, null]);
  });

  it('bySector gives the Sector bars one value per Sector for the selected country', () => {
    expect(explorer.bySector({ ...selection, country: 'AAA' })).toEqual([
      { sector: 'Finance', value: 0.1 },
      { sector: 'Retail', value: 0.3 },
    ]);
  });

  it('bySector gives the global average when no country is selected', () => {
    const values = explorer.bySector({ ...selection, metric: 'replacement-rate' }).map((entry) => entry.value);
    expect(values[0]).toBeCloseTo(100 * (0.07 / 0.12));
    expect(values[1]).toBeCloseTo(100 * (0.03 / 0.36));
  });
});

describe('countries and choices', () => {
  it('offers the lists a Selection is checked against', () => {
    expect(explorer.choices).toEqual({
      sectors: ['Finance', 'Retail'],
      quarters: ['2025-Q1', '2025-Q2'],
      countries: ['AAA', 'BBB'],
    });
  });

  it('looks a country up by ISO3 code', () => {
    expect(explorer.country('BBB')).toEqual({
      iso3: 'BBB',
      name: 'Bland',
      region: 'South',
      incomeGroup: 'Low Income',
    });
    expect(explorer.country('ZZZ')).toBeUndefined();
  });

  it('refuses data with a short or absent column', () => {
    const short = { ...data, columns: { ...data.columns, [DISPLACED]: [0.1] } };
    expect(() => createExplorer(short)).toThrow(`The Explorer data has no complete "${DISPLACED}" column.`);
  });
});

describe('fetching', () => {
  it('puts the file under the base path, with or without a trailing slash', () => {
    expect(explorerDataUrl('/')).toBe('/data/explorer.json');
    expect(explorerDataUrl('/AI_Displacement_Project')).toBe('/AI_Displacement_Project/data/explorer.json');
    expect(explorerDataUrl('/AI_Displacement_Project/')).toBe('/AI_Displacement_Project/data/explorer.json');
  });

  it('defaults to the base path the site was built with', () => {
    expect(explorerDataUrl()).toBe(explorerDataUrl(import.meta.env.BASE_URL));
  });

  it('fetches the file and wraps it in its lookups', async () => {
    const asked: string[] = [];
    const fetcher = (async (url: string) => {
      asked.push(url);
      return new Response(JSON.stringify(data));
    }) as typeof fetch;

    const fetched = await fetchExplorer('/base/data/explorer.json', fetcher);
    expect(asked).toEqual(['/base/data/explorer.json']);
    expect(fetched.value('displacement', { country: 'AAA', sector: 'Finance', quarter: '2025-Q1' })).toBe(0.1);
  });

  it('fails clearly when the file cannot be fetched', async () => {
    const fetcher = (async () => new Response('', { status: 404 })) as typeof fetch;
    await expect(fetchExplorer('/data/explorer.json', fetcher)).rejects.toThrow(
      'Could not load the Explorer data (404 from /data/explorer.json).',
    );
  });
});
