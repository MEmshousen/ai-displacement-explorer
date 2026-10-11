import { describe, expect, it } from 'vitest';
import { METRICS, type Selection } from '../../selection';
import {
  countriesByRegion,
  metricWord,
  pinning,
  quartersByYear,
  sentence,
  sentenceText,
  withPin,
  withoutPin,
} from './wording';

const base: Selection = {
  metric: 'displacement',
  sector: null,
  quarter: '2026-Q2',
  country: null,
  pinned: [],
};

const text = (selection: Selection, countryName?: string) => sentenceText(sentence(selection, countryName));

describe('sentence', () => {
  it('reads naturally with a country selected', () => {
    expect(text({ ...base, country: 'DEU' }, 'Germany')).toBe(
      'Showing Displacement in all Sectors for 2026 Q2, with Germany selected.',
    );
  });

  it('reads naturally with no country and one Sector', () => {
    expect(text({ ...base, sector: 'Finance & Banking', quarter: '2021-Q3' })).toBe(
      'Showing Displacement in Finance & Banking for 2021 Q3, with no country selected.',
    );
  });

  it('reads naturally for each of the six metrics', () => {
    expect(METRICS.map(({ id }) => text({ ...base, metric: id }))).toEqual([
      'Showing Displacement in all Sectors for 2026 Q2, with no country selected.',
      'Showing Net change in all Sectors for 2026 Q2, with no country selected.',
      'Showing the Replacement rate in all Sectors for 2026 Q2, with no country selected.',
      'Showing the AI adoption index in all Sectors for 2026 Q2, with no country selected.',
      'Showing the AI skills wage premium in all Sectors for 2026 Q2, with no country selected.',
      "Showing women's share of displaced roles in all Sectors for 2026 Q2, with no country selected.",
    ]);
  });

  it('words each metric as its label, whatever the capitals', () => {
    for (const { id, label } of METRICS) expect(metricWord(id).toLowerCase()).toBe(label.toLowerCase());
  });

  it('falls back to the country code when it is given no name', () => {
    expect(sentence({ ...base, country: 'DEU' }).words.country).toBe('DEU');
  });
});

describe('quartersByYear', () => {
  it('groups quarters under their year, keeping their order', () => {
    expect(quartersByYear(['2025-Q3', '2025-Q4', '2026-Q1'])).toEqual([
      {
        label: '2025',
        choices: [
          { value: '2025-Q3', label: '2025 Q3' },
          { value: '2025-Q4', label: '2025 Q4' },
        ],
      },
      { label: '2026', choices: [{ value: '2026-Q1', label: '2026 Q1' }] },
    ]);
  });
});

describe('countriesByRegion', () => {
  it('sorts the regions, and the countries in each, by name', () => {
    const groups = countriesByRegion([
      { iso3: 'DEU', name: 'Germany', region: 'Europe' },
      { iso3: 'NGA', name: 'Nigeria', region: 'Africa' },
      { iso3: 'AUT', name: 'Austria', region: 'Europe' },
    ]);
    expect(groups).toEqual([
      { label: 'Africa', choices: [{ value: 'NGA', label: 'Nigeria' }] },
      {
        label: 'Europe',
        choices: [
          { value: 'AUT', label: 'Austria' },
          { value: 'DEU', label: 'Germany' },
        ],
      },
    ]);
  });
});

describe('pinning', () => {
  it('says how many countries are pinned', () => {
    expect(pinning(base).count).toBe('None pinned');
    expect(pinning({ ...base, pinned: ['DEU', 'JPN'] }).count).toBe('2 of 3 pinned');
  });

  it('is full at three', () => {
    expect(pinning({ ...base, pinned: ['DEU', 'JPN'] }).full).toBe(false);
    expect(pinning({ ...base, pinned: ['DEU', 'JPN', 'BRA'] }).full).toBe(true);
  });

  it('offers the selected country only when it can be pinned', () => {
    expect(pinning({ ...base, country: 'DEU' }).selectedToPin).toBe('DEU');
    expect(pinning(base).selectedToPin).toBeNull();
    expect(pinning({ ...base, country: 'DEU', pinned: ['DEU'] }).selectedToPin).toBeNull();
    expect(pinning({ ...base, country: 'DEU', pinned: ['USA', 'JPN', 'BRA'] }).selectedToPin).toBeNull();
  });
});

describe('withPin and withoutPin', () => {
  it('adds a pin at the end', () => {
    expect(withPin(['DEU'], 'JPN')).toEqual(['DEU', 'JPN']);
  });

  it('leaves the pins alone for a repeat or a fourth', () => {
    expect(withPin(['DEU'], 'DEU')).toEqual(['DEU']);
    expect(withPin(['DEU', 'JPN', 'BRA'], 'USA')).toEqual(['DEU', 'JPN', 'BRA']);
  });

  it('removes a pin', () => {
    expect(withoutPin(['DEU', 'JPN'], 'DEU')).toEqual(['JPN']);
  });
});
