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

The site is served from `/` by default. To build for a subpath (for example a GitHub Pages project
site), set `SITE_BASE`:

```sh
SITE_BASE=/AI_Displacement_Project npm run build
```

`SITE_URL` can optionally be set to the full origin (for example `https://example.github.io`) once
hosting is decided. Link to assets and pages through `import.meta.env.BASE_URL` rather than a
hard-coded `/` so they keep working under a subpath.
