// The Headline findings, for Astro components to import at build time. The JSON is written by the
// data step (src/data/step) before every build, dev server start and check.

import generated from './generated/findings.json';
import type { Findings } from './shape';

export const findings: Findings = generated;
