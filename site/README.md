# AI Displacement Explorer: site

The static [Astro](https://astro.build) site for the AI Displacement Explorer. It currently holds
only the page scaffold: placeholder Headline findings and Explorer sections.

Requires Node 22.12 or newer. Run every command from this `site/` folder.

| Command           | What it does                                    |
| :---------------- | :---------------------------------------------- |
| `npm install`     | Install dependencies                            |
| `npm run dev`     | Start the dev server at `http://localhost:4321` |
| `npm run build`   | Build the static site into `dist/`              |
| `npm run preview` | Serve the built `dist/` locally                 |
| `npm run check`   | Type-check `.astro` and TypeScript files        |

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

1. **build** sets up Node 22, then runs `npm ci`, `npm run check` and `npm run build` in `site/`
   with `SITE_BASE=/ai-displacement-explorer` and `SITE_URL=https://memshousen.github.io`, and
   uploads `site/dist` as the Pages artifact. A failed type check stops the deployment.
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
