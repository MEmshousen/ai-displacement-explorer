// The page's one Explorer data set and one Selection, shared by every view. Each view calls
// `explorerPage()` from its own script; the data is fetched once and the Selection is bound to
// the address bar once, however many views ask.

import { loadExplorer, type Explorer } from '../data/explorer';
import { browserUrl, createSelectionStore, type SelectionStore } from '../selection';

export interface ExplorerPage {
  readonly explorer: Explorer;
  readonly store: SelectionStore;
}

/**
 * The widths at which the Explorer is the phone version: the Selection sentence is the only
 * control and there is no pinning. The same width is written out in the sentence's stylesheet
 * (SelectionSentence.astro), which hides the pinned countries there.
 */
export const PHONE_QUERY = '(max-width: 639px)';

let page: Promise<ExplorerPage> | undefined;

export function explorerPage(): Promise<ExplorerPage> {
  page ??= loadExplorer().then((explorer) => ({
    explorer,
    store: createSelectionStore(explorer.choices, { url: browserUrl() }),
  }));
  return page;
}
