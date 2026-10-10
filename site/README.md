# AI Displacement Explorer: site

The static [Astro](https://astro.build) site for the AI Displacement Explorer. It currently holds
the editorial page design, the shared Selection and the data step that feeds both. Every chart and
view is still an empty, labelled frame.

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

## Design

The look is set by tokens in `src/styles/tokens.css`: page colours, the three font stacks, the type
scale, spacing, and the chart colours. Use the tokens; do not hard-code a colour or a font.

Chart colours:

| Token                                    | Use                                                        |
| :--------------------------------------- | :--------------------------------------------------------- |
| `--chart-series-1`, `--chart-series-1-text` | First series and the highlighted mark (blue)            |
| `--chart-series-2`, `--chart-series-2-text` | A second data series only (orange; `-text` for labels)  |
| `--chart-neutral`, `--chart-neutral-strong` | Bars, and dots or lines, that are not highlighted       |
| `--chart-grid`, `--chart-axis`, `--chart-band` | Grid lines, the zero line, shaded period bands       |
| `--chart-text`, `--chart-text-muted`, `--chart-text-strong` | Labels, axis ticks, values              |
| `--chart-no-data`                        | Countries the dataset does not cover                       |
| `--chart-ramp-1` to `--chart-ramp-5`     | Map colour steps, low to high                              |
| `--chart-bg`, `--chart-selected`         | Halo behind marks, outline of the selected country         |

Fonts are self-hosted through npm packages (`@fontsource-variable/newsreader`,
`@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`), imported in `src/layouts/BaseLayout.astro`.
Sans weights are 400, 500 and 600; mono 400 and 500. Another weight needs another import there.

### Plugging a chart into a chapter

Each Headline finding is a `<Chapter>` in `src/components/HeadlineFindings.astro`. The chapter already
has the chart's title, subtitle and source line; the chart goes in the `chart` slot and replaces the
empty frame:

```astro
<Chapter number={2} title="The Sector gap" chartTitle="..." chartSubtitle="...">
  <p>The finding's text.</p>
  <SectorGapChart slot="chart" />
</Chapter>
```

- The chart fills the width of its column, about 300px on a phone and 640px on a desktop. An inline
  `<svg>` with a `viewBox` is scaled to fit; do not give it a fixed width.
- Do not draw a title, subtitle or "Synthetic data" line inside the chart: the chapter has them.
- Other slots: `definition` (the aside defining terms) and `source` (an extra sentence after the
  standard source line).
- `explorerQuery` sets the Selection the "See this in the Explorer" link opens, as a query string such
  as `"?sector=administrative-clerical"`.
- Once the chart is in, `chartRatio` and `chartPlaceholder` only describe the empty frame and can go.

The four numbers in the summary strip are in `src/components/SummaryStrip.astro`.

### Where the views go in the Explorer panel

`src/components/Explorer.astro` lays out the tinted panel. Each region holds an `<EmptyFrame>`;
replace that with the real component and leave the wrapper in place.

| Region            | Element id           | What goes there                                              |
| :---------------- | :------------------- | :----------------------------------------------------------- |
| Selection sentence | `#explorer-sentence` | The Selection as a sentence with clickable words: the only control |
| Map               | `#explorer-map`      | The world map                                                |
| Slider            | `#explorer-slider`   | The quarter slider, in the map pane's `controls` slot        |
| Trend chart       | `#explorer-trend`    | The selected country against the global average              |
| Sector bars       | `#explorer-sectors`  | The ten Sectors ranked                                       |

The map, trend chart and Sector bars each sit in a `<ViewPane>`, which supplies the pane's title,
subtitle and source line. Titles change with the Selection, so a view rewrites them from its script
through the `[data-view-title]` and `[data-view-subtitle]` elements of its pane. The sentence region
sets the serif type for the sentence; the clickable words should use `--color-accent`.

On a phone the regions stack in the order above. From 640px the two charts sit side by side under the
map; from 980px the map is on the left and the charts are stacked on the right.
