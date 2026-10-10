// @ts-check
import { defineConfig } from 'astro/config';

// The hosting URL is not decided yet. Set SITE_BASE to serve from a subpath
// (for example SITE_BASE=/AI_Displacement_Project on GitHub Pages) and
// SITE_URL to the full origin once it is known. Both are optional.
const base = process.env.SITE_BASE || '/';
const site = process.env.SITE_URL || undefined;

// https://astro.build/config
export default defineConfig({
  output: 'static',
  base,
  site,
});
