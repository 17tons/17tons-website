# 17tons Website Design

The captured Elementor snapshot (`src/generated/pages.js`, `src/styles/live.css`) carries the original site's design. The React layer (`src/styles/app.css`, dialogs, menus, language switch, icons) must match it. Use these values; do not introduce new ones without adding them here.

## Colors

| Token | Value | Use |
| --- | --- | --- |
| Primary teal | `#186067` | Elementor primary. Links, menu text, hover fills, dialog accents, the not-found page |
| Wordmark teal | `#005D63` | The "17" in the logo |
| Mark green | `#008F45` | The two coins of the logo mark and the favicons |
| Secondary | `#B2D9CC` | Elementor secondary |
| Accent | `#CDFFC2` | Elementor accent. The contact dialog's submit button |
| Deep navy | `#0E283D` | Dark sections |
| Text | `#111111` | Body text, dialog text, input borders, the dialog's close button |
| Mist | `#EAF0EC` | Light section backgrounds |
| Light grey | `#E0E3E5` | Dividers and light surfaces |
| Sage | `#8DB4A7` | Muted accents |
| Cream | `#FAF5ED` | Contact dialog panel, mobile menu panel, not-found page |
| Sand | `#F5F1E8` | Focus background of desktop dropdown links |
| White | `#FFFFFF` | Page background, desktop dropdown panels, form fields |
| Error red | `#8A1C14` | Contact form error text |

## Typography

- Display and headings: **DM Serif Display**, weight 500 (600 for emphasis).
- Body: **Roboto** 300; UI text 400; emphasis 500. Small UI labels (language switch, submit button) are Roboto 13px, weight 600.
- Fonts load from the local snapshot assets. No external font requests.

## Spacing, radii, shadows

- Section padding: `clamp(72px, 8vw, 128px)` top and bottom.
- Radii: `0` for form fields and most controls; `4px` for the language switch links.
- Desktop dropdown panel: `0 18px 42px rgba(24, 96, 103, 0.18)`. Mobile menu panel: `0 18px 42px rgba(0, 0, 0, 0.24)`.
- Dialog backdrop: `rgba(0, 0, 0, 0.72)`.

## Components

- Header and menus come from the snapshot. Dropdown panels are white on desktop and cream on mobile; keep a continuous hover area between trigger and panel.
- Language switch (`.site-language-switcher`): boxed EN/IT links, current language with a `currentColor` border, hover fills primary teal with white text.
- Contact dialog (`.contact-panel`): cream panel, heading in DM Serif Display primary teal, white fields with a 1px `#111` border and square corners, accent-green submit button that turns primary teal on hover. Sent and error states replace or follow the form; the error text is error red.
- Not-found page (`.not-found`): cream background, primary teal text, heading `clamp(36px, 6vw, 72px)`.

## Brand mark and icons

- The logo is `public/live-assets/wp-content/uploads/2023/10/cropped-17-tons-logo.png` (500×150). No vector source exists.
- The mark is the logo's left 161×150 pixels: two overlapping coins in mark green, with the ring and leaf cut out.
- Icons in `public/`, all derived from that mark:
  - `favicon.ico` (16, 32 and 48 px) and `favicon-32x32.png`, on a transparent background;
  - `icon-192.png` (192 px), on a transparent background;
  - `apple-touch-icon.png` (180 px), on a white background, with the mark at about 78%.
- Sizes above 192 px would upscale the raster, so there is no 512 px icon or web manifest. Regenerate the set from the logo if it changes.
