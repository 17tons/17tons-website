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

The contact form posts to `/api/contact`, which Amplify Hosting proxies to the AWS Lambda in `server/contact/aws-lambda.js`. The Lambda sends the message to `CONTACT_RECIPIENT` through Amazon SES under its own IAM role, so no mail password exists anywhere. `npm run test:contact` exercises the dialog against the built site with the endpoint intercepted, because the preview server used above is static and does not execute functions. `npm test` covers the handler and the Lambda adapter.

## Configuration

The Lambda `17tons-website-contact` (`eu-central-1`) reads these environment variables:

| Variable | Purpose |
| --- | --- |
| `CONTACT_SENDER_EMAIL`, `CONTACT_SENDER_NAME` | The sender the recipient sees; the address must belong to a verified SES identity (`17tons.tech`) |
| `CONTACT_RECIPIENT` | Address the messages are delivered to |
| `CONTACT_ALLOWED_HOSTS` | Comma-separated hosts the form may be posted from; behind the proxy the request host is the function's own, so the site's hosts are listed |
| `SES_REGION` | Region of the SES identity (`us-east-1`) |
| `RECAPTCHA_SECRET` | Server-side reCAPTCHA secret, never exposed to the browser |
| `RECAPTCHA_MIN_SCORE` | Optional score threshold, defaults to `0.5` |

`VITE_RECAPTCHA_SITE_KEY` is the public reCAPTCHA site key, inlined into the build by the deploy workflow. The key must list every domain the site is served from.

The endpoint answers `500` with `not_configured` rather than accepting a message it cannot deliver, so a Lambda missing any required variable fails loudly instead of losing enquiries.

## Deployment

The site runs on the 17tons AWS account (`832426295223`), without servers:

- Amplify Hosting app `17tons-website` (`dyohydngf32c`, `eu-central-1`) serves `dist/` as manual deployments. Branch `main` is production, and branch `preview` receives pull request builds. The app's rewrite rules proxy `/api/contact` to the Lambda function URL and send every path without a file extension to `/index.html`, so direct deep links work.
- Lambda `17tons-website-contact` runs `server/contact/aws-lambda.js` on Node.js 22. `scripts/package-contact-lambda.sh` builds its archive; the AWS SDK comes with the runtime.
- `.github/workflows/deploy.yml` tests and builds every push and pull request. It signs in to AWS through GitHub OIDC, with no stored keys. A push to `main` deploys the Lambda and publishes `main`, while a pull request publishes only `preview`. `scripts/deploy-amplify.sh` uploads the build and waits for the Amplify job.
