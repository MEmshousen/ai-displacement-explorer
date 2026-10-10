import { defineConfig } from 'astro/config';
import { dataStep } from './src/data/step/integration';

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
  // Regenerates the Explorer data and the Headline findings from the CSV before every build and
  // before the dev server starts.
  integrations: [dataStep()],
});
