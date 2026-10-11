// Runs the data step as part of Astro itself, so `astro build`, `astro dev` and `astro check`
// regenerate the data however they are started. Needs nothing but Node.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import type { AstroIntegration } from 'astro';
import { CSV_NAME, readDataset } from './dataset';
import { buildExplorerData, buildFindings } from './outputs';

/** Where the step reads and writes, relative to the site folder. Both outputs are gitignored. */
export const PATHS = {
  csv: `../${CSV_NAME}`,
  /** Served as a static file; see `explorerDataUrl` in ../explorer.ts. */
  explorer: 'public/data/explorer.json',
  /** Imported by ../findings.ts. */
  findings: 'src/data/generated/findings.json',
} as const;

export interface DataStepResult {
  readonly cells: number;
  readonly explorerBytes: number;
  readonly explorerGzipBytes: number;
  readonly findingsBytes: number;
}

/** Reads the CSV and writes both files. Throws, writing nothing, if the CSV cannot be used. */
export function runDataStep(siteRoot: URL): DataStepResult {
  let csvText: string;
  try {
    csvText = readFileSync(new URL(PATHS.csv, siteRoot), 'utf8');
  } catch (cause) {
    throw new Error(`Data step failed: could not read ${CSV_NAME} at the repo root.`, { cause });
  }

  const dataset = readDataset(csvText);
  const explorer = JSON.stringify(buildExplorerData(dataset));
  const findings = JSON.stringify(buildFindings(dataset), null, 2) + '\n';

  for (const [path, content] of [
    [PATHS.explorer, explorer],
    [PATHS.findings, findings],
  ] as const) {
    const file = new URL(path, siteRoot);
    mkdirSync(new URL('.', file), { recursive: true });
    writeFileSync(file, content);
  }

  return {
    cells: dataset.countries.length * dataset.sectors.length * dataset.quarters.length,
    explorerBytes: Buffer.byteLength(explorer),
    explorerGzipBytes: gzipSync(explorer).byteLength,
    findingsBytes: Buffer.byteLength(findings),
  };
}

export function dataStep(): AstroIntegration {
  return {
    name: 'data-step',
    hooks: {
      'astro:config:setup': ({ config, command, addWatchFile, logger }) => {
        // `astro preview` only serves what a build already made.
        if (command === 'preview') return;

        const result = runDataStep(config.root);
        const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`;
        logger.info(
          `${result.cells.toLocaleString('en-US')} cells -> ${PATHS.explorer} ` +
            `(${kb(result.explorerBytes)}, ${kb(result.explorerGzipBytes)} gzip), ` +
            `${PATHS.findings} (${kb(result.findingsBytes)})`,
        );
        // Restart the dev server, and so rerun the step, when the CSV changes.
        addWatchFile(new URL(PATHS.csv, config.root));
      },
    },
  };
}
