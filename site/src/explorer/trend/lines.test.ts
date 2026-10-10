import { describe, expect, it } from 'vitest';
import type { Explorer } from '../../data/explorer';
import type { Selection } from '../../selection';
import {
  endLabel,
  onlyGlobalAverage,
  readoutText,
  trendLines,
  trendSubtitle,
  trendSummary,
  trendTitle,
  withoutPinned,
} from './lines';

const NAMES: Record<string, string> = { DEU: 'Germany', BRA: 'Brazil', JPN: 'Japan', NGA: 'Nigeria' };
const quarters = ['2020-Q1', '2020-Q2', '2020-Q3'];

/** Each country's line is its position in NAMES; the global average is all zeros. */
const explorer: Pick<Explorer, 'overTime' | 'country'> = {
  country: (iso3) =>
    NAMES[iso3] ? { iso3, name: NAMES[iso3], region: '', incomeGroup: '' } : undefined,
  overTime: (_selection, country) => {
    const base = country === null ? 0 : Object.keys(NAMES).indexOf(country) + 1;
    return quarters.map((_, index) => base / 100 + index / 1000);
  },
};

const selection = (patch: Partial<Selection> = {}): Selection => ({
  metric: 'displacement',
  sector: null,
  quarter: '2020-Q3',
  country: null,
  pinned: [],
  ...patch,
});

describe('trendLines', () => {
  it('draws only the global average for an empty Selection', () => {
    const lines = trendLines(selection(), explorer);
    expect(lines.map((line) => line.key)).toEqual(['global']);
    expect(onlyGlobalAverage(lines)).toBe(true);
  });

  it('puts the selected country first, then the pinned ones, then the global average', () => {
    const lines = trendLines(selection({ country: 'DEU', pinned: ['BRA', 'JPN'] }), explorer);
    expect(lines.map((line) => [line.key, line.role, line.slot])).toEqual([
      ['DEU', 'selected', null],
      ['BRA', 'pinned', 0],
      ['JPN', 'pinned', 1],
      ['global', 'global', null],
    ]);
    expect(lines[0].name).toBe('Germany');
    expect(lines[0].values).toEqual(explorer.overTime(selection(), 'DEU'));
    expect(onlyGlobalAverage(lines)).toBe(false);
  });

  it('draws a country that is both selected and pinned once, as the selected one', () => {
    const lines = trendLines(selection({ country: 'BRA', pinned: ['DEU', 'BRA', 'JPN'] }), explorer);
    expect(lines.map((line) => line.key)).toEqual(['BRA', 'DEU', 'JPN', 'global']);
    expect(lines[0]).toMatchObject({ role: 'selected', pinned: true, slot: 1 });
    // The other pinned countries keep their own slots, so their stroke styles do not change.
    expect(lines.slice(1, 3).map((line) => line.slot)).toEqual([0, 2]);
  });

  it('draws at most five lines', () => {
    const lines = trendLines(selection({ country: 'NGA', pinned: ['DEU', 'BRA', 'JPN'] }), explorer);
    expect(lines).toHaveLength(5);
  });
});

describe('withoutPinned', () => {
  it('leaves the pinned countries out and keeps the rest of the Selection', () => {
    const arrived = selection({ country: 'DEU', sector: 'Finance & Banking', pinned: ['JPN', 'BRA'] });
    expect(withoutPinned(arrived)).toEqual({ ...arrived, pinned: [] });
    // The shared Selection is not touched, so its address keeps the pins.
    expect(arrived.pinned).toEqual(['JPN', 'BRA']);
  });

  it('gives back the same Selection when nothing is pinned', () => {
    const plain = selection({ country: 'DEU' });
    expect(withoutPinned(plain)).toBe(plain);
  });

  it('draws and names a phone chart as if nothing were pinned', () => {
    const lines = trendLines(withoutPinned(selection({ country: 'DEU', pinned: ['DEU', 'JPN'] })), explorer);
    expect(lines.map((line) => line.key)).toEqual(['DEU', 'global']);
    expect(lines[0]).toMatchObject({ pinned: false, slot: null });
    expect(trendTitle(lines)).toBe('Germany against the global average');

    const onlyPins = trendLines(withoutPinned(selection({ pinned: ['JPN'] })), explorer);
    expect(onlyGlobalAverage(onlyPins)).toBe(true);
    expect(trendTitle(onlyPins)).toBe('The global average over time');
  });
});

describe('endLabel', () => {
  it('shortens only the global average, and only on a narrow chart', () => {
    const [germany, average] = trendLines(selection({ country: 'DEU' }), explorer);
    expect(endLabel(average, false)).toBe('Global average');
    expect(endLabel(average, true)).toBe('Global');
    expect(endLabel(germany, true)).toBe('Germany');
  });
});

describe('trendTitle', () => {
  const title = (patch: Partial<Selection>) => trendTitle(trendLines(selection(patch), explorer));

  it('names what is charted', () => {
    expect(title({})).toBe('The global average over time');
    expect(title({ country: 'DEU' })).toBe('Germany against the global average');
    expect(title({ country: 'DEU', pinned: ['BRA'] })).toBe(
      'Germany against the global average and one pinned country',
    );
    expect(title({ country: 'DEU', pinned: ['BRA', 'JPN', 'NGA'] })).toBe(
      'Germany against the global average and three pinned countries',
    );
  });

  it('does not count the selected country among the pinned ones', () => {
    expect(title({ country: 'DEU', pinned: ['DEU'] })).toBe('Germany against the global average');
  });

  it('names the pinned countries when no country is selected', () => {
    expect(title({ pinned: ['BRA'] })).toBe('Brazil against the global average');
    expect(title({ pinned: ['BRA', 'JPN', 'NGA'] })).toBe(
      'Brazil, Japan and Nigeria against the global average',
    );
  });
});

describe('trendSubtitle', () => {
  it('gives the metric, the Sector and the range of quarters', () => {
    expect(trendSubtitle(selection(), quarters)).toBe('Displacement, all Sectors, 2020-Q1 to 2020-Q3');
    expect(trendSubtitle(selection({ metric: 'net-change', sector: 'Finance & Banking' }), quarters)).toBe(
      'Net change, Finance & Banking, 2020-Q1 to 2020-Q3',
    );
  });
});

describe('trendSummary', () => {
  it('says where each line starts and ends', () => {
    const lines = trendLines(selection({ country: 'DEU' }), explorer);
    expect(trendSummary(selection(), lines, quarters)).toBe(
      'Line chart. Displacement, all Sectors, 2020-Q1 to 2020-Q3, in % of the Sector workforce. ' +
        'Germany: 1.0% in 2020-Q1, 1.2% in 2020-Q3. Global average: 0.0% in 2020-Q1, 0.2% in 2020-Q3.',
    );
  });

  it('skips "no value" quarters and says when a line has none at all', () => {
    const base = trendLines(selection({ metric: 'replacement-rate', country: 'DEU' }), explorer);
    const lines = [
      { ...base[0], values: [null, 40, null] },
      { ...base[1], values: [null, null, null] },
    ];
    const summary = trendSummary(selection({ metric: 'replacement-rate' }), lines, quarters);
    expect(summary).toContain('Germany: 40 in 2020-Q2.');
    expect(summary).toContain('Global average: no value in any quarter.');
  });
});

describe('readoutText', () => {
  it("reads every line's value at one quarter", () => {
    const lines = trendLines(selection({ country: 'DEU' }), explorer);
    expect(readoutText(selection(), lines, quarters, 1)).toBe('2020-Q2: Germany 1.1%, Global average 0.1%');
  });
});
