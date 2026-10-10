import { describe, expect, it } from 'vitest';
import { readDataset } from '../../data/step/dataset';
import { readRealCsv } from '../../data/step/testing';
import { ISO_NUMERIC, MARKERS } from './countries';
import { buildMapGeometry, compactPath } from './geometry';

const geometry = buildMapGeometry();
const dataset = readDataset(readRealCsv());
const datasetCodes = dataset.countries.map((country) => country.iso3);

describe('the join between the dataset and the map', () => {
  it('lists a numeric code for each of the 80 dataset countries and for nothing else', () => {
    expect(datasetCodes).toHaveLength(80);
    expect(Object.keys(ISO_NUMERIC).sort()).toEqual([...datasetCodes].sort());
    expect(new Set(Object.values(ISO_NUMERIC)).size).toBe(80);
  });

  it('gives every dataset country a shape or a marker', () => {
    const shown = new Set([
      ...geometry.shapes.map((shape) => shape.iso3),
      ...geometry.markers.map((marker) => marker.iso3),
    ]);
    expect(datasetCodes.filter((iso3) => !shown.has(iso3))).toEqual([]);
  });

  it('needs a marker only for Hong Kong and Singapore, which have no shape', () => {
    const drawn = new Set(geometry.shapes.map((shape) => shape.iso3));
    expect(datasetCodes.filter((iso3) => !drawn.has(iso3))).toEqual(['HKG', 'SGP']);
    expect(geometry.markers.filter((marker) => !marker.hasShape).map((marker) => marker.iso3)).toEqual([
      'HKG',
      'SGP',
    ]);
  });

  it('joins a shape to the right country', () => {
    const atlasName = (iso3: string) => geometry.shapes.find((shape) => shape.iso3 === iso3)?.name;
    expect(atlasName('DEU')).toBe('Germany');
    expect(atlasName('CIV')).toBe("Côte d'Ivoire");
    expect(atlasName('ARE')).toBe('United Arab Emirates');
    expect(atlasName('TWN')).toBe('Taiwan');
  });

  it('marks only dataset countries', () => {
    expect(Object.keys(MARKERS).filter((iso3) => !datasetCodes.includes(iso3))).toEqual([]);
  });
});

describe('the drawn map', () => {
  it('leaves out Antarctica and draws every shape once', () => {
    expect(geometry.shapes.map((shape) => shape.name)).not.toContain('Antarctica');
    const joined = geometry.shapes.filter((shape) => shape.iso3 !== null);
    expect(new Set(joined.map((shape) => shape.iso3)).size).toBe(joined.length);
    expect(joined).toHaveLength(78);
  });

  it('keeps every marker inside the frame', () => {
    for (const marker of geometry.markers) {
      expect(marker.x).toBeGreaterThan(0);
      expect(marker.x).toBeLessThan(geometry.width);
      expect(marker.y).toBeGreaterThan(0);
      expect(marker.y).toBeLessThan(geometry.height);
    }
  });

  it('moves only the markers that would overlap on a phone, and clears them of each other', () => {
    const { markers, phoneMarkerRadius } = geometry;
    const moved = markers.filter((marker) => marker.phoneX !== marker.x || marker.phoneY !== marker.y);
    expect(moved.map((marker) => marker.iso3).sort()).toEqual(['KWT', 'QAT']);

    for (const a of markers) {
      for (const b of markers) {
        if (a === b) continue;
        const apart = Math.hypot(a.phoneX - b.phoneX, a.phoneY - b.phoneY);
        expect(apart).toBeGreaterThan(2 * phoneMarkerRadius);
      }
    }
    // Neither is carried far: less than one phone marker's width from where the country is.
    for (const marker of moved) {
      const carried = Math.hypot(marker.phoneX - marker.x, marker.phoneY - marker.y);
      expect(carried).toBeLessThan(2 * phoneMarkerRadius);
    }
  });

  it('writes compact paths', () => {
    const size = geometry.shapes.reduce((total, shape) => total + shape.d.length, 0);
    expect(size).toBeLessThan(60_000);
    expect(geometry.shapes.every((shape) => /^[mlz\d -]+$/.test(shape.d))).toBe(true);
  });
});

describe('compactPath', () => {
  it('rewrites absolute commands as relative ones', () => {
    expect(compactPath('M10,20L13,18L13,25Z')).toBe('m10 20l3-2 0 7z');
  });

  it('starts a second ring from where the first one closed', () => {
    expect(compactPath('M10,20L13,18Z M5,30L6,31L4,29Z')).toBe('m10 20l3-2zm-5 10l1 1-2-2z');
  });

  it('drops a point that repeats the one before it', () => {
    expect(compactPath('M0,0L5,5L5,5L6,5Z')).toBe('m0 0l5 5 1 0z');
  });

  it('gives nothing for nothing', () => {
    expect(compactPath('')).toBe('');
  });
});
