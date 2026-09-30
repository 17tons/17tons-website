# 17tons Website Instructions

## Scope
- This repository is a React/Vite recreation of `https://17tons.earth`.
- The app renders captured Elementor page markup from `src/generated/pages.js` through React.
- Runtime assets are local under `public/live-assets/`; do not introduce external asset references unless explicitly requested.
- `DESIGN.md` holds the colors, fonts, spacing, component styles and icon rules. Read it before any UI change and add new patterns to it.
- The favicons in `public/` (`favicon.ico`, `favicon-32x32.png`, `icon-192.png`, `apple-touch-icon.png`) are cut from the logo's two-coin mark and linked from `index.html`; regenerate them from the logo if it changes.
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
- The catalogue is keyed by source text, so a string the snapshot shares across two elements cannot carry two translations. `src/i18n/overrides.js` maps per-widget overrides by Elementor `data-id`, resolved before the catalogue; add an entry only for a real collision and keep the catalogue value for the other element.
- Localization also repairs snapshot link defects: the reCAPTCHA policy links captured as `#` are restored to the Google URLs, and `target` is removed from contact-page links so every trigger opens the in-app dialog instead of a new tab.
- Keep the `dangerouslySetInnerHTML` value memoized with its source HTML. Unrelated state changes, especially the contact dialog, must not replace the snapshot DOM and discard menu listeners or initialized marquees.
- The contact dialog posts to the Lambda `17tons-website-contact` (`server/contact/aws-lambda.js`, `eu-central-1`) through its function URL (`VITE_CONTACT_ENDPOINT` at build time; `/api/contact` when unset, for the intercepted tests). The Lambda sends through Amazon SES under its IAM role. `server/contact/message.js` carries the tested honeypot, validation, captcha and message logic; keep transport code out of it. `server/contact/lambda.js` adapts function URL events and must stay runtime-free.
- The origin check relies on `CONTACT_ALLOWED_HOSTS`, and the function URL's CORS allows the same origins. Add every host the site is served from to both, and to the reCAPTCHA key's domains.
- The endpoint answers `500 not_configured` when a required variable is missing. `README.md` lists the variables; never commit or print a value.
- Hosting: GitHub Pages at `https://www.17tons.earth`, deployed by `.github/workflows/pages.yml` from `main`. Pages has no rewrites, so `scripts/write-route-pages.mjs` writes an `index.html` for every route and a `404.html`; add a new route to `src/generated/pages.js` or the script, never a rewrite.
- DNS stays at Netsons, which has no ALIAS/ANAME records: `www` is a CNAME to `17tons.github.io`, and the apex has the four GitHub Pages A records, which Pages redirects to `www`. Never touch the Microsoft 365 mail records.
- The Lambda is deployed separately with `scripts/package-contact-lambda.sh` and `aws lambda update-function-code`. Publish the site through a pull request into `main` only when the public deployment is authorized, and verify the Pages deployment and the live page separately from a green workflow.

## Verification
- Run `npm run build` after changes.
- Run `npm test` for locale/routing changes and `npm run test:i18n` against the running site for translation coverage and desktop/mobile browser checks. See `README.md` for production-preview verification.
- For routing or visual changes, verify with browser automation on desktop and mobile viewports.
- For contact-dialog or endpoint changes, run `npm run test:contact`, which drives the built site with `/api/contact` intercepted, and `npm test` for the handler's own tests. The preview server is static; the real SES path is exercised only from the deployed site.
- For header navigation changes, run `npm run test:menus` to verify real pointer travel into dropdowns, all submenu links, and keyboard dismissal. Preserve a continuous hoverable area between each trigger and its panel.
- The full menu suite covers all six source pages in both languages, contact-dialog lifecycle, history, current-page selection, language switching, the home logo and an intercepted LinkedIn destination. Run with `BROWSER=webkit` on a supported platform for WebKit coverage; `test:menus:smoke` is not a substitute for the full suite.
- Keep `dist/`, `build/`, logs, and local test artifacts out of git.
