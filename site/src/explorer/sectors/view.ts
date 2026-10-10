// Draws the Sector bars as an ordered list of buttons and keeps them in step with the Selection.
// The rows are made once; after that a change only rewrites the text and custom properties that
// differ, and CSS moves the bars (see SectorBars.astro), so playing through the quarters is cheap.

import { formatMetric, getMetric, type MetricId, type Selection } from '../../selection';
import type { ExplorerPage } from '../page';
import {
  barScale,
  fixedDomain,
  rankOrder,
  rankSectors,
  viewHint,
  viewSubtitle,
  viewTitle,
  type BarScale,
} from './bars';

/** How long the ranking must hold still before the rows are put in that order in the document. */
const SETTLE_MS = 400;

interface Row {
  readonly item: HTMLLIElement;
  readonly button: HTMLButtonElement;
  readonly bar: HTMLElement;
  readonly value: HTMLElement;
}

/** Writes text, attributes and custom properties only when they change. */
function changeOnly() {
  const last = new WeakMap<Element, Map<string, string>>();
  return (element: HTMLElement, key: string, next: string, write: (next: string) => void) => {
    let seen = last.get(element);
    if (!seen) last.set(element, (seen = new Map()));
    if (seen.get(key) === next) return;
    seen.set(key, next);
    write(next);
  };
}

function span(className: string, text = ''): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  return element;
}

/**
 * Fills `root` (the element SectorBars.astro renders) with the bars and binds them to the page's
 * Selection. The pane's title and subtitle are the ones of the ViewPane that `root` sits in.
 */
export function mountSectorBars(root: HTMLElement, { explorer, store }: ExplorerPage): void {
  const list = root.querySelector<HTMLOListElement>('[data-sector-list]')!;
  const hint = root.querySelector<HTMLElement>('[data-sector-hint]')!;
  const pane = root.closest('[data-region="sectors"]');
  const title = pane?.querySelector<HTMLElement>('[data-view-title]');
  const subtitle = pane?.querySelector<HTMLElement>('[data-view-subtitle]');

  const set = changeOnly();
  const text = (element: HTMLElement | null | undefined, next: string) => {
    if (element) set(element, 'text', next, (value) => (element.textContent = value));
  };
  const property = (element: HTMLElement, name: string, next: string) => {
    set(element, name, next, (value) => element.style.setProperty(name, value));
  };

  const rows = new Map<string, Row>();
  list.replaceChildren();
  for (const sector of explorer.choices.sectors) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.sector = sector;

    const track = span('track');
    track.setAttribute('aria-hidden', 'true');
    const bar = span('bar');
    track.append(bar, span('zero'));
    const value = span('value');
    // The spaces keep the name and the value apart when the button is read out.
    button.append(span('name', sector), ' ', track, ' ', value);
    item.append(button);
    rows.set(sector, { item, button, bar, value });
  }
  list.style.setProperty('--count', String(rows.size));

  // One scale per metric and country, taken over every quarter, so it holds still as time plays.
  const scales = new Map<string, BarScale>();
  const scaleFor = (metric: MetricId, country: string | null): BarScale => {
    const key = `${metric}|${country ?? ''}`;
    let scale = scales.get(key);
    if (!scale) {
      const quarters = explorer.choices.quarters.map((quarter) =>
        explorer.bySector({ metric, quarter, country }),
      );
      scales.set(key, (scale = barScale(fixedDomain(quarters))));
    }
    return scale;
  };

  let order: string[] = [];

  // The rows are placed by rank with a transform, so the document order can lag behind. Once the
  // ranking has held still, the rows are put in ranked order so that keyboard and screen reader
  // users meet them from the top down. The focused row is never moved, so it keeps the focus.
  const settle = () => {
    const wanted = order.map((sector) => rows.get(sector)!.item);
    if (wanted.every((item, index) => list.children[index] === item)) return;
    const focused = wanted.findIndex((item) => item.contains(document.activeElement));
    if (focused === -1) {
      list.append(...wanted);
      return;
    }
    for (const item of wanted.slice(0, focused)) list.insertBefore(item, wanted[focused]);
    list.append(...wanted.slice(focused + 1));
  };
  let settling: number | undefined;

  let drawn = '';
  const render = (selection: Selection) => {
    const { metric, quarter, country, sector } = selection;
    // Pinned countries do not change this view.
    const key = [metric, quarter, country, sector].join('|');
    if (key === drawn) return;
    drawn = key;

    const values = explorer.bySector(selection);
    const scale = scaleFor(metric, country);
    order = rankSectors(values, order, rankOrder(metric));

    property(list, '--zero', String(scale.zero));
    order.forEach((name, rank) => property(rows.get(name)!.item, '--rank', String(rank)));
    for (const { sector: name, value } of values) {
      const row = rows.get(name)!;
      const shape = scale.bar(value);
      text(row.value, formatMetric(metric, value));
      // A bar with no value keeps its place and shrinks to nothing.
      if (shape) property(row.bar, '--start', `${shape.start * 100}%`);
      property(row.bar, '--length', String(shape?.length ?? 0));
      set(row.item, 'empty', String(shape === null), () => row.item.classList.toggle('no-value', shape === null));
      set(row.button, 'pressed', String(name === sector), (pressed) =>
        row.button.setAttribute('aria-pressed', pressed),
      );
    }
    set(list, 'chosen', String(sector !== null), () => list.classList.toggle('has-chosen', sector !== null));

    const countryName = country === null ? null : (explorer.country(country)?.name ?? country);
    const heading = viewTitle(countryName, quarter);
    text(title, heading);
    text(subtitle, viewSubtitle(getMetric(metric)));
    text(hint, viewHint(sector));
    set(list, 'label', heading, (label) => list.setAttribute('aria-label', label));

    window.clearTimeout(settling);
    settling = window.setTimeout(settle, SETTLE_MS);
  };

  list.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-sector]');
    if (!button) return;
    const sector = button.dataset.sector!;
    store.update({ sector: store.get().sector === sector ? null : sector });
  });

  render(store.get());
  window.clearTimeout(settling);
  settle();
  store.subscribe(render);

  // The first drawing appears in place; only later changes move.
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-drawn')));
}
