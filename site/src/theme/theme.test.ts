import { describe, expect, it } from 'vitest';
import { otherTheme, parseChoice, resolveTheme, toggleWords } from './theme';

describe('parseChoice', () => {
  it('reads a stored theme', () => {
    expect(parseChoice('light')).toBe('light');
    expect(parseChoice('dark')).toBe('dark');
  });

  it('treats nothing stored, and anything else, as no choice', () => {
    expect(parseChoice(null)).toBeNull();
    expect(parseChoice(undefined)).toBeNull();
    expect(parseChoice('')).toBeNull();
    expect(parseChoice('system')).toBeNull();
    expect(parseChoice('Dark')).toBeNull();
  });
});

describe('resolveTheme', () => {
  it('follows the system setting when no choice is stored', () => {
    expect(resolveTheme(null, false)).toBe('light');
    expect(resolveTheme(null, true)).toBe('dark');
  });

  it('puts a stored choice ahead of the system setting', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', true)).toBe('dark');
  });
});

describe('the toggle', () => {
  it('switches to the theme that is not showing', () => {
    expect(otherTheme('light')).toBe('dark');
    expect(otherTheme('dark')).toBe('light');
  });

  it('says what it will do, with its visible word inside its accessible name', () => {
    for (const target of ['light', 'dark'] as const) {
      const { text, name } = toggleWords(target);
      expect(name).toBe(`Switch to ${target} theme`);
      expect(name.toLowerCase()).toContain(text.toLowerCase());
    }
  });
});
