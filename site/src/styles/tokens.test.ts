import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the first rule whose selector is `selector`, as "property: value" lines. */
function declarations(selector: string): string[] {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return body
    .split(';')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}
const names = (lines: string[]) => lines.map((line) => line.split(':')[0]);

describe('the dark theme tokens', () => {
  const light = declarations(':root');
  const chosen = declarations(":root[data-theme='dark']");
  const system = declarations(':root:not([data-theme])');

  it('are the same for a visitor who chose dark and one whose system asks for it', () => {
    expect(system).toEqual(chosen);
  });

  it('set color-scheme', () => {
    expect(light).toContain('color-scheme: light');
    expect(chosen).toContain('color-scheme: dark');
  });

  it('override every colour of the light theme, and nothing the light theme does not have', () => {
    const colours = names(light).filter((name) => name.startsWith('--color-') || name.startsWith('--chart-'));
    expect(names(chosen).filter((name) => name !== 'color-scheme').sort()).toEqual(colours.sort());
  });
});
