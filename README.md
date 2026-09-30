# 17tons website

React/Vite website with English and Italian content. Page layouts and local assets come from the original site's snapshot; translations live separately so snapshot regeneration does not overwrite them.

## Development

Use Node.js 20.19+ (or a supported newer release) and npm. Install dependencies with `npm ci`, then run `npm run dev`.

## Internationalization

- Every page has an `/en/` and `/it/` URL, including direct deep links.
- Explicit language URLs take precedence over the saved preference and browser language. Unprefixed legacy routes use the saved preference, then browser language, then English. Aliases resolve to the canonical page without losing query strings or fragments.
- The language selector preserves the current page, query string and fragment. Internal navigation retains the selected language. The preference is saved when browser storage is available.
- `src/i18n/locales/it.js` contains the Italian message catalog. Snapshot text, normalized for whitespace, serves as the message identifier. Unchanged brands and proper names are explicitly included so coverage can be checked.
- `src/i18n/locales/en.js` corrects source content that was already in Italian, particularly image descriptions and address labels. Other English messages use the snapshot source directly.
- `src/i18n/messages.js` contains application UI copy and per-page titles and descriptions. React components access it through `useI18n()`.
- `src/i18n/index.js` translates text nodes and accessibility attributes in a detached DOM before rendering, rewrites internal links and replaces the original WordPress language controls. Source HTML, styling and local assets remain reusable across locales.
- The `dangerouslySetInnerHTML` value is memoized alongside its source HTML. Opening or closing the contact dialog must not replace the snapshot DOM: doing so discards the menu listeners and the initialized logo marquees.
- Document language, titles, descriptions, canonical URLs and reciprocal `hreflang` links update on navigation. This remains a client-rendered SPA; metadata is set by JavaScript.
- Original institutional logos, product screenshots and downloadable PDF documents remain their source assets. Translation does not modify text embedded in images or the contents of legal documents.

After `npm run snapshot`, run the translation coverage/browser check and translate any new source messages. Do not edit the generated snapshot to maintain translations.

## Verification

```sh
npm test
npm run build
npm run preview -- --port 4174
```

In another terminal, with Google Chrome installed:

```sh
BASE_URL=http://127.0.0.1:4174 npm run test:i18n
BASE_URL=http://127.0.0.1:4174 npm run test:menus
BASE_URL=http://127.0.0.1:4174 npm run test:contact
```

The Playwright suite verifies the complete translation catalog, all six pages in both languages at desktop and mobile widths, localized metadata, internal links, direct URLs, language switching, history, reload, stored/browser preference, blocked storage, the contact dialog, mobile navigation and unknown routes. It saves screenshots under `/tmp/17tons-i18n-screenshots`; set `SCREENSHOT_DIR` to choose another output directory outside version control.

The full menu regression suite starts from every page in both languages and follows every desktop/mobile menu destination, including the current page and browser history. It checks repeated contact-dialog opening and closing without replacing the header, keyboard navigation, both language links, the home logo, and the LinkedIn destination in a new tab. LinkedIn navigation is intercepted in the test; no interaction with the external service is performed. It also checks submenu hit targets at seven viewport widths. Pointer travel uses small steps to catch hover gaps and content covering links. Run with `BROWSER=webkit` to check the WebKit engine on a supported platform with Playwright's WebKit browser installed. Screenshots default to `/tmp/17tons-navigation-screenshots`. `npm run test:menus:smoke` runs the shorter pointer/keyboard check.

Use `npm run test:menus -- --breakpoints-only` for the responsive checks, `--links-only` for the navigation/lifecycle checks, or `--mobile-only` to limit the navigation graph to the mobile layout while retaining all responsive checks.

The contact form posts to the Vercel function in `api/contact.js`, which delivers the message to the address in `CONTACT_RECIPIENT` through the SMTP account configured in the project's environment variables. `npm run test:contact` exercises the dialog against the built site with the endpoint intercepted, because the preview server used above is static and does not execute functions. To exercise the real handler locally, run `vercel dev` with the variables pulled into the environment.

## Configuration

The deployment reads these Vercel project environment variables. Set them for both Production and Preview; the build-time key must be present when the site is built.

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | SMTP account the message is sent through; the port defaults to 587 and `SMTP_SECURE` to `false` |
| `SMTP_USER`, `SMTP_PASSWORD` | Credentials for that account |
| `SMTP_SENDER_NAME`, `SMTP_SENDER_EMAIL` | The sender the recipient sees; `SMTP_SENDER_EMAIL` must be allowed by the mail account |
| `CONTACT_RECIPIENT` | Address the messages are delivered to |
| `RECAPTCHA_SECRET` | Server-side reCAPTCHA secret, never exposed to the browser |
| `RECAPTCHA_MIN_SCORE` | Optional score threshold, defaults to `0.5` |
| `VITE_RECAPTCHA_SITE_KEY` | Public reCAPTCHA site key, inlined into the build; must list every domain the site is served from |

The endpoint answers `500` with `not_configured` rather than accepting a message it cannot deliver, so a deployment missing any of these variables fails loudly instead of losing enquiries.

## Deployment

`npm run build` writes the static site to `dist/`, and every file under `api/` becomes a serverless function. Vercel resolves the filesystem, serverless functions included, before applying rewrites, so `vercel.json` rewriting deep links to `index.html` does not shadow the endpoint.
