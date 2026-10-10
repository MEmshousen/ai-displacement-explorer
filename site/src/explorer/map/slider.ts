// The quarter slider and its play button, in the browser. Both write the quarter to the shared
// Selection with { history: 'replace' }, so back does not step through every quarter.

import { explorerPage } from '../page';
import type { Selection } from '../../selection';

/** How long each quarter stays on screen while playing. */
const STEP_MS = 700;

export async function mountSlider(root: HTMLElement): Promise<void> {
  const input = root.querySelector<HTMLInputElement>('[data-quarter-input]')!;
  const now = root.querySelector<HTMLElement>('[data-quarter-now]')!;
  const button = root.querySelector<HTMLButtonElement>('[data-play]')!;
  const icon = root.querySelector<HTMLElement>('[data-play-icon]')!;
  const label = root.querySelector<HTMLElement>('[data-play-label]')!;

  const { explorer, store } = await explorerPage();
  const { quarters } = explorer.choices;
  const last = quarters.length - 1;

  let timer: ReturnType<typeof setInterval> | undefined;
  /** The quarter play last set; any other quarter arriving means someone else changed it. */
  let played: string | undefined;

  const showPlaying = (playing: boolean) => {
    icon.textContent = playing ? '❚❚' : '▶';
    label.textContent = playing ? 'Pause' : 'Play';
  };

  const stop = () => {
    clearInterval(timer);
    timer = undefined;
    showPlaying(false);
  };

  const goTo = (index: number) => {
    played = quarters[index];
    store.update({ quarter: played }, { history: 'replace' });
    if (index >= last) stop();
  };

  const play = () => {
    const index = quarters.indexOf(store.get().quarter);
    timer = setInterval(() => goTo(quarters.indexOf(store.get().quarter) + 1), STEP_MS);
    showPlaying(true);
    // From the latest quarter, start again at the first; from anywhere else, carry on.
    goTo(index >= last ? 0 : index + 1);
  };

  const render = (selection: Selection) => {
    if (timer !== undefined && selection.quarter !== played) stop();
    input.value = String(quarters.indexOf(selection.quarter));
    input.setAttribute('aria-valuetext', selection.quarter);
    now.textContent = selection.quarter;
  };

  input.addEventListener('input', () => {
    stop();
    store.update({ quarter: quarters[Number(input.value)] }, { history: 'replace' });
  });
  button.addEventListener('click', () => (timer === undefined ? play() : stop()));

  input.max = String(last);
  input.disabled = false;
  button.disabled = false;
  store.subscribe(render);
  render(store.get());
}
