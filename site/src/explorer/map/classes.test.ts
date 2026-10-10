import { describe, expect, it } from 'vitest';
import { colourClasses, darkEnd, legend, roundToFormat, stepOf } from './classes';

/** 0.01, 0.02 ... 1.00: the fifths fall at 0.208, 0.406, 0.604 and 0.802. */
const hundredths = Array.from({ length: 100 }, (_, index) => (index + 1) / 100);

describe('roundToFormat', () => {
  it('rounds to the places the metric is written to', () => {
    expect(roundToFormat('displacement', 0.04062)).toBe(0.041);
    expect(roundToFormat('net-change', -0.02349)).toBe(-0.023);
    expect(roundToFormat('replacement-rate', 75.29)).toBe(75);
    expect(roundToFormat('ai-adoption', 0.8349)).toBe(0.83);
  });
});

describe('colourClasses', () => {
  it('puts four boundaries at the fifths, rounded as the metric is written', () => {
    const classes = colourClasses('displacement', hundredths);
    expect(classes.boundaries).toEqual([0.208, 0.406, 0.604, 0.802]);
    expect(classes.steps).toEqual([1, 2, 3, 4, 5]);
    expect(classes.extent).toEqual([0.01, 1]);
  });

  it('ignores missing values', () => {
    expect(colourClasses('replacement-rate', [null, 10, 20, NaN, 30, 40, 50, null]).boundaries).toEqual([
      18, 26, 34, 42,
    ]);
  });

  it('makes one class when every value is the same', () => {
    const classes = colourClasses('women-share', [0.95, 0.95, 0.95]);
    expect(classes.boundaries).toEqual([]);
    expect(classes.steps).toEqual([3]);
  });

  it('merges boundaries that round to the same number and spreads the classes over the ramp', () => {
    const classes = colourClasses('ai-adoption', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.51, 0.52, 0.52]);
    expect(classes.boundaries).toEqual([0.51]);
    expect(classes.steps).toEqual([1, 5]);
  });

  it('makes no classes from no values', () => {
    const classes = colourClasses('displacement', []);
    expect(classes.boundaries).toEqual([]);
    expect(classes.extent).toBeNull();
    expect(legend(classes).classes).toEqual([{ step: 3, range: 'No values' }]);
  });

  it('runs the ramp the other way for Net change, whose low end is the dark one', () => {
    expect(darkEnd('net-change')).toBe('low');
    expect(darkEnd('displacement')).toBe('high');
    const classes = colourClasses(
      'net-change',
      hundredths.map((value) => -value),
    );
    expect(classes.boundaries).toEqual([-0.802, -0.604, -0.406, -0.208]);
    expect(classes.steps).toEqual([5, 4, 3, 2, 1]);
  });
});

describe('stepOf', () => {
  const classes = colourClasses('displacement', hundredths);

  it('gives the lightest step to the lowest values and the darkest to the highest', () => {
    expect(stepOf(classes, 0.01)).toBe(1);
    expect(stepOf(classes, 0.3)).toBe(2);
    expect(stepOf(classes, 0.99)).toBe(5);
  });

  it('puts a value on a boundary in the class above it', () => {
    expect(stepOf(classes, 0.207)).toBe(1);
    expect(stepOf(classes, 0.208)).toBe(2);
  });

  it('classes a value by the number it is written as', () => {
    // 0.20796 is written "20.8%", the boundary, so it is coloured as 20.8%.
    expect(stepOf(classes, 0.20796)).toBe(2);
  });

  it('colours values beyond the ones the classes were built from', () => {
    expect(stepOf(classes, -1)).toBe(1);
    expect(stepOf(classes, 7)).toBe(5);
  });

  it('gives the darkest step to the largest net loss', () => {
    const netChange = colourClasses(
      'net-change',
      hundredths.map((value) => -value),
    );
    expect(stepOf(netChange, -0.99)).toBe(5);
    expect(stepOf(netChange, -0.01)).toBe(1);
  });

  it('has no step for no value', () => {
    expect(stepOf(classes, null)).toBeNull();
    expect(stepOf(classes, NaN)).toBeNull();
  });
});

describe('legend', () => {
  it('names each class and boundary in the metric format, lightest first', () => {
    expect(legend(colourClasses('displacement', hundredths))).toEqual({
      classes: [
        { step: 1, range: 'Under 20.8%' },
        { step: 2, range: '20.8% to under 40.6%' },
        { step: 3, range: '40.6% to under 60.4%' },
        { step: 4, range: '60.4% to under 80.2%' },
        { step: 5, range: '80.2% or more' },
      ],
      boundaries: ['20.8%', '40.6%', '60.4%', '80.2%'],
    });
  });

  it('still reads lightest first for Net change, so its numbers fall', () => {
    const netChange = legend(
      colourClasses(
        'net-change',
        hundredths.map((value) => -value),
      ),
    );
    expect(netChange.boundaries).toEqual(['−20.8%', '−40.6%', '−60.4%', '−80.2%']);
    expect(netChange.classes.map((entry) => entry.step)).toEqual([1, 2, 3, 4, 5]);
    expect(netChange.classes[0].range).toBe('−20.8% or more');
    expect(netChange.classes[4].range).toBe('Under −80.2%');
  });

  it('has a single entry, named by its value, when every value is the same', () => {
    expect(legend(colourClasses('women-share', [0.95, 0.95]))).toEqual({
      classes: [{ step: 3, range: '95.0%' }],
      boundaries: [],
    });
  });

  it('names a single class by its lowest and highest values when they differ', () => {
    // The fifths all round to the lowest value, so no boundary can be drawn.
    const classes = colourClasses('ai-adoption', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.52]);
    expect(legend(classes).classes).toEqual([{ step: 3, range: '0.50 to 0.52' }]);
  });
});
