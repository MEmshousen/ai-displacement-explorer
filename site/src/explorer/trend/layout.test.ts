import { describe, expect, it } from 'vitest';
import { formatTick, linePath, spreadLabels, yAxis, yearTicks } from './layout';

describe('yAxis', () => {
  it('starts at zero for values that sit near it, as Displacement does', () => {
    const axis = yAxis([0.027, 0.05, 0.087]);
    expect(axis.domain[0]).toBe(0);
    expect(axis.domain[1]).toBeGreaterThanOrEqual(0.087);
    expect(axis.ticks[0]).toBe(0);
  });

  it('covers both sides of zero for Net change', () => {
    const axis = yAxis([0.004, -0.009, -0.033]);
    expect(axis.domain[0]).toBeLessThanOrEqual(-0.033);
    expect(axis.domain[1]).toBeGreaterThanOrEqual(0.004);
    expect(axis.ticks).toContain(0);
  });

  it('ends at zero for values that are all a little below it', () => {
    const axis = yAxis([-0.009, -0.02, -0.033]);
    expect(axis.domain[1]).toBe(0);
    expect(axis.domain[0]).toBeLessThanOrEqual(-0.033);
  });

  it('frames values that stay far from zero instead of flattening them', () => {
    const axis = yAxis([0.48, 0.52, 0.55]);
    expect(axis.domain[0]).toBeGreaterThan(0.4);
    expect(axis.domain[0]).toBeLessThanOrEqual(0.48);
    expect(axis.domain[1]).toBeGreaterThanOrEqual(0.55);
  });

  it('ignores "no value" and still gives an axis when there is nothing else', () => {
    expect(yAxis([null, 30, null, 75]).domain).toEqual([0, 80]);
    const empty = yAxis([null, null]);
    expect(empty.domain[1]).toBeGreaterThan(empty.domain[0]);
  });

  it('gives a flat line room', () => {
    const axis = yAxis([0.5, 0.5]);
    expect(axis.domain[0]).toBeLessThan(0.5);
    expect(axis.domain[1]).toBeGreaterThan(0.5);
    expect(yAxis([0, 0]).domain[1]).toBeGreaterThan(0);
  });
});

describe('formatTick', () => {
  it('drops decimals the ticks do not need', () => {
    expect(formatTick('displacement', 0.05, [0, 0.05, 0.1])).toBe('5%');
    expect(formatTick('replacement-rate', 50, [0, 50, 100])).toBe('50');
  });

  it('keeps the decimals they do need', () => {
    expect(formatTick('displacement', 0.025, [0, 0.025, 0.05])).toBe('2.5%');
    expect(formatTick('displacement', 0.05, [0, 0.025, 0.05])).toBe('5.0%');
    expect(formatTick('ai-adoption', 0.2, [0, 0.2, 0.4])).toBe('0.2');
    expect(formatTick('ai-adoption', 0.25, [0, 0.25, 0.5])).toBe('0.25');
  });

  it('signs Net change, but not zero', () => {
    const ticks = [-0.02, 0, 0.02];
    expect(ticks.map((tick) => formatTick('net-change', tick, ticks))).toEqual(['-2%', '0%', '+2%']);
  });
});

describe('yearTicks', () => {
  const quarters = [2020, 2021, 2022, 2023, 2024, 2025, 2026]
    .flatMap((year) => [1, 2, 3, 4].map((quarter) => `${year}-Q${quarter}`))
    .slice(0, 26);

  it('marks the first quarter of every year when there is room', () => {
    const ticks = yearTicks(quarters, 400, 26);
    expect(ticks.map((tick) => tick.label)).toEqual(['2020', '2021', '2022', '2023', '2024', '2025', '2026']);
    expect(ticks.map((tick) => tick.index)).toEqual([0, 4, 8, 12, 16, 20, 24]);
  });

  it('thins the years on a narrow plot', () => {
    expect(yearTicks(quarters, 170, 26).map((tick) => tick.label)).toEqual(['2020', '2022', '2024', '2026']);
    expect(yearTicks(quarters, 90, 26).map((tick) => tick.label)).toEqual(['2020', '2023', '2026']);
  });
});

describe('linePath', () => {
  const x = (index: number) => index * 10;
  const y = (value: number) => 100 - value;

  it('joins every quarter that has a value', () => {
    expect(linePath([10, 20, 30], x, y)).toBe('M0,90L10,80L20,70');
  });

  it('leaves a gap at "no value" rather than drawing across it', () => {
    const path = linePath([10, 20, null, 40, 50], x, y);
    expect(path).toBe('M0,90L10,80M30,60L40,50');
  });

  it('draws nothing for a line with no values', () => {
    expect(linePath([null, null], x, y)).toBe('');
  });
});

describe('spreadLabels', () => {
  const apart = (positions: number[], gap: number) => {
    const sorted = [...positions].sort((a, b) => a - b);
    return sorted.every((position, index) => index === 0 || position - sorted[index - 1] >= gap - 1e-9);
  };

  it('leaves labels that do not collide where they are', () => {
    expect(spreadLabels([20, 60, 100], 14, 0, 150)).toEqual([20, 60, 100]);
  });

  it('moves colliding labels apart and keeps their order', () => {
    const placed = spreadLabels([52, 50, 55], 14, 0, 150);
    expect(apart(placed, 14)).toBe(true);
    // Input order is kept: the label that wanted 50 is still above 52, which is above 55.
    expect(placed[1]).toBeLessThan(placed[0]);
    expect(placed[0]).toBeLessThan(placed[2]);
  });

  it('keeps a crowd at the bottom inside the chart', () => {
    const placed = spreadLabels([146, 148, 149, 150, 150], 14, 0, 150);
    expect(apart(placed, 14)).toBe(true);
    expect(Math.max(...placed)).toBe(150);
    expect(Math.min(...placed)).toBeGreaterThanOrEqual(0);
  });

  it('keeps a crowd at the top inside the chart', () => {
    const placed = spreadLabels([2, 3, 1], 14, 10, 150);
    expect(apart(placed, 14)).toBe(true);
    expect(Math.min(...placed)).toBe(10);
  });

  it('handles no labels and one label', () => {
    expect(spreadLabels([], 14, 0, 150)).toEqual([]);
    expect(spreadLabels([200], 14, 0, 150)).toEqual([150]);
  });
});
