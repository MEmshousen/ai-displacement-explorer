# AI Displacement Explorer: site

The static [Astro](https://astro.build) site for the AI Displacement Explorer: one page with the
four Headline findings and their charts, then the Explorer (the Selection sentence, the world map
with its quarter slider, the trend chart and the Sector bars). The data step feeds both from the
CSV. The repo's root `README.md` describes the project as a whole.

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

The site is served from `/` by default. To build for a subpath (as the GitHub Pages deployment
does), set `SITE_BASE`:

```sh
SITE_BASE=/ai-displacement-explorer npm run build
```

`SITE_URL` can optionally be set to the full origin (for example `https://memshousen.github.io`).
Link to assets and pages through `import.meta.env.BASE_URL` rather than a hard-coded `/` so they
keep working under a subpath.

## Deploying

The site is published to <https://memshousen.github.io/ai-displacement-explorer/> by the GitHub
Actions workflow in [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). It runs on
every push to `main`, and can be started by hand from the repository's Actions tab ("Run workflow").

The workflow has two jobs:

1. **build** sets up Node 22, then runs `npm ci`, `npm run check`, `npm test` and `npm run build` in `site/`
   with `SITE_BASE=/ai-displacement-explorer` and `SITE_URL=https://memshousen.github.io`, and
   uploads `site/dist` as the Pages artifact. A failed type check or test stops the deployment.
2. **deploy** publishes that artifact with the official `deploy-pages` action.

Only one deployment runs at a time; a newer run waits for the one in progress.

To reproduce the deployed build locally:

```sh
SITE_BASE=/ai-displacement-explorer SITE_URL=https://memshousen.github.io npm run build
```

### One-time setup

Before the first deployment, set the Pages source in the repository on GitHub: **Settings → Pages →
Build and deployment → Source → GitHub Actions**. Until that is done the workflow fails at its
"Configure Pages" step. Nothing else needs configuring; the workflow uses no secrets.

## Design

The look is set by tokens in `src/styles/tokens.css`: page colours, the three font stacks, the type
scale, spacing, and the chart colours. Use the tokens; do not hard-code a colour or a font.

### Themes

There are two themes, light and dark, and they are one design: the same type, layout and rules, with
only the colour tokens changed. The dark theme is a cool near-black page with light ink and its own
accent, an electric mint in place of the light theme's blue; orange is still kept for a second data
series.

- The page follows the visitor's system setting (`prefers-color-scheme`) until they use the toggle in
  the masthead. The choice is kept in `localStorage` under `theme` and put on the root element as
  `data-theme="light"` or `data-theme="dark"`; the "System" button beside the toggle removes both.
  The logic is in `src/theme/theme.ts`.
- A small inline script in the head of `src/layouts/BaseLayout.astro` applies a stored choice before
  first paint, so the page never flashes the other theme.
- `tokens.css` holds the light values in `:root` and the dark values twice: under
  `:root[data-theme='dark']` (dark was chosen) and under `prefers-color-scheme: dark` for
  `:root:not([data-theme])` (no choice, and the system asks for dark). The two dark blocks must be
  identical; `src/styles/tokens.test.ts` fails if they are not, or if a colour is missing from one.
- Components never mention a theme. They read tokens, and that includes the charts: the Headline
  findings charts are static SVG styled by class in `src/findings/chart.css`, so nothing drawn at
  build time has a colour baked in.

To add a colour token, give it a light value in `:root` and a dark value in **both** dark blocks, then
use it as `var(--name)`. Check the pair it will be read against: text needs 4.5:1, chart text and
essential chart marks 3:1, in both themes. A token that is not a colour (a size, a space, a font)
goes in `:root` only.

Three things turn over between the themes and are worth knowing:

- **The handover band** uses the `--color-inverse` tokens, which are the reverse of the page: a black
  band with paper type in the light theme, a paper band with ink type in the dark one. The map's
  tooltip and the skip link use the same tokens.
- **The map ramp** runs from `--chart-ramp-1` (the weak end) to `--chart-ramp-5` (the strong end),
  and the strong end always marks "more": it is the darkest blue on the light page and the lightest
  on the dark one. The legend therefore names the end of the scale by its place ("The right-hand end
  of the scale marks the most Displacement"), never as "darker" or "lighter".
- **`--chart-selected`**, the outline of the selected country, is ink on the light page and white on
  the dark one.

Chart colours:

| Token                                    | Use                                                        |
| :--------------------------------------- | :--------------------------------------------------------- |
| `--chart-series-1`, `--chart-series-1-text` | First series and the highlighted mark (blue)            |
| `--chart-series-2`, `--chart-series-2-text` | A second data series only (orange; `-text` for labels)  |
| `--chart-neutral`, `--chart-neutral-strong` | Bars, and dots or lines, that are not highlighted       |
| `--chart-grid`, `--chart-axis`, `--chart-band` | Grid lines, the zero line, shaded period bands       |
| `--chart-text`, `--chart-text-muted`, `--chart-text-strong` | Labels, axis ticks, values              |
| `--chart-no-data`                        | Countries the dataset does not cover                       |
| `--chart-ramp-1` to `--chart-ramp-5`     | Map colour steps, weak end to strong end ("more")          |
| `--chart-bg`, `--chart-selected`         | Halo behind marks, outline of the selected country         |

Fonts are self-hosted through npm packages (`@fontsource-variable/newsreader`,
`@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`), imported in `src/layouts/BaseLayout.astro`.
Sans weights are 400, 500 and 600; mono 400 and 500. Another weight needs another import there.

### Plugging a chart into a chapter

Each Headline finding is a `<Chapter>` in `src/components/HeadlineFindings.astro`. The chapter already
has the chart's title, subtitle and source line; the chart goes in the `chart` slot. The four charts
are in `src/findings/`. A chapter with nothing in that slot shows an empty, labelled frame:

```astro
<Chapter number={2} title="The Sector gap" chartTitle="..." chartSubtitle="...">
  <p>The finding's text.</p>
  <SectorGapBars slot="chart" />
</Chapter>
```

- The chart fills the width of its column, about 300px on a phone and 640px on a desktop. An inline
  `<svg>` with a `viewBox` is scaled to fit; do not give it a fixed width.
- Do not draw a title, subtitle or "Synthetic data" line inside the chart: the chapter has them.
- Other slots: `definition` (the aside defining terms) and `source` (an extra sentence after the
  standard source line).
- `explorerQuery` sets the Selection the "See this in the Explorer" link opens, as a query string such
  as `"?sector=administrative-clerical"`.
- `chartRatio` and `chartPlaceholder` only describe the empty frame, so a chapter with a chart does
  not need them.

The four numbers in the summary strip are in `src/components/SummaryStrip.astro`. They and the
numbers in the chapters' text are read from the findings data, never typed in; the build stops if
the fixed wording around them no longer matches the data (`wordingProblems` in
`src/findings/facts.ts`).

### Where the views go in the Explorer panel

`src/components/Explorer.astro` lays out the tinted panel. Each region holds its view's component,
from the matching folder under `src/explorer/` (`sentence/`, `map/`, `trend/`, `sectors/`).

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

Each pane reads the same way: a title, a subtitle that is a phrase with no full stop saying what is
measured, the view, one small `.hint` line saying what choosing something does, then the source line.
Numbers go through `formatMetric`, which writes a negative with a true minus sign (U+2212), as the
Headline findings do.

Widths:

| Width          | Layout                                                                              |
| :------------- | :---------------------------------------------------------------------------------- |
| Under 640px    | Phone: the regions stack in the order above; the sentence is the only control        |
| 640px to 819px | The same stack, with the pinned countries under the sentence                         |
| 820px to 979px | The map full width, the two charts side by side under it                             |
| From 980px     | The map on the left, the two charts stacked on the right                             |

On a phone there is no pinning (`PHONE_QUERY` in `src/explorer/page.ts`): the pinned countries are
hidden under the sentence and left off the trend chart, but a link that carries them keeps them in
its address, so they are back on a wider screen. Up to 979px, and on any touch screen, every control
in the Explorer is at least 44px tall. The map's countries are the exception, since most are only a
few pixels across on a phone: the sentence's country picker reaches all 80, and a tap near a small
country's marker counts as a tap on it.
