// The page's one Explorer data set and one Selection, shared by every view. Each view calls
// `explorerPage()` from its own script; the data is fetched once and the Selection is bound to
// the address bar once, however many views ask.

import { loadExplorer, type Explorer } from '../data/explorer';
import { browserUrl, createSelectionStore, type SelectionStore } from '../selection';

export interface ExplorerPage {
  readonly explorer: Explorer;
  readonly store: SelectionStore;
}

let page: Promise<ExplorerPage> | undefined;

export function explorerPage(): Promise<ExplorerPage> {
  page ??= loadExplorer().then((explorer) => ({
    explorer,
    store: createSelectionStore(explorer.choices, { url: browserUrl() }),
  }));
  return page;
}
