import { defineConfig } from 'astro/config';
import { dataStep } from './src/data/step/integration';

// Served from / by default. The GitHub Pages deploy sets SITE_BASE=/ai-displacement-explorer
// and SITE_URL=https://memshousen.github.io. Both are optional.
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
