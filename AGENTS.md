# 17tons Website Instructions

## Scope
- This repository is a React/Vite recreation of `https://17tons.earth`.
- The app renders captured Elementor page markup from `src/generated/pages.js` through React.
- Runtime assets are local under `public/live-assets/`; do not introduce external asset references unless explicitly requested.

## Snapshot Flow
- `npm run snapshot` fetches the live 17tons pages, rewrites HTML/CSS asset URLs to local paths, downloads assets, and regenerates:
  - `src/generated/pages.js`
  - `src/styles/live.css`
  - `public/live-assets/`
- The snapshot script intentionally contains the live source origin for regeneration.

## Routing And Deployment
- `src/App.jsx` handles SPA routing for canonical paths and short aliases.
- `vercel.json` rewrites all routes to `/index.html` so direct deep links work on Vercel.
- Vercel project: `sebastiano-6026s-projects/17tons-website`.

## Verification
- Run `npm run build` after changes.
- For routing or visual changes, verify with browser automation on desktop and mobile viewports.
- Keep `dist/`, `.vercel/`, logs, and local test artifacts out of git.
