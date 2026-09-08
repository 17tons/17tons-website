# 17tons Website Instructions

## Scope
- This repository is a React/Vite recreation of `https://17tons.earth`.
- The app renders captured Elementor page markup from `src/generated/pages.js` through React.
- Runtime assets are local under `public/live-assets/`; do not introduce external asset references unless explicitly requested.
- English and Italian translations are maintained under `src/i18n/`. Keep translations outside generated snapshot files and run the translation coverage check after snapshot regeneration.

## Snapshot Flow
- `npm run snapshot` fetches the live 17tons pages, rewrites HTML/CSS asset URLs to local paths, downloads assets, and regenerates:
  - `src/generated/pages.js`
  - `src/styles/live.css`
  - `public/live-assets/`
- The snapshot script intentionally contains the live source origin for regeneration.

## Routing And Deployment
- `src/App.jsx` handles SPA routing for canonical paths and short aliases.
- `src/i18n/routing.js` resolves `/en/` and `/it/` routes, legacy aliases and unknown pages. Explicit URL language takes precedence over stored and browser preferences; preserve query strings and fragments during locale changes.
- React UI copy and page metadata live in `src/i18n/messages.js`; React components consume them through `useI18n()` in `LocaleContext.jsx`. Snapshot text and accessibility attributes are localized before rendering in `src/i18n/index.js`.
- Keep the `dangerouslySetInnerHTML` value memoized with its source HTML. Unrelated state changes, especially the contact dialog, must not replace the snapshot DOM and discard menu listeners or initialized marquees.
- The contact dialog has no message-delivery backend. Do not describe opening or submitting this form as confirmed message delivery.
- `vercel.json` rewrites all routes to `/index.html` so direct deep links work on Vercel.
- Vercel project: `sebastiano-6026s-projects/17tons-website`.

## Verification
- Run `npm run build` after changes.
- Run `npm test` for locale/routing changes and `npm run test:i18n` against the running site for translation coverage and desktop/mobile browser checks. See `README.md` for production-preview verification.
- For routing or visual changes, verify with browser automation on desktop and mobile viewports.
- For header navigation changes, run `npm run test:menus` to verify real pointer travel into dropdowns, all submenu links, and keyboard dismissal. Preserve a continuous hoverable area between each trigger and its panel.
- The full menu suite covers all six source pages in both languages, contact-dialog lifecycle, history, current-page selection, language switching, the home logo and an intercepted LinkedIn destination. Run with `BROWSER=webkit` on a supported platform for WebKit coverage; `test:menus:smoke` is not a substitute for the full suite.
- Keep `dist/`, `.vercel/`, logs, and local test artifacts out of git.
