// The light and dark themes. The page follows the visitor's system setting until they choose a
// theme with the toggle in the masthead; the choice is kept in localStorage and put on the root
// element as `data-theme`, which tokens.css reads. With no choice there is no attribute, and the
// stylesheet follows the system through prefers-color-scheme.
//
// The pure functions here are tested; the rest touches the browser and never throws, so the page
// works the same where storage is blocked.

export type Theme = 'light' | 'dark';

/** Where the choice is kept. The script in BaseLayout's head reads the same key before first paint. */
export const THEME_STORAGE_KEY = 'theme';

/** The system setting the stylesheet's dark tokens answer to. */
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

/** A stored value as a choice: null for nothing stored, or anything this site did not write. */
export function parseChoice(stored: string | null | undefined): Theme | null {
  return stored === 'light' || stored === 'dark' ? stored : null;
}

/** The theme on screen: the visitor's choice if they made one, or else the system setting. */
export function resolveTheme(choice: Theme | null, systemDark: boolean): Theme {
  return choice ?? (systemDark ? 'dark' : 'light');
}

/** The theme the toggle switches to. */
export function otherTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

/** The toggle's words for the theme it switches to: what it shows, and its accessible name. */
export function toggleWords(target: Theme): { text: string; name: string } {
  return target === 'dark'
    ? { text: 'Dark', name: 'Switch to dark theme' }
    : { text: 'Light', name: 'Switch to light theme' };
}

/** The stored choice; null if there is none or storage cannot be read. */
export function readChoice(): Theme | null {
  try {
    return parseChoice(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Keeps the choice, or forgets it for null. The theme still changes if storage cannot be written. */
function storeChoice(choice: Theme | null): void {
  try {
    if (choice) localStorage.setItem(THEME_STORAGE_KEY, choice);
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Private browsing or blocked storage: the choice lasts until the page is left.
  }
}

/** Puts a choice on the root element, or takes it off so the page follows the system again. */
function applyChoice(choice: Theme | null): void {
  const root = document.documentElement;
  if (choice) root.dataset.theme = choice;
  else delete root.dataset.theme;
}

/**
 * Wires the masthead's two buttons: `toggle` switches to the other theme, and `system`, shown only
 * while a choice is in force, goes back to following the system setting.
 */
export function mountThemeToggle(toggle: HTMLButtonElement, system: HTMLButtonElement): void {
  const systemDark = matchMedia(SYSTEM_DARK_QUERY);
  // The head script has already applied a stored choice; a choice that could not be stored lives
  // on the root element alone, so that is where the current one is read from.
  const choice = () => parseChoice(document.documentElement.dataset.theme);

  const show = () => {
    const { text, name } = toggleWords(otherTheme(resolveTheme(choice(), systemDark.matches)));
    toggle.textContent = text;
    toggle.setAttribute('aria-label', name);
    system.hidden = choice() === null;
  };
  const choose = (next: Theme | null) => {
    applyChoice(next);
    storeChoice(next);
    show();
  };

  toggle.addEventListener('click', () => choose(otherTheme(resolveTheme(choice(), systemDark.matches))));
  system.addEventListener('click', () => {
    choose(null);
    // The button is about to be hidden, and focus must not be lost with it.
    toggle.focus();
  });
  systemDark.addEventListener('change', show);
  // A choice made in another tab of the site.
  addEventListener('storage', (event) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    applyChoice(readChoice());
    show();
  });

  show();
  toggle.hidden = false;
}
