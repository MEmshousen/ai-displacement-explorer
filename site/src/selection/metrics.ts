// The six metrics a Selection can chart, and where each one comes from in the dataset
// (ai_workforce_displacement_global_2020_2026.csv at the repo root).

export type MetricSource =
  /** Read straight from one dataset column. */
  | { readonly kind: 'column'; readonly column: string }
  /**
   * scale * sum(numerator) / sum(denominator), summed over the rows in view before dividing.
   * Averaging per-row ratios instead would give a different, wrong answer.
   */
  | {
      readonly kind: 'ratio';
      readonly numerator: string;
      readonly denominator: string;
      readonly scale: number;
    };

/** How a metric's values are stored and how they are written out. */
export interface MetricFormat {
  /**
   * 'percent': stored as a decimal fraction, shown times 100 with a % sign (0.0406 as "4.1%").
   * 'number': shown as stored.
   */
  readonly style: 'percent' | 'number';
  /** Decimal places shown. */
  readonly digits: number;
  /** Whether a plus sign is shown on values above zero. */
  readonly signed: boolean;
}

const percent: MetricFormat = { style: 'percent', digits: 1, signed: false };

export const METRICS = [
  {
    id: 'displacement',
    label: 'Displacement',
    source: { kind: 'column', column: 'pct_sector_workforce_displaced' },
    unit: '% of the Sector workforce',
    format: percent,
  },
  {
    id: 'net-change',
    label: 'Net change',
    source: { kind: 'column', column: 'net_workforce_change_pct' },
    unit: '% of the Sector workforce',
    format: { ...percent, signed: true },
  },
  {
    // New roles created per 100 roles displaced.
    id: 'replacement-rate',
    label: 'Replacement rate',
    source: {
      kind: 'ratio',
      numerator: 'pct_sector_workforce_new_roles_created',
      denominator: 'pct_sector_workforce_displaced',
      scale: 100,
    },
    unit: 'new roles per 100 displaced',
    format: { style: 'number', digits: 0, signed: false },
  },
  {
    id: 'ai-adoption',
    label: 'AI adoption index',
    source: { kind: 'column', column: 'ai_adoption_index' },
    unit: 'index from 0 to 1',
    format: { style: 'number', digits: 2, signed: false },
  },
  {
    id: 'wage-premium',
    label: 'AI skills wage premium',
    source: { kind: 'column', column: 'ai_skill_wage_premium_pct' },
    unit: '% wage premium',
    format: percent,
  },
  {
    id: 'women-share',
    label: "Women's share of displaced roles",
    source: { kind: 'column', column: 'pct_displaced_roles_female' },
    unit: '% of displaced roles',
    format: percent,
  },
] as const satisfies readonly {
  id: string;
  label: string;
  source: MetricSource;
  unit: string;
  format: MetricFormat;
}[];

export type MetricId = (typeof METRICS)[number]['id'];

export interface Metric {
  readonly id: MetricId;
  readonly label: string;
  readonly source: MetricSource;
  /** What a value counts, for an axis title or legend: "% of the Sector workforce". */
  readonly unit: string;
  readonly format: MetricFormat;
}

export const DEFAULT_METRIC: MetricId = 'displacement';

export function isMetricId(value: unknown): value is MetricId {
  return METRICS.some((metric) => metric.id === value);
}

export function getMetric(id: MetricId): Metric {
  return METRICS.find((metric) => metric.id === id)!;
}

/** Shown in place of a number when a metric has no value for the rows in view. */
export const NO_VALUE = 'No value';

const formatters = new Map<MetricId, Intl.NumberFormat>();

/**
 * Writes a metric's value for display: "4.1%", "-0.6%", "75", "0.83". Null is "no value", which
 * Replacement rate gives when nothing was displaced.
 */
export function formatMetric(id: MetricId, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return NO_VALUE;

  let formatter = formatters.get(id);
  if (!formatter) {
    const { style, digits, signed } = getMetric(id).format;
    // A fixed locale, so the built HTML and the browser always agree.
    formatter = new Intl.NumberFormat('en-US', {
      style: style === 'percent' ? 'percent' : 'decimal',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      signDisplay: signed ? 'exceptZero' : 'negative',
    });
    formatters.set(id, formatter);
  }
  return formatter.format(value);
}
