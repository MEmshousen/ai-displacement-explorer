// The map's geometry, drawn once at build time: world-atlas country shapes projected to SVG path
// data. Only Astro frontmatter and tests import this, so the browser downloads no geometry and
// runs no projection.

import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import atlas from 'world-atlas/countries-110m.json';
import { ISO_NUMERIC, MARKERS } from './countries';
import { spreadPoints } from './taps';

export interface CountryShape {
  /** The ISO3 code of a dataset country, or null for a country the dataset does not cover. */
  readonly iso3: string | null;
  /** The country's name as world-atlas spells it, for the "no data" tooltip. */
  readonly name: string;
  /** SVG path data. */
  readonly d: string;
}

export interface CountryMarker {
  readonly iso3: string;
  readonly x: number;
  readonly y: number;
  /**
   * Where the marker is drawn on a phone, where markers are larger for a finger: the same place,
   * unless that would put it on top of a neighbour's marker, as Kuwait's and Qatar's would be.
   */
  readonly phoneX: number;
  readonly phoneY: number;
  /** Whether the country also has a shape; if not, the marker is all there is of it. */
  readonly hasShape: boolean;
}

export interface MapGeometry {
  readonly width: number;
  readonly height: number;
  /** The radius of a small country's marker, in the map's units. */
  readonly markerRadius: number;
  /** The larger radius used on a phone, where the whole map is only about 300px wide. */
  readonly phoneMarkerRadius: number;
  readonly shapes: readonly CountryShape[];
  readonly markers: readonly CountryMarker[];
}

// A wide frame of whole units, so no coordinate needs a decimal point.
const WIDTH = 7200;
const ANTARCTICA = '010';

const MARKER_RADIUS = WIDTH / 160;
// About 5px on a 390px phone: large enough to see and to aim at.
const PHONE_MARKER_RADIUS = 110;
/** The least distance between two phone markers: both radii, and room for their outlines. */
const PHONE_MARKER_GAP = 2 * PHONE_MARKER_RADIUS + 30;

/**
 * Rewrites path data made only of absolute "M", "L" and "Z" commands with whole-number
 * coordinates, as d3-geo writes it, into relative commands: "M10,20L13,18L13,25Z" becomes
 * "m10 20l3-2 0 7z". Neighbouring points are close together, so the differences are short.
 */
export function compactPath(d: string): string {
  let out = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let drawing = false;
  const pair = (dx: number, dy: number) => `${dx}${dy < 0 ? '' : ' '}${dy}`;

  for (const [, command, px, py] of d.matchAll(/([MLZ])(?:(-?\d+),(-?\d+))?/g)) {
    if (command === 'Z') {
      out += 'z';
      // Closing a ring puts the pen back at its start.
      x = startX;
      y = startY;
      drawing = false;
      continue;
    }
    const dx = Number(px) - x;
    const dy = Number(py) - y;
    x += dx;
    y += dy;
    if (command === 'M') {
      out += `m${pair(dx, dy)}`;
      startX = x;
      startY = y;
      drawing = false;
    } else if (dx !== 0 || dy !== 0) {
      out += drawing ? `${dx < 0 ? '' : ' '}${pair(dx, dy)}` : `l${pair(dx, dy)}`;
      drawing = true;
    }
  }
  return out;
}

/** Projects the world, without Antarctica, in Equal Earth, `WIDTH` units wide. */
export function buildMapGeometry(): MapGeometry {
  const topology = atlas as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const world = feature(topology, topology.objects.countries);
  const features = world.features.filter((country) => country.id !== ANTARCTICA);

  const iso3ByNumeric = new Map(Object.entries(ISO_NUMERIC).map(([iso3, numeric]) => [numeric, iso3]));

  // Turned 11 degrees so the edge of the map falls in the Bering Strait, not across Russia.
  const projection = geoEqualEarth()
    .rotate([-11, 0])
    .precision(WIDTH / 1000)
    .fitWidth(WIDTH, { type: 'FeatureCollection', features });
  const path = geoPath(projection).digits(0);
  const [, [, bottom]] = path.bounds({ type: 'FeatureCollection', features });

  const shapes = features
    .map((country) => ({
      iso3: iso3ByNumeric.get(String(country.id)) ?? null,
      name: country.properties.name,
      d: compactPath(path(country) ?? ''),
    }))
    .filter((shape) => shape.d !== '');

  const drawn = new Set(shapes.map((shape) => shape.iso3));
  const placed = Object.entries(MARKERS).map(([iso3, location]) => {
    const [x, y] = projection([location[0], location[1]])!;
    return { iso3, x: Math.round(x), y: Math.round(y), hasShape: drawn.has(iso3) };
  });
  const onPhone = spreadPoints(placed, PHONE_MARKER_GAP);
  const markers = placed.map((marker, index) => ({
    ...marker,
    phoneX: Math.round(onPhone[index].x),
    phoneY: Math.round(onPhone[index].y),
  }));

  return {
    width: WIDTH,
    height: Math.ceil(bottom),
    markerRadius: MARKER_RADIUS,
    phoneMarkerRadius: PHONE_MARKER_RADIUS,
    shapes,
    markers,
  };
}
