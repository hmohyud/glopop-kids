# glopop-kids

The kids edition of the Glo Pop site. It starts as a copy of the "Paper Sun" design
(proposal 07 in [glow-pop](https://github.com/hmohyud/glow-pop), `redesign/07-paper-sun`).

Live site: https://hmohyud.github.io/glopop-kids/

## Layout

- `index.html`, `style.css`, `app.js`: the page
- `_shared/candy3d.js`: the 3D candy library, loaded on demand
- `_shared/assets/`: product photos plus the CC0 textures and HDRIs the 3D candy uses
  (credits in `_shared/assets/LICENSES.md`)

## Running it locally

There is no build step. Serve the folder over http so the 3D assets can load:

```bash
py -m http.server 4173
```

Then open http://localhost:4173/.

## Deploying

Every push to `main` publishes the repo root to GitHub Pages through
`.github/workflows/deploy.yml`.
