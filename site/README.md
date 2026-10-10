# AI Displacement Explorer: site

The static [Astro](https://astro.build) site for the AI Displacement Explorer. It currently holds
the page scaffold (placeholder Headline findings and Explorer sections), the shared Selection and
the data step that feeds both.

Requires Node 22.12 or newer. Run every command from this `site/` folder.

| Command           | What it does                                    |
| :---------------- | :---------------------------------------------- |
| `npm install`     | Install dependencies                            |
| `npm run dev`     | Start the dev server at `http://localhost:4321` |
| `npm run build`   | Build the static site into `dist/`              |
| `npm run preview` | Serve the built `dist/` locally                 |
| `npm run check`   | Type-check `.astro` and TypeScript files        |
| `npm test`        | Run the unit tests                              |

## Data step

`build`, `dev` and `check` each start by regenerating the site's data from
`ai_workforce_displacement_global_2020_2026.csv` at the repo root (the `dataStep` integration in
`astro.config.ts`; code in `src/data/step/`). It writes two files, both gitignored and never
committed:

| File                               | Read by                                                           |
| :--------------------------------- | :---------------------------------------------------------------- |
| `public/data/explorer.json`        | The browser, through `loadExplorer()` in `src/data/explorer.ts`   |
| `src/data/generated/findings.json` | Astro at build time, through `findings` in `src/data/findings.ts` |

The step stops the build, saying what is wrong, unless the CSV has exactly one row for each of the
80 x 10 x 26 country, Sector and quarter cells and no blank value in a column it needs.

## Base path

The site is served from `/` by default. To build for a subpath (for example a GitHub Pages project
site), set `SITE_BASE`:

```sh
SITE_BASE=/AI_Displacement_Project npm run build
```

`SITE_URL` can optionally be set to the full origin (for example `https://example.github.io`) once
hosting is decided. Link to assets and pages through `import.meta.env.BASE_URL` rather than a
hard-coded `/` so they keep working under a subpath.
