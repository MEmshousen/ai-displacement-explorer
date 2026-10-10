// Draws the trend chart in the browser and keeps it in step with the Selection.
//
// Two kinds of update, kept apart so the map's play button stays cheap:
//   draw()         the lines changed (metric, Sector, country, pinned) or the pane was resized:
//                  the SVG is rebuilt.
//   showQuarter()  only the quarter changed: the rule, the dots and the readout's text are moved
//                  in place. Nothing is added or removed, so nothing flickers.

import { scaleLinear } from 'd3-scale';
import type { ExplorerPage } from '../page';
import { formatMetric, getMetric, type Selection } from '../../selection';
import { formatTick, linePath, spreadLabels, yAxis, yearTicks } from './layout';
import {
  onlyGlobalAverage,
  readoutText,
  trendLines,
  trendSubtitle,
  trendSummary,
  trendTitle,
  type TrendLine,
} from './lines';

const SVG = 'http://www.w3.org/2000/svg';

type Attrs = Record<string, string | number>;

function svgEl<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Attrs = {},
  text?: string,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function htmlEl(name: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(name);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Marks a line, its dots, its label and its readout swatch so one set of CSS rules styles all. */
function lineAttrs(line: TrendLine): Attrs {
  return { 'data-role': line.role, ...(line.slot === null ? {} : { 'data-slot': line.slot }) };
}

const round = (value: number) => Math.round(value * 10) / 10;

export function mountTrendChart(root: HTMLElement, { explorer, store }: ExplorerPage): void {
  const pane = root.closest('[data-region="trend"]');
  const title = pane?.querySelector<HTMLElement>('[data-view-title]');
  const subtitle = pane?.querySelector<HTMLElement>('[data-view-subtitle]');

  const svg = root.querySelector<SVGSVGElement>('[data-trend-svg]')!;
  const scrubber = root.querySelector<HTMLInputElement>('[data-trend-scrubber]')!;
  const readout = root.querySelector<HTMLElement>('[data-trend-readout]')!;
  const hint = root.querySelector<HTMLElement>('[data-trend-hint]')!;

  const { quarters } = explorer.choices;
  const lastIndex = quarters.length - 1;
  scrubber.max = String(lastIndex);

  /** What draw() leaves behind for showQuarter() to move. */
  interface Drawn {
    readonly selection: Selection;
    readonly lines: readonly TrendLine[];
    readonly x: (index: number) => number;
    readonly y: (value: number) => number;
    readonly rule: SVGGElement;
    readonly ruleLabel: SVGTextElement;
    readonly ruleLabelRange: readonly [number, number];
    readonly hoverRule: SVGLineElement;
    readonly dots: readonly SVGCircleElement[];
    readonly readoutQuarter: HTMLElement;
    readonly readoutValues: readonly HTMLElement[];
    /** Maps a horizontal position in the SVG to the nearest quarter. */
    readonly quarterAt: (x: number) => number;
  }
  let drawn: Drawn | undefined;
  /** The quarter being read by pointer or keyboard, or null to read the Selection's quarter. */
  let reading: number | null = null;
  let width = 0;

  const measurer = svgEl('text', { visibility: 'hidden', 'aria-hidden': 'true' });
  const measure = (text: string, className: string): number => {
    measurer.setAttribute('class', className);
    measurer.textContent = text;
    return measurer.getComputedTextLength();
  };
  /** Shortens a label with an ellipsis until it fits. */
  const fit = (text: string, className: string, maxWidth: number): string => {
    if (measure(text, className) <= maxWidth) return text;
    let cut = text.length - 1;
    while (cut > 1 && measure(`${text.slice(0, cut).trimEnd()}…`, className) > maxWidth) cut--;
    return `${text.slice(0, cut).trimEnd()}…`;
  };

  function draw(selection: Selection): void {
    const lines = trendLines(selection, explorer);
    const metric = getMetric(selection.metric);

    if (title) title.textContent = trendTitle(lines);
    if (subtitle) subtitle.textContent = trendSubtitle(selection, quarters);
    hint.hidden = !onlyGlobalAverage(lines);

    width = Math.max(220, Math.round(root.clientWidth));
    const height = Math.round(Math.min(230, Math.max(190, width * 0.52)));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('aria-label', trendSummary(selection, lines, quarters));
    svg.replaceChildren(measurer);

    // Margins come from the text that has to fit in them.
    const axis = yAxis(lines.flatMap((line) => line.values));
    const tickLabels = axis.ticks.map((tick) => formatTick(selection.metric, tick, axis.ticks));
    const left = Math.ceil(Math.max(...tickLabels.map((label) => measure(label, 'trend-tick')))) + 8;

    const labelRoom = Math.max(70, width * 0.34);
    const endLabels = lines.map((line) => fit(line.name, 'trend-label', labelRoom));
    const labelWidth = Math.max(...endLabels.map((label) => measure(label, 'trend-label')));
    const right = Math.ceil(labelWidth) + 14;

    const top = 38;
    const bottom = height - 24;
    const plotRight = width - right;

    const xScale = scaleLinear().domain([0, lastIndex]).range([left, plotRight]);
    const yScale = scaleLinear().domain(axis.domain).range([bottom, top]);
    const x = (index: number) => round(xScale(index));
    const y = (value: number) => round(yScale(value));

    // What the y axis counts, above the plot.
    svg.append(svgEl('text', { class: 'trend-unit', x: 0, y: 11 }, metric.unit));

    // Grid lines, with the zero line drawn as the axis.
    const grid = svgEl('g', { 'aria-hidden': 'true' });
    axis.ticks.forEach((tick, position) => {
      grid.append(
        svgEl('line', {
          class: tick === 0 ? 'trend-zero' : 'trend-grid',
          x1: left,
          x2: plotRight,
          y1: y(tick),
          y2: y(tick),
        }),
        svgEl('text', { class: 'trend-tick', x: left - 6, y: y(tick) + 4, 'text-anchor': 'end' }, tickLabels[position]),
      );
    });
    for (const year of yearTicks(quarters, plotRight - left, measure('2020', 'trend-tick'))) {
      grid.append(
        svgEl('line', { class: 'trend-grid', x1: x(year.index), x2: x(year.index), y1: bottom, y2: bottom + 4 }),
        svgEl('text', { class: 'trend-tick', x: x(year.index), y: height - 5, 'text-anchor': 'middle' }, year.label),
      );
    }
    svg.append(grid);

    // The lines, drawn back to front: the global average, the pinned countries, the selected one.
    const paths = svgEl('g', { 'aria-hidden': 'true' });
    for (const line of [...lines].reverse()) {
      paths.append(svgEl('path', { class: 'trend-line', d: linePath(line.values, x, y), ...lineAttrs(line) }));
    }
    svg.append(paths);

    const hoverRule = svgEl('line', { class: 'trend-hover-rule', y1: top, y2: bottom, visibility: 'hidden' });
    svg.append(hoverRule);

    // The rule that marks the Selection's quarter. Moved by a transform, never rebuilt.
    const rule = svgEl('g', { 'aria-hidden': 'true' });
    const ruleLabel = svgEl('text', { class: 'trend-rule-label', y: top - 9, 'text-anchor': 'middle' });
    rule.append(svgEl('line', { class: 'trend-rule', y1: top - 5, y2: bottom }), ruleLabel);
    svg.append(rule);
    const half = measure(quarters[0], 'trend-rule-label') / 2;

    // A label at the end of each line, moved apart where the lines end close together.
    const ends = lines.map((line) => {
      const index = line.values.findLastIndex((value) => value !== null);
      return index === -1 ? null : { index, y: y(line.values[index]!) };
    });
    const shown = ends.flatMap((end, position) => (end ? [position] : []));
    const labelYs = spreadLabels(
      shown.map((position) => ends[position]!.y),
      14,
      top + 2,
      bottom,
    );
    const labels = svgEl('g', { 'aria-hidden': 'true' });
    shown.forEach((position, order) => {
      const line = lines[position];
      const end = ends[position]!;
      const endX = x(end.index);
      const labelX = plotRight + 10;
      const labelY = round(labelYs[order]);
      if (Math.abs(labelY - end.y) > 2 || end.index < lastIndex) {
        labels.append(
          svgEl('line', { class: 'trend-leader', x1: endX + 4, y1: end.y, x2: labelX - 3, y2: labelY, ...lineAttrs(line) }),
        );
      }
      const label = svgEl('text', { class: 'trend-label', x: labelX, y: labelY + 4, ...lineAttrs(line) }, endLabels[position]);
      if (endLabels[position] !== line.name) label.append(svgEl('title', {}, line.name));
      labels.append(svgEl('circle', { class: 'trend-end', cx: endX, cy: end.y, r: line.role === 'selected' ? 3.5 : 2.5, ...lineAttrs(line) }), label);
    });
    svg.append(labels);

    // One ring per line, at the quarter being read.
    const dotLayer = svgEl('g', { 'aria-hidden': 'true' });
    const dots = lines.map((line) => svgEl('circle', { class: 'trend-dot', r: 3.5, ...lineAttrs(line) }));
    dotLayer.append(...dots);
    svg.append(dotLayer);

    // The readout: every line's value at one quarter, which also serves as the key.
    const readoutQuarter = htmlEl('p', 'trend-readout-quarter');
    const list = htmlEl('ul', 'trend-readout-lines');
    const readoutValues = lines.map((line) => {
      const item = htmlEl('li', 'trend-readout-line');
      const swatch = svgEl('svg', { class: 'trend-swatch', viewBox: '0 0 26 10', 'aria-hidden': 'true' });
      swatch.append(svgEl('line', { class: 'trend-line', x1: 1.5, x2: 24.5, y1: 5, y2: 5, ...lineAttrs(line) }));
      const name = htmlEl('span', 'trend-readout-name', line.name);
      if (line.pinned) name.append(' ', htmlEl('span', 'trend-readout-tag', 'pinned'));
      const value = htmlEl('span', 'trend-readout-value');
      item.append(swatch, name, value);
      list.append(item);
      return value;
    });
    readout.replaceChildren(readoutQuarter, list);

    drawn = {
      selection,
      lines,
      x,
      y,
      rule,
      ruleLabel,
      ruleLabelRange: [half, width - half],
      hoverRule,
      dots,
      readoutQuarter,
      readoutValues,
      quarterAt: (position) => Math.max(0, Math.min(lastIndex, Math.round(xScale.invert(position)))),
    };
    showQuarter();
  }

  /** Moves the rule to the Selection's quarter, and the dots and readout to the quarter being read. */
  function showQuarter(): void {
    if (!drawn) return;
    const { selection, lines, x, y } = drawn;
    const selected = Math.max(0, quarters.indexOf(selection.quarter));
    const index = reading ?? selected;

    const ruleX = x(selected);
    drawn.rule.setAttribute('transform', `translate(${ruleX},0)`);
    drawn.ruleLabel.textContent = quarters[selected];
    // Keep the quarter's label inside the chart at either end of the range.
    const [from, to] = drawn.ruleLabelRange;
    drawn.ruleLabel.setAttribute('x', String(round(Math.max(from, Math.min(to, ruleX)) - ruleX)));

    const hovering = reading !== null && reading !== selected;
    drawn.hoverRule.setAttribute('visibility', hovering ? 'visible' : 'hidden');
    if (hovering) {
      drawn.hoverRule.setAttribute('x1', String(x(index)));
      drawn.hoverRule.setAttribute('x2', String(x(index)));
    }

    lines.forEach((line, position) => {
      const value = line.values[index];
      const dot = drawn!.dots[position];
      if (value === null) {
        dot.setAttribute('visibility', 'hidden');
      } else {
        dot.setAttribute('visibility', 'visible');
        dot.setAttribute('cx', String(x(index)));
        dot.setAttribute('cy', String(y(value)));
      }
      drawn!.readoutValues[position].textContent = formatMetric(selection.metric, value);
    });
    drawn.readoutQuarter.textContent = quarters[index];

    if (reading === null) scrubber.value = String(selected);
    scrubber.setAttribute('aria-valuetext', readoutText(selection, lines, quarters, index));
  }

  const read = (index: number | null) => {
    if (index === reading) return;
    reading = index;
    showQuarter();
  };

  // Pointer: read the quarter under the pointer. A touch keeps its quarter after lifting.
  const pointerQuarter = (event: PointerEvent) => {
    if (!drawn) return;
    const box = svg.getBoundingClientRect();
    read(drawn.quarterAt(((event.clientX - box.left) / box.width) * width));
  };
  svg.addEventListener('pointermove', pointerQuarter);
  svg.addEventListener('pointerdown', pointerQuarter);
  svg.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && document.activeElement !== scrubber) read(null);
  });

  // Keyboard and screen readers: a hidden slider steps through the quarters with the arrow keys
  // and speaks the readout. It reads the chart only; it does not change the Selection.
  scrubber.addEventListener('input', () => read(Number(scrubber.value)));
  scrubber.addEventListener('focus', () => read(Number(scrubber.value)));
  scrubber.addEventListener('blur', () => read(null));

  store.subscribe((selection) => {
    const before = drawn?.selection;
    const sameLines =
      before !== undefined &&
      before.metric === selection.metric &&
      before.sector === selection.sector &&
      before.country === selection.country &&
      before.pinned.join() === selection.pinned.join();
    if (!sameLines) {
      draw(selection);
    } else if (drawn) {
      // The Selection's quarter moved, so go back to reading it.
      if (document.activeElement !== scrubber) reading = null;
      drawn = { ...drawn, selection };
      showQuarter();
    }
  });

  // Redraw at the new size when the pane's width changes, and once the fonts are in, because
  // the margins are measured from the text.
  let frame = 0;
  const redraw = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => draw(store.get()));
  };
  new ResizeObserver(() => {
    if (Math.max(220, Math.round(root.clientWidth)) !== width) redraw();
  }).observe(root);
  void document.fonts?.ready.then(redraw);

  draw(store.get());
}
