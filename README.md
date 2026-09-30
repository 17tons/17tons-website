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

The contact form posts to the AWS Lambda `17tons-website-contact` (`server/contact/aws-lambda.js`) through its function URL, which the build receives as `VITE_CONTACT_ENDPOINT`. The Lambda sends the message to `CONTACT_RECIPIENT` through Amazon SES under its own IAM role, so no mail password exists anywhere. Without `VITE_CONTACT_ENDPOINT` the dialog posts to the same-origin `/api/contact`, which is what `npm run test:contact` intercepts, because the preview server used above is static. `npm test` covers the handler and the Lambda adapter.

## Configuration

The Lambda (`eu-central-1`) reads these environment variables:

| Variable | Purpose |
| --- | --- |
| `CONTACT_SENDER_EMAIL`, `CONTACT_SENDER_NAME` | The sender the recipient sees; the address must belong to a verified SES identity (`17tons.tech`) |
| `CONTACT_RECIPIENT` | Address the messages are delivered to |
| `CONTACT_ALLOWED_HOSTS` | Comma-separated hosts the form may be posted from (`17tons.earth,www.17tons.earth`) |
| `SES_REGION` | Region of the SES identity (`us-east-1`) |
| `RECAPTCHA_SECRET` | Server-side reCAPTCHA secret, never exposed to the browser |
| `RECAPTCHA_MIN_SCORE` | Optional score threshold, defaults to `0.5` |

The function URL allows cross-origin `POST` only from `https://www.17tons.earth` and `https://17tons.earth`. The endpoint answers `500` with `not_configured` rather than accepting a message it cannot deliver.

The build reads `VITE_RECAPTCHA_SITE_KEY`, the public reCAPTCHA site key, and `VITE_CONTACT_ENDPOINT`, the Lambda's function URL. The deploy workflow sets both. The reCAPTCHA key must list every domain the site is served from.

## Deployment

- The site is served by GitHub Pages at `https://www.17tons.earth`. `.github/workflows/pages.yml` tests and builds every push and pull request, and deploys `main`. `npm run build` also writes an `index.html` for every known route (`scripts/write-route-pages.mjs`), so direct links answer `200`, plus a `404.html` that lets the app render unknown routes.
- DNS for `17tons.earth` stays at Netsons: `www` is a CNAME to `17tons.github.io`, and the apex has A records to GitHub Pages (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`), which redirects it to `www`. The mail records (Microsoft 365) are unrelated to the site and must stay untouched.
- The contact Lambda is deployed on its own. `scripts/package-contact-lambda.sh` builds `build/contact-lambda.zip`; the AWS SDK comes with the Node.js 22 runtime. Publish it with `aws lambda update-function-code --function-name 17tons-website-contact --zip-file fileb://build/contact-lambda.zip --region eu-central-1`.
