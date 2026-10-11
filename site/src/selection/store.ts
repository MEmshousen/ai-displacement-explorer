import {
  applyPatch,
  defaultSelection,
  parseSelection,
  sameSelection,
  serialiseSelection,
  type Selection,
  type SelectionPatch,
  type ValidChoices,
} from './selection';

/** 'push' adds a browser history entry; 'replace' overwrites the current one. */
export type HistoryMode = 'push' | 'replace';

/** The store's view of the address bar. `browserUrl()` is the real one; tests pass a fake. */
export interface UrlBinding {
  /** The current query string, "" or "?...". */
  read(): string;
  write(search: string, mode: HistoryMode): void;
  /** Calls `listener` on browser back and forward. Returns a function that stops listening. */
  onNavigate(listener: () => void): () => void;
}

export interface SelectionStore {
  get(): Selection;
  /**
   * Changes some fields of the Selection. Invalid values are ignored field by field. Pass
   * `{ history: 'replace' }` for rapid changes (dragging a quarter slider) so that back does
   * not have to step through every one.
   */
  update(patch: SelectionPatch, options?: { history?: HistoryMode }): void;
  /** Calls `listener` after each change, not on subscribing. Returns an unsubscribe function. */
  subscribe(listener: (selection: Selection) => void): () => void;
  /** Stops listening for back and forward. */
  destroy(): void;
}

/** Binds to the real address bar. The path and hash are kept, so the site's base path is too. */
export function browserUrl(win: Window = window): UrlBinding {
  return {
    read: () => win.location.search,
    write(search, mode) {
      const url = win.location.pathname + search + win.location.hash;
      if (mode === 'push') win.history.pushState(null, '', url);
      else win.history.replaceState(null, '', url);
    },
    onNavigate(listener) {
      win.addEventListener('popstate', listener);
      return () => win.removeEventListener('popstate', listener);
    },
  };
}

/**
 * Creates the shared Selection. With a `url` binding the Selection starts from the query string
 * and the two stay in step from then on; without one it starts at the defaults.
 */
export function createSelectionStore(
  choices: ValidChoices,
  { url }: { url?: UrlBinding } = {},
): SelectionStore {
  const listeners = new Set<(selection: Selection) => void>();
  let selection = url ? parseSelection(url.read(), choices) : defaultSelection(choices);

  const writeUrl = (mode: HistoryMode) => {
    if (!url) return;
    const current = url.read();
    const next = serialiseSelection(selection, choices, current);
    if (next !== current) url.write(next, mode);
  };

  const set = (next: Selection) => {
    if (sameSelection(next, selection)) return false;
    selection = next;
    return true;
  };

  const notify = () => {
    for (const listener of [...listeners]) listener(selection);
  };

  // Tidy an address that arrived with invalid, default or out-of-order parameters.
  writeUrl('replace');

  const stopListening = url?.onNavigate(() => {
    if (set(parseSelection(url.read(), choices))) notify();
  });

  return {
    get: () => selection,
    update(patch, { history = 'push' } = {}) {
      if (!set(applyPatch(selection, patch, choices))) return;
      writeUrl(history);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => stopListening?.(),
  };
}
