import { describe, expect, it, vi } from 'vitest';
import type { ValidChoices } from './selection';
import { browserUrl, createSelectionStore, type UrlBinding } from './store';

const choices: ValidChoices = {
  sectors: ['Finance & Banking', 'Technology & Software'],
  quarters: ['2025-Q4', '2026-Q1', '2026-Q2'],
  countries: ['USA', 'DEU', 'JPN', 'IND'],
};

/** An address bar with a history stack, standing in for the browser. */
function fakeUrl(initialSearch = '') {
  const entries = [initialSearch];
  let index = 0;
  const listeners = new Set<() => void>();
  const go = (delta: number) => {
    index = Math.min(Math.max(index + delta, 0), entries.length - 1);
    for (const listener of listeners) listener();
  };
  const binding: UrlBinding = {
    read: () => entries[index]!,
    write(search, mode) {
      if (mode === 'push') entries.splice(++index, Infinity, search);
      else entries[index] = search;
    },
    onNavigate(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { binding, entries, back: () => go(-1), forward: () => go(1) };
}

describe('the Selection store', () => {
  it('starts at the defaults without a URL', () => {
    const store = createSelectionStore(choices);
    expect(store.get()).toEqual({
      metric: 'displacement',
      sector: null,
      quarter: '2026-Q2',
      country: null,
      pinned: [],
    });
  });

  it('updates and tells subscribers', () => {
    const store = createSelectionStore(choices);
    const listener = vi.fn();
    store.subscribe(listener);

    store.update({ metric: 'net-change', country: 'USA' });

    expect(store.get()).toMatchObject({ metric: 'net-change', country: 'USA' });
    expect(listener).toHaveBeenCalledExactlyOnceWith(store.get());
  });

  it('stays quiet when an update changes nothing', () => {
    const store = createSelectionStore(choices);
    const listener = vi.fn();
    store.subscribe(listener);

    store.update({ metric: 'displacement' });
    store.update({ country: 'XXX' });
    store.update({});

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops telling a listener that unsubscribed', () => {
    const store = createSelectionStore(choices);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.update({ country: 'USA' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('never holds more than three pinned countries, or the same one twice', () => {
    const store = createSelectionStore(choices);
    store.update({ pinned: ['USA', 'DEU', 'JPN'] });
    store.update({ pinned: [...store.get().pinned, 'IND'] });
    expect(store.get().pinned).toEqual(['USA', 'DEU', 'JPN']);

    store.update({ pinned: ['USA', 'USA', 'DEU'] });
    expect(store.get().pinned).toEqual(['USA', 'DEU']);
  });
});

describe('URL sync', () => {
  it('starts from the query string', () => {
    const url = fakeUrl('?metric=replacement-rate&sector=finance-banking&pin=JPN');
    const store = createSelectionStore(choices, { url: url.binding });
    expect(store.get()).toMatchObject({
      metric: 'replacement-rate',
      sector: 'Finance & Banking',
      pinned: ['JPN'],
    });
    expect(url.entries).toEqual(['?metric=replacement-rate&sector=finance-banking&pin=JPN']);
  });

  it('tidies an invalid address in place, without adding a history entry', () => {
    const url = fakeUrl('?metric=nope&country=usa&quarter=2026-Q2&ref=cv');
    createSelectionStore(choices, { url: url.binding });
    expect(url.entries).toEqual(['?ref=cv&country=USA']);
  });

  it('writes each update as a new history entry', () => {
    const url = fakeUrl();
    const store = createSelectionStore(choices, { url: url.binding });

    store.update({ country: 'DEU' });
    store.update({ quarter: '2025-Q4' });

    expect(url.entries).toEqual(['', '?country=DEU', '?quarter=2025-Q4&country=DEU']);
  });

  it('returns to the bare address when the Selection returns to the defaults', () => {
    const url = fakeUrl('?country=DEU');
    const store = createSelectionStore(choices, { url: url.binding });
    store.update({ country: null });
    expect(url.binding.read()).toBe('');
  });

  it('can replace the current history entry instead', () => {
    const url = fakeUrl();
    const store = createSelectionStore(choices, { url: url.binding });

    store.update({ quarter: '2026-Q1' }, { history: 'replace' });
    store.update({ quarter: '2025-Q4' }, { history: 'replace' });

    expect(url.entries).toEqual(['?quarter=2025-Q4']);
  });

  it('does not touch the URL when an update changes nothing', () => {
    const url = fakeUrl('?country=DEU');
    const store = createSelectionStore(choices, { url: url.binding });
    store.update({ country: 'DEU' });
    store.update({ country: 'nowhere' });
    expect(url.entries).toEqual(['?country=DEU']);
  });

  it('follows browser back and forward', () => {
    const url = fakeUrl();
    const store = createSelectionStore(choices, { url: url.binding });
    const listener = vi.fn();
    store.update({ country: 'DEU' });
    store.update({ metric: 'net-change' });
    store.subscribe(listener);

    url.back();
    expect(store.get()).toMatchObject({ metric: 'displacement', country: 'DEU' });
    url.back();
    expect(store.get()).toMatchObject({ metric: 'displacement', country: null });
    url.forward();
    expect(store.get()).toMatchObject({ metric: 'displacement', country: 'DEU' });

    expect(listener).toHaveBeenCalledTimes(3);
    // Navigating reads the URL; it must not write new entries.
    expect(url.entries).toEqual(['', '?country=DEU', '?metric=net-change&country=DEU']);
  });

  it('stops following the URL once destroyed', () => {
    const url = fakeUrl();
    const store = createSelectionStore(choices, { url: url.binding });
    store.update({ country: 'DEU' });
    store.destroy();
    url.back();
    expect(store.get().country).toBe('DEU');
  });
});

describe('browserUrl', () => {
  it('keeps the base path and hash when it writes', () => {
    const pushState = vi.fn();
    const replaceState = vi.fn();
    const win = {
      location: { pathname: '/ai-displacement-explorer/', search: '?country=USA', hash: '#explorer' },
      history: { pushState, replaceState },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window;
    const url = browserUrl(win);

    expect(url.read()).toBe('?country=USA');
    url.write('?country=DEU', 'push');
    url.write('', 'replace');

    expect(pushState).toHaveBeenCalledWith(null, '', '/ai-displacement-explorer/?country=DEU#explorer');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/ai-displacement-explorer/#explorer');
  });

  it('listens for popstate until told to stop', () => {
    const win = { addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as Window;
    const listener = () => {};
    const stop = browserUrl(win).onNavigate(listener);
    expect(win.addEventListener).toHaveBeenCalledWith('popstate', listener);
    stop();
    expect(win.removeEventListener).toHaveBeenCalledWith('popstate', listener);
  });
});
