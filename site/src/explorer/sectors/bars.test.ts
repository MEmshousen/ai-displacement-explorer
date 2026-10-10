import { describe, expect, it } from 'vitest';
import { getMetric } from '../../selection';
import { barScale, fixedDomain, rankSectors, viewHint, viewSubtitle, viewTitle } from './bars';

describe('rankSectors', () => {
  it('ranks from the highest value to the lowest', () => {
    const values = [
      { sector: 'Finance', value: 0.05 },
      { sector: 'Retail', value: 0.12 },
      { sector: 'Energy', value: 0.08 },
    ];
    expect(rankSectors(values)).toEqual(['Retail', 'Energy', 'Finance']);
  });

  it('ranks negative values the same way, the largest loss last', () => {
    const values = [
      { sector: 'Finance', value: -0.06 },
      { sector: 'Retail', value: 0.01 },
      { sector: 'Energy', value: -0.02 },
    ];
    expect(rankSectors(values)).toEqual(['Retail', 'Energy', 'Finance']);
  });

  it('puts Sectors with no value last', () => {
    const values = [
      { sector: 'Finance', value: null },
      { sector: 'Retail', value: 40 },
      { sector: 'Energy', value: 0 },
    ];
    expect(rankSectors(values)).toEqual(['Retail', 'Energy', 'Finance']);
  });

  it('keeps tied Sectors in the given order when there is no earlier ranking', () => {
    const values = [
      { sector: 'Finance', value: 0.1 },
      { sector: 'Retail', value: 0.1 },
      { sector: 'Energy', value: 0.2 },
    ];
    expect(rankSectors(values)).toEqual(['Energy', 'Finance', 'Retail']);
  });

  it('keeps tied Sectors in the order of the earlier ranking', () => {
    const values = [
      { sector: 'Finance', value: 0.1 },
      { sector: 'Retail', value: 0.1 },
      { sector: 'Energy', value: null },
      { sector: 'Media', value: null },
    ];
    const previous = ['Media', 'Retail', 'Energy', 'Finance'];
    expect(rankSectors(values, previous)).toEqual(['Retail', 'Finance', 'Media', 'Energy']);
  });

  it('does not change the list it is given', () => {
    const values = [
      { sector: 'Finance', value: 1 },
      { sector: 'Retail', value: 2 },
    ];
    rankSectors(values);
    expect(values.map(({ sector }) => sector)).toEqual(['Finance', 'Retail']);
  });
});

describe('fixedDomain', () => {
  const quarter = (...values: (number | null)[]) =>
    values.map((value, index) => ({ sector: `Sector ${index}`, value }));

  it('runs from zero to the highest value in any quarter', () => {
    expect(fixedDomain([quarter(0.02, 0.05), quarter(0.14, 0.03)])).toEqual([0, 0.14]);
  });

  it('runs from the lowest value up to zero when every value is negative', () => {
    expect(fixedDomain([quarter(-0.01, -0.09), quarter(-0.03, -0.02)])).toEqual([-0.09, 0]);
  });

  it('covers both sides of zero when the values do', () => {
    expect(fixedDomain([quarter(-0.04, 0.01), quarter(0.02, null)])).toEqual([-0.04, 0.02]);
  });

  it('ignores "no value" and falls back to 0 to 1 when there is nothing to scale', () => {
    expect(fixedDomain([quarter(null, null)])).toEqual([0, 1]);
    expect(fixedDomain([quarter(0, 0)])).toEqual([0, 1]);
    expect(fixedDomain([])).toEqual([0, 1]);
  });
});

describe('barScale', () => {
  it('draws positive values rightwards from a zero line at the left', () => {
    const scale = barScale([0, 0.2]);
    expect(scale.zero).toBe(0);
    expect(scale.bar(0.05)).toEqual({ start: 0, length: 0.25 });
    expect(scale.bar(0.2)).toEqual({ start: 0, length: 1 });
  });

  it('draws negative values leftwards from a zero line at the right', () => {
    const scale = barScale([-0.08, 0]);
    expect(scale.zero).toBe(1);
    expect(scale.bar(-0.02)).toEqual({ start: 0.75, length: 0.25 });
    expect(scale.bar(-0.08)).toEqual({ start: 0, length: 1 });
  });

  it('draws either way from a zero line inside the track', () => {
    const scale = barScale([-0.25, 0.75]);
    expect(scale.zero).toBe(0.25);
    expect(scale.bar(0.375)).toEqual({ start: 0.25, length: 0.375 });
    expect(scale.bar(-0.125)).toEqual({ start: 0.125, length: 0.125 });
    expect(scale.bar(0)).toEqual({ start: 0.25, length: 0 });
  });

  it('gives no bar for "no value"', () => {
    expect(barScale([0, 100]).bar(null)).toBeNull();
    expect(barScale([0, 100]).bar(Number.NaN)).toBeNull();
  });

  it('never draws past the ends of the track', () => {
    expect(barScale([0, 0.2]).bar(0.5)).toEqual({ start: 0, length: 1 });
  });
});

describe('the pane text', () => {
  it('titles the pane with the country and quarter', () => {
    expect(viewTitle('Germany', '2026-Q2')).toBe('Sectors in Germany, 2026-Q2');
  });

  it('names the global average when no country is selected', () => {
    expect(viewTitle(null, '2024-Q3')).toBe('Sectors, global average, 2024-Q3');
  });

  it('says what the metric counts and which way the ranking runs', () => {
    expect(viewSubtitle(getMetric('displacement'))).toBe(
      'Displacement (% of the Sector workforce), highest first.',
    );
    expect(viewSubtitle(getMetric('replacement-rate'))).toBe(
      'Replacement rate (new roles per 100 displaced), highest first.',
    );
  });

  it('says how to choose a Sector and how to return to all Sectors', () => {
    expect(viewHint(null)).toBe('Choose a bar to see that Sector across the Explorer.');
    expect(viewHint('Finance & Banking')).toBe('Choose the highlighted bar again for all Sectors.');
  });
});
