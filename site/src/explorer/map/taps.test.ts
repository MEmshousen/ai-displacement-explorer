import { describe, expect, it } from 'vitest';
import { nearestWithin, spreadPoints } from './taps';

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('spreadPoints', () => {
  it('pushes two close points equally apart along the line between them', () => {
    const [a, b] = spreadPoints(
      [
        { x: 0, y: 0 },
        { x: 6, y: 8 },
      ],
      20,
    );
    expect(distance(a, b)).toBeCloseTo(20);
    // Their midpoint has not moved, and neither has the direction from one to the other.
    expect((a.x + b.x) / 2).toBeCloseTo(3);
    expect((a.y + b.y) / 2).toBeCloseTo(4);
    expect((b.y - a.y) / (b.x - a.x)).toBeCloseTo(8 / 6);
  });

  it('leaves points with room around them exactly where they are', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ];
    expect(spreadPoints(points, 20)).toEqual(points);
  });

  it('clears every pair in a crowd of three', () => {
    const spread = spreadPoints(
      [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 1 },
      ],
      12,
    );
    for (let a = 0; a < spread.length; a++) {
      for (let b = a + 1; b < spread.length; b++) expect(distance(spread[a], spread[b])).toBeGreaterThan(11.9);
    }
  });

  it('separates two points in the same place', () => {
    const [a, b] = spreadPoints(
      [
        { x: 4, y: 4 },
        { x: 4, y: 4 },
      ],
      10,
    );
    expect(distance(a, b)).toBeCloseTo(10);
  });

  it('does not change the points it was given', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    spreadPoints(points, 10);
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
  });
});

describe('nearestWithin', () => {
  const kuwait = { x: 100, y: 100, iso3: 'KWT' };
  const qatar = { x: 110, y: 108, iso3: 'QAT' };
  const singapore = { x: 300, y: 200, iso3: 'SGP' };
  const markers = [kuwait, qatar, singapore];

  it('picks the nearer of two close markers', () => {
    expect(nearestWithin({ x: 103, y: 101 }, markers, 22)).toBe(kuwait);
    expect(nearestWithin({ x: 109, y: 106 }, markers, 22)).toBe(qatar);
  });

  it('reaches a marker from a near miss, up to the reach and no further', () => {
    expect(nearestWithin({ x: 300, y: 222 }, markers, 22)).toBe(singapore);
    expect(nearestWithin({ x: 300, y: 223 }, markers, 22)).toBeUndefined();
  });

  it('gives nothing when there are no markers', () => {
    expect(nearestWithin({ x: 0, y: 0 }, [], 22)).toBeUndefined();
  });

  it('gives the earlier of two markers at the same distance', () => {
    expect(nearestWithin({ x: 5, y: 0 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }], 22)).toEqual({ x: 0, y: 0 });
  });
});
