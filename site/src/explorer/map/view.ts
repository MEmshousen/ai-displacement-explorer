// The world map in the browser. The shapes are already in the page; this fills them from the
// Selection, keeps the pane's title, legend and text alternative in step, and turns hovering,
// focusing and clicking into a tooltip and a selected country.

import { explorerPage } from '../page';
import { formatMetric, type MetricId, type Selection } from '../../selection';
import { colourClasses, darkerMeans, legend, stepOf, type ColourClasses } from './classes';
import { countryLabel, mapSubtitle, mapSummary, mapTitle } from './words';

/** Everything drawn for one dataset country: a shape, a marker, or both. */
interface Drawn {
  readonly iso3: string;
  readonly name: string;
  shape?: SVGPathElement;
  marker?: SVGCircleElement;
}

export async function mountMap(root: HTMLElement): Promise<void> {
  const status = root.querySelector<HTMLElement>('[data-map-status]')!;
  try {
    await mount(root);
  } catch (error) {
    status.textContent = 'The map could not load its data. Reload the page to try again.';
    throw error;
  }
}

async function mount(root: HTMLElement): Promise<void> {
  const svg = root.querySelector<SVGSVGElement>('[data-map-svg]')!;
  const frame = svg.parentElement!;
  const tooltip = root.querySelector<HTMLElement>('[data-map-tooltip]')!;
  const summary = root.querySelector<HTMLElement>('[data-map-summary]')!;
  const legendTitle = root.querySelector<HTMLElement>('[data-legend-title]')!;
  const legendSwatches = root.querySelector<HTMLElement>('[data-legend-swatches]')!;
  const legendMarks = root.querySelector<HTMLElement>('[data-legend-marks]')!;
  const legendText = root.querySelector<HTMLElement>('[data-legend-text]')!;
  const pane = root.closest<HTMLElement>('[data-region="map"]');
  const title = pane?.querySelector<HTMLElement>('[data-view-title]');
  const subtitle = pane?.querySelector<HTMLElement>('[data-view-subtitle]');
  const outlines = {
    hovered: svg.querySelector<SVGPathElement>('[data-outline="hovered"]')!,
    selected: svg.querySelector<SVGPathElement>('[data-outline="selected"]')!,
  };
  const rings = {
    hovered: svg.querySelector<SVGCircleElement>('[data-ring="hovered"]')!,
    selected: svg.querySelector<SVGCircleElement>('[data-ring="selected"]')!,
  };

  const { explorer, store } = await explorerPage();

  // --- The dataset's countries, joined to what is drawn for each ---------------------------

  const drawn = new Map<string, Drawn>(
    explorer.countries.map(({ iso3, name }) => [iso3, { iso3, name }]),
  );
  for (const element of svg.querySelectorAll<SVGElement>('[data-country]')) {
    const country = drawn.get(element.dataset.country!);
    if (!country) continue;
    if (element instanceof SVGCircleElement) country.marker = element;
    else country.shape = element as SVGPathElement;
  }
  /** The element that is the country's button: its shape, or its marker if it has no shape. */
  const buttonOf = (country: Drawn) => country.shape ?? country.marker;
  /** Arrow keys walk the countries in alphabetical order. */
  const walk = [...drawn.values()]
    .filter((country) => buttonOf(country))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  // --- Colour classes, fixed across the quarters for a metric and Sector -------------------

  const classesFor = new Map<string, ColourClasses>();
  const classesOf = ({ metric, sector }: Selection): ColourClasses => {
    const key = `${metric}|${sector ?? ''}`;
    let classes = classesFor.get(key);
    if (!classes) {
      const values = explorer.choices.quarters.flatMap((quarter) =>
        explorer.byCountry({ metric, sector, quarter }).map((entry) => entry.value),
      );
      classes = colourClasses(metric, values);
      classesFor.set(key, classes);
    }
    return classes;
  };

  let legendShown: ColourClasses | undefined;
  const showLegend = (classes: ColourClasses) => {
    if (classes === legendShown) return;
    legendShown = classes;
    const { classes: entries, boundaries } = legend(classes);

    legendTitle.textContent = `${darkerMeans(classes.metric)}.`;
    legendSwatches.replaceChildren(
      ...entries.map((entry) => {
        const swatch = document.createElement('i');
        swatch.dataset.step = String(entry.step);
        return swatch;
      }),
    );
    // Each boundary sits under the join between two steps; a lone class is named under its middle.
    const marks = entries.length === 1 ? [entries[0].range] : boundaries;
    legendMarks.replaceChildren(
      ...marks.map((text, index) => {
        const mark = document.createElement('span');
        mark.textContent = text;
        mark.style.left = `${((index + 1) / (marks.length + 1)) * 100}%`;
        return mark;
      }),
    );
    legendText.textContent =
      `Colour classes, lightest to darkest: ${entries.map((entry) => entry.range).join('; ')}. ` +
      `${darkerMeans(classes.metric)}. Countries without data are grey.`;
  };

  // --- Drawing the Selection ---------------------------------------------------------------

  const values = new Map<string, number | null>();
  let metric: MetricId = store.get().metric;
  /** The country whose button is the map's one tab stop. */
  let tabStop: Drawn | undefined;

  const setTabStop = (country: Drawn | undefined) => {
    if (country === tabStop) return;
    if (tabStop) buttonOf(tabStop)?.setAttribute('tabindex', '-1');
    tabStop = country;
    if (tabStop) buttonOf(tabStop)?.setAttribute('tabindex', '0');
  };

  const outline = (kind: 'hovered' | 'selected', target: { d?: string | null; marker?: SVGCircleElement }) => {
    outlines[kind].setAttribute('d', target.d ?? '');
    const ring = rings[kind];
    if (target.marker) {
      ring.setAttribute('cx', target.marker.getAttribute('cx')!);
      ring.setAttribute('cy', target.marker.getAttribute('cy')!);
    }
    ring.setAttribute('visibility', target.marker ? 'visible' : 'hidden');
  };

  const render = (selection: Selection) => {
    metric = selection.metric;
    const classes = classesOf(selection);
    const entries = explorer.byCountry(selection);

    for (const { country, value } of entries) {
      values.set(country.iso3, value);
      const target = drawn.get(country.iso3)!;
      const step = stepOf(classes, value);
      const isSelected = country.iso3 === selection.country;
      for (const element of [target.shape, target.marker]) {
        if (!element) continue;
        if (step === null) delete element.dataset.step;
        else element.dataset.step = String(step);
      }
      const button = buttonOf(target);
      button?.setAttribute('aria-label', countryLabel(metric, { name: country.name, value }));
      button?.setAttribute('aria-pressed', String(isSelected));
    }

    const selected = selection.country === null ? undefined : drawn.get(selection.country);
    outline('selected', { d: selected?.shape?.getAttribute('d'), marker: selected?.marker });
    if (selected) setTabStop(selected);
    else if (!tabStop) setTabStop(walk[0]);

    if (title) title.textContent = mapTitle(selection);
    if (subtitle) subtitle.textContent = mapSubtitle(selection);
    showLegend(classes);
    summary.textContent =
      mapSummary(
        selection,
        entries.map(({ country, value }) => ({ name: country.name, value })),
      ) + (selected ? ` Selected: ${countryLabel(metric, { name: selected.name, value: values.get(selected.iso3) ?? null })}.` : '');

    refreshTooltip();
  };

  // --- Tooltip -----------------------------------------------------------------------------

  /** What the tooltip is showing, so it can be rewritten when the Selection changes under it. */
  let tipped: SVGElement | undefined;
  /** Whether keyboard focus, rather than a pointer, put the tooltip up. */
  let tippedByFocus = false;

  const describe = (element: SVGElement): [name: string, value: string] => {
    const country = drawn.get(element.dataset.country ?? '');
    return country
      ? [country.name, formatMetric(metric, values.get(country.iso3) ?? null)]
      : [element.dataset.name ?? '', 'No data'];
  };

  const refreshTooltip = () => {
    if (!tipped) return;
    const [name, value] = describe(tipped);
    const nameLine = document.createElement('strong');
    nameLine.textContent = name;
    const valueLine = document.createElement('span');
    valueLine.textContent = value;
    tooltip.replaceChildren(nameLine, valueLine);
  };

  /** Shows the tooltip for a country, above a point given in page (client) coordinates. */
  const showTooltip = (element: SVGElement, clientX: number, clientY: number) => {
    tipped = element;
    refreshTooltip();
    tooltip.hidden = false;

    const box = frame.getBoundingClientRect();
    const gap = 12;
    const left = Math.min(Math.max(clientX - box.left - tooltip.offsetWidth / 2, 0), box.width - tooltip.offsetWidth);
    const above = clientY - box.top - tooltip.offsetHeight - gap;
    const top = above >= 0 ? above : clientY - box.top + gap + 8;
    tooltip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;

    const country = drawn.get(element.dataset.country ?? '');
    outline('hovered', country ? { d: country.shape?.getAttribute('d'), marker: country.marker } : { d: element.getAttribute('d') });
  };

  const hideTooltip = () => {
    tipped = undefined;
    tooltip.hidden = true;
    outline('hovered', {});
  };

  const countryAt = (target: EventTarget | null): SVGElement | null =>
    target instanceof SVGElement ? target.closest<SVGElement>('[data-country], [data-name]') : null;

  const onPointer = (event: PointerEvent) => {
    const element = countryAt(event.target);
    tippedByFocus = false;
    if (element) showTooltip(element, event.clientX, event.clientY);
    else hideTooltip();
  };
  svg.addEventListener('pointermove', onPointer);
  // A tap has no hover before it, so the press itself shows the tooltip.
  svg.addEventListener('pointerdown', onPointer);
  svg.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') hideTooltip();
  });

  svg.addEventListener('focusin', (event) => {
    const element = countryAt(event.target);
    const country = drawn.get(element?.dataset.country ?? '');
    if (!element || !country) return;
    setTabStop(country);
    // Only for keyboard focus: a click also focuses, and its tooltip is already at the pointer.
    if (!element.matches(':focus-visible')) return;
    const box = element.getBoundingClientRect();
    showTooltip(element, box.left + box.width / 2, box.top + Math.min(box.height / 2, 40));
    tippedByFocus = true;
  });
  // A pointer's tooltip stays: pressing a country moves the focus, which must not hide it.
  svg.addEventListener('focusout', () => {
    if (tippedByFocus) hideTooltip();
  });

  // --- Selecting ---------------------------------------------------------------------------

  const toggle = (iso3: string) => {
    store.update({ country: store.get().country === iso3 ? null : iso3 });
  };

  svg.addEventListener('click', (event) => {
    const element = countryAt(event.target);
    const iso3 = element?.dataset.country;
    if (iso3 && drawn.has(iso3)) toggle(iso3);
    // A click on the sea clears the country; one on a country without data changes nothing.
    else if (!element) store.update({ country: null });
  });

  svg.addEventListener('keydown', (event) => {
    const element = countryAt(event.target);
    const index = walk.findIndex((country) => country.iso3 === element?.dataset.country);
    if (index === -1) return;

    let next: number | undefined;
    if (event.key === 'Enter' || event.key === ' ') toggle(walk[index].iso3);
    else if (event.key === 'Escape') hideTooltip();
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % walk.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + walk.length) % walk.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = walk.length - 1;
    else return;

    event.preventDefault();
    if (next !== undefined) buttonOf(walk[next])?.focus();
  });

  store.subscribe(render);
  render(store.get());
}
