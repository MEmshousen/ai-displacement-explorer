// The browser's side of the Selection sentence: fills the pickers from the Explorer data, keeps the
// words and the pinned countries in step with the shared Selection, and writes the visitor's
// choices back to it. The markup it drives is in SelectionSentence.astro.

import type { Explorer } from '../../data/explorer';
import type { Selection, SelectionStore } from '../../selection';
import {
  countriesByRegion,
  NONE,
  pinning,
  sentence,
  SENTENCE_FIELDS,
  withoutPin,
  withPin,
  type ChoiceGroup,
} from './wording';

function appendGroups(select: HTMLSelectElement, groups: readonly ChoiceGroup[]): void {
  for (const { label, choices } of groups) {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const choice of choices) group.append(new Option(choice.label, choice.value));
    select.append(group);
  }
}

export function mountSentence(root: HTMLElement, explorer: Explorer, store: SelectionStore): void {
  const one = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const name = (iso3: string) => explorer.country(iso3)?.name ?? iso3;

  const gaps = [...root.querySelectorAll<HTMLElement>('[data-gap]')];
  const words = SENTENCE_FIELDS.map((field) => ({
    field,
    text: one<HTMLElement>(`[data-word="${field}"]`),
    picker: one<HTMLSelectElement>(`select[data-field="${field}"]`),
  }));

  const pinList = one<HTMLUListElement>('[data-pin-list]');
  const pinCount = one<HTMLElement>('[data-pin-count]');
  const pinSelected = one<HTMLButtonElement>('[data-pin-selected]');
  const pinAdd = one<HTMLSelectElement>('[data-pin-add]');
  const pinFull = one<HTMLElement>('[data-pin-full]');
  const pinStatus = one<HTMLElement>('[data-pin-status]');

  const regions = countriesByRegion(explorer.countries);
  appendGroups(one<HTMLSelectElement>('select[data-field="country"]'), regions);
  appendGroups(pinAdd, regions);

  const removeButtons = () => [...pinList.querySelectorAll<HTMLButtonElement>('button')];

  const render = (selection: Selection) => {
    const written = sentence(selection, selection.country === null ? undefined : name(selection.country));
    gaps.forEach((gap, index) => (gap.textContent = written.gaps[index]));
    for (const { field, text, picker } of words) {
      text.textContent = written.words[field];
      picker.value = selection[field] ?? NONE;
    }

    const { full, count, selectedToPin } = pinning(selection);
    pinCount.textContent = count;
    pinList.replaceChildren(
      ...selection.pinned.map((code) => {
        const item = document.createElement('li');
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.dataset.unpin = code;
        remove.setAttribute('aria-label', `Unpin ${name(code)}`);
        remove.textContent = '×';
        item.append(name(code), remove);
        return item;
      }),
    );
    pinList.hidden = selection.pinned.length === 0;

    pinSelected.hidden = selectedToPin === null;
    pinSelected.textContent = selectedToPin === null ? '' : `Pin ${name(selectedToPin)}`;
    pinAdd.hidden = full;
    pinFull.hidden = !full;
    for (const option of pinAdd.options) {
      const pinned = selection.pinned.includes(option.value);
      option.disabled = pinned;
      option.hidden = pinned;
    }
    pinAdd.value = NONE;
  };

  for (const { field, picker } of words) {
    picker.addEventListener('change', () => {
      store.update({ [field]: picker.value === NONE ? null : picker.value });
    });
  }

  /** Pins a country, then puts keyboard focus on a control that is still there. */
  const pin = (code: string) => {
    store.update({ pinned: withPin(store.get().pinned, code) });
    const { pinned } = store.get();
    pinStatus.textContent = `${name(code)} pinned. ${pinning(store.get()).count}.`;
    if (pinAdd.hidden) removeButtons()[pinned.length - 1]?.focus();
    else pinAdd.focus();
  };

  pinSelected.addEventListener('click', () => {
    const { selectedToPin } = pinning(store.get());
    if (selectedToPin !== null) pin(selectedToPin);
  });
  pinAdd.addEventListener('change', () => {
    if (pinAdd.value !== NONE) pin(pinAdd.value);
  });
  pinList.addEventListener('click', (event) => {
    const code = (event.target as Element).closest<HTMLButtonElement>('button[data-unpin]')?.dataset.unpin;
    if (code === undefined) return;
    const position = store.get().pinned.indexOf(code);
    store.update({ pinned: withoutPin(store.get().pinned, code) });
    pinStatus.textContent = `${name(code)} unpinned. ${pinning(store.get()).count}.`;
    const remaining = removeButtons();
    (remaining[position] ?? remaining.at(-1) ?? pinAdd).focus();
  });

  render(store.get());
  store.subscribe(render);

  for (const control of root.querySelectorAll<HTMLSelectElement>('select')) control.disabled = false;
}
