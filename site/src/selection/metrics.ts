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

export const METRICS = [
  {
    id: 'displacement',
    label: 'Displacement',
    source: { kind: 'column', column: 'pct_sector_workforce_displaced' },
  },
  {
    id: 'net-change',
    label: 'Net change',
    source: { kind: 'column', column: 'net_workforce_change_pct' },
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
  },
  {
    id: 'ai-adoption',
    label: 'AI adoption index',
    source: { kind: 'column', column: 'ai_adoption_index' },
  },
  {
    id: 'wage-premium',
    label: 'AI skills wage premium',
    source: { kind: 'column', column: 'ai_skill_wage_premium_pct' },
  },
  {
    id: 'women-share',
    label: "Women's share of displaced roles",
    source: { kind: 'column', column: 'pct_displaced_roles_female' },
  },
] as const satisfies readonly { id: string; label: string; source: MetricSource }[];

export type MetricId = (typeof METRICS)[number]['id'];

export interface Metric {
  readonly id: MetricId;
  readonly label: string;
  readonly source: MetricSource;
}

export const DEFAULT_METRIC: MetricId = 'displacement';

export function isMetricId(value: unknown): value is MetricId {
  return METRICS.some((metric) => metric.id === value);
}

export function getMetric(id: MetricId): Metric {
  return METRICS.find((metric) => metric.id === id)!;
}
