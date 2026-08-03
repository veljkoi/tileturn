# Tileturn

Tileturn is a movement-mechanics prototype for exploring how connected square tiles flip across geometric hinges. This first slice provides the fixed, portrait-oriented SVG board shell.

## Local development

Requires Node.js 22 or later.

```sh
npm install
npm run dev
```

Vite prints the local URL. To try the page from another device on the same network, run `npm run dev -- --host` and open the network URL on that device.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

The production output is written to `dist/`. Automated behavior tests are introduced with the movement slices, at the agreed geometry and browser seams.

## GitHub Pages

The deployment workflow builds and publishes the site whenever `main` changes. Once for the repository:

1. Open **Settings → Pages** on GitHub.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Push to `main` or manually run the **Deploy GitHub Pages** workflow.

The Vite build uses relative asset paths so the output works from the repository's Pages subpath.
