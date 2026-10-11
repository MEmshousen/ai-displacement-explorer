import { describe, expect, it } from 'vitest';
import { METRICS, NO_VALUE, formatMetric, getMetric } from './metrics';
import {
  MAX_PINNED,
  applyPatch,
  defaultSelection,
  parseSelection,
  quarterLabel,
  sectorSlug,
  serialiseSelection,
  type Selection,
  type ValidChoices,
} from './selection';

const choices: ValidChoices = {
  sectors: ['Finance & Banking', 'Retail & E-Commerce', 'Technology & Software'],
  quarters: ['2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2'],
  countries: ['USA', 'DEU', 'JPN', 'IND', 'BRA'],
};

const defaults: Selection = {
  metric: 'displacement',
  sector: null,
  quarter: '2026-Q2',
  country: null,
  pinned: [],
};

const full: Selection = {
  metric: 'net-change',
  sector: 'Finance & Banking',
  quarter: '2025-Q4',
  country: 'USA',
  pinned: ['DEU', 'JPN'],
};

describe('metrics', () => {
  it('defines the six metrics with unique ids', () => {
    expect(METRICS.map((metric) => metric.label)).toEqual([
      'Displacement',
      'Net change',
      'Replacement rate',
      'AI adoption index',
      'AI skills wage premium',
      "Women's share of displaced roles",
    ]);
    expect(new Set(METRICS.map((metric) => metric.id)).size).toBe(6);
  });

  it('derives Replacement rate as new roles created per 100 roles displaced', () => {
    expect(getMetric('replacement-rate').source).toEqual({
      kind: 'ratio',
      numerator: 'pct_sector_workforce_new_roles_created',
      denominator: 'pct_sector_workforce_displaced',
      scale: 100,
    });
  });
});

describe('defaults', () => {
  it('is Displacement, all Sectors, the latest quarter, no country, nothing pinned', () => {
    expect(defaultSelection(choices)).toEqual(defaults);
  });

  it('finds the latest quarter whatever order the quarters arrive in', () => {
    const shuffled = { ...choices, quarters: ['2026-Q1', '2026-Q2', '2025-Q4'] };
    expect(defaultSelection(shuffled).quarter).toBe('2026-Q2');
  });

  it('parses an empty query string to the defaults', () => {
    expect(parseSelection('', choices)).toEqual(defaults);
    expect(parseSelection('?', choices)).toEqual(defaults);
  });

  it('serialises the defaults to nothing', () => {
    expect(serialiseSelection(defaults, choices)).toBe('');
  });
});

describe('parsing', () => {
  it('reads every field', () => {
    const search = '?metric=net-change&sector=finance-banking&quarter=2025-Q4&country=USA&pin=DEU&pin=JPN';
    expect(parseSelection(search, choices)).toEqual(full);
  });

  it('accepts a query string without its leading "?"', () => {
    expect(parseSelection('country=IND', choices).country).toBe('IND');
  });

  it('ignores letter case', () => {
    const search = '?metric=Net-Change&sector=Finance-Banking&quarter=2025-q4&country=usa&pin=deu';
    expect(parseSelection(search, choices)).toEqual({ ...full, pinned: ['DEU'] });
  });

  it('ignores parameters it does not own', () => {
    expect(parseSelection('?utm_source=cv&country=BRA', choices)).toEqual({
      ...defaults,
      country: 'BRA',
    });
  });
});

describe('invalid input', () => {
  it.each([
    ['metric', '?metric=job-loss'],
    ['sector', '?sector=agriculture'],
    ['quarter', '?quarter=2031-Q1'],
    ['quarter', '?quarter=soon'],
    ['country', '?country=XXX'],
    ['country', '?country='],
    ['pin', '?pin=XXX&pin='],
  ])('falls back to the default for an unknown %s (%s)', (_field, search) => {
    expect(parseSelection(search, choices)).toEqual(defaults);
  });

  it('keeps the valid fields when another field is invalid', () => {
    expect(parseSelection('?metric=nope&country=JPN&quarter=1999-Q1', choices)).toEqual({
      ...defaults,
      country: 'JPN',
    });
  });

  it.each(['?%E0%A4%A', '?metric=%', '?&&==&metric', '?sector[]=x&pin[0]=USA', '?__proto__=1'])(
    'does not throw on %s',
    (search) => {
      expect(parseSelection(search, choices)).toEqual(defaults);
    },
  );

  it('uses the first value when a single-valued field is repeated', () => {
    expect(parseSelection('?country=DEU&country=JPN', choices).country).toBe('DEU');
  });
});

describe('serialising', () => {
  it('writes every non-default field in a fixed order', () => {
    expect(serialiseSelection(full, choices)).toBe(
      '?metric=net-change&sector=finance-banking&quarter=2025-Q4&country=USA&pin=DEU&pin=JPN',
    );
  });

  it('leaves each default field out', () => {
    expect(serialiseSelection({ ...defaults, country: 'IND' }, choices)).toBe('?country=IND');
    expect(serialiseSelection({ ...full, metric: 'displacement' }, choices)).not.toContain('metric');
    expect(serialiseSelection({ ...full, quarter: '2026-Q2' }, choices)).not.toContain('quarter');
  });

  it('carries over parameters it does not own and replaces its own', () => {
    expect(serialiseSelection({ ...defaults, country: 'IND' }, choices, '?utm_source=cv&country=USA&pin=DEU')).toBe(
      '?utm_source=cv&country=IND',
    );
    expect(serialiseSelection(defaults, choices, '?country=USA')).toBe('');
  });

  it('gives each Sector a distinct slug with nothing a URL would escape', () => {
    expect(sectorSlug('Retail & E-Commerce')).toBe('retail-e-commerce');
    const slugs = choices.sectors.map(sectorSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(encodeURIComponent(slug)).toBe(slug);
  });
});

describe('round-tripping', () => {
  const selections: Selection[] = [
    defaults,
    full,
    { ...defaults, pinned: ['BRA', 'USA', 'IND'] },
    { ...defaults, sector: 'Retail & E-Commerce' },
    { ...defaults, metric: 'women-share', quarter: '2025-Q3' },
    // A country may be both the chosen country and pinned.
    { ...defaults, country: 'USA', pinned: ['USA'] },
  ];

  it.each(selections)('Selection -> URL -> Selection is unchanged: %o', (selection) => {
    expect(parseSelection(serialiseSelection(selection, choices), choices)).toEqual(selection);
  });

  it('URL -> Selection -> URL is unchanged for a canonical URL', () => {
    const search = '?metric=wage-premium&sector=technology-software&country=DEU&pin=JPN';
    expect(serialiseSelection(parseSelection(search, choices), choices)).toBe(search);
  });

  it('round-trips every metric and every Sector', () => {
    for (const { id } of METRICS) {
      const selection = { ...defaults, metric: id };
      expect(parseSelection(serialiseSelection(selection, choices), choices)).toEqual(selection);
    }
    for (const sector of choices.sectors) {
      const selection = { ...defaults, sector };
      expect(parseSelection(serialiseSelection(selection, choices), choices)).toEqual(selection);
    }
  });
});

describe('the pin limit', () => {
  it(`keeps the first ${MAX_PINNED} pinned countries from a URL`, () => {
    expect(parseSelection('?pin=USA&pin=DEU&pin=JPN&pin=IND', choices).pinned).toEqual([
      'USA',
      'DEU',
      'JPN',
    ]);
  });

  it('drops duplicates and unknown countries before counting', () => {
    expect(parseSelection('?pin=USA&pin=usa&pin=XXX&pin=DEU&pin=JPN&pin=IND', choices).pinned).toEqual([
      'USA',
      'DEU',
      'JPN',
    ]);
  });

  it('applies the same rules to a patch', () => {
    const patched = applyPatch(defaults, { pinned: ['IND', 'IND', 'ZZZ', 'BRA', 'USA', 'DEU'] }, choices);
    expect(patched.pinned).toEqual(['IND', 'BRA', 'USA']);
  });
});

describe('applying a patch', () => {
  it('changes only the fields in the patch', () => {
    expect(applyPatch(full, { country: 'IND' }, choices)).toEqual({ ...full, country: 'IND' });
  });

  it('clears the Sector and country with null', () => {
    expect(applyPatch(full, { sector: null, country: null }, choices)).toEqual({
      ...full,
      sector: null,
      country: null,
    });
  });

  it('keeps the current value of a field the patch gets wrong', () => {
    const patch = { metric: 'nope', sector: 'Farming', quarter: null, country: 'XXX' };
    expect(applyPatch(full, patch, choices)).toEqual(full);
  });
});

describe('units and number formats', () => {
  it('gives every metric a unit', () => {
    for (const metric of METRICS) expect(metric.unit).not.toBe('');
    expect(getMetric('replacement-rate').unit).toBe('new roles per 100 displaced');
  });

  it('writes shares as percentages to one place', () => {
    expect(formatMetric('displacement', 0.0406)).toBe('4.1%');
    expect(formatMetric('wage-premium', 0.311)).toBe('31.1%');
    expect(formatMetric('women-share', 0.95)).toBe('95.0%');
  });

  it('signs Net change, with a true minus sign rather than a hyphen', () => {
    expect(formatMetric('net-change', -0.0058)).toBe('−0.6%');
    expect(formatMetric('net-change', 0.012)).toBe('+1.2%');
    expect(formatMetric('net-change', 0)).toBe('0.0%');
    expect(formatMetric('net-change', -0.0058)).not.toContain('-');
    // Unsigned metrics too: the Sector bars can chart a falling metric.
    expect(formatMetric('displacement', -0.0327)).toBe('−3.3%');
  });

  it('writes Replacement rate as a whole number and the AI adoption index to two places', () => {
    expect(formatMetric('replacement-rate', 74.96)).toBe('75');
    expect(formatMetric('ai-adoption', 0.83)).toBe('0.83');
  });

  it('writes "No value" where there is none', () => {
    expect(formatMetric('replacement-rate', null)).toBe(NO_VALUE);
    expect(NO_VALUE).toBe('No value');
  });
});

describe('quarterLabel', () => {
  it('writes a quarter for a person to read, without the hyphen', () => {
    expect(quarterLabel('2026-Q2')).toBe('2026 Q2');
    expect(quarterLabel('2020-Q1')).toBe('2020 Q1');
  });
});
