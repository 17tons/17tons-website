import assert from "node:assert/strict";
import test from "node:test";
import { pages } from "../src/generated/pages.js";
import { messages } from "../src/i18n/messages.js";
import { translate } from "../src/i18n/index.js";
import { locales, localizeHref, localizedPath, preferredLocale, resolveRoute } from "../src/i18n/routing.js";

test("all canonical and legacy routes resolve in both languages", () => {
  for (const page of pages) {
    for (const locale of locales) {
      for (const path of [page.path, ...page.aliases]) {
        for (const input of [path, `/${locale}${path}`, `/${locale}${path}`.slice(0, -1)]) {
          const route = resolveRoute(input, locale);
          assert.equal(route.page.slug, page.slug, input);
          assert.equal(route.locale, locale);
          assert.equal(route.path, localizedPath(page, locale));
        }
      }
      assert.ok(messages[locale].titles[page.slug]);
      assert.ok(messages[locale].descriptions[page.slug]);
    }
  }
});

test("explicit locale wins; unknown paths do not silently render home", () => {
  assert.equal(resolveRoute("/en/biochar/", "it").locale, "en");
  assert.equal(resolveRoute("/it/philosophy/", "en").locale, "it");
  assert.equal(resolveRoute("/it/not-a-page/").page, undefined);
  assert.equal(resolveRoute("/fr/").page, undefined);
  assert.equal(resolveRoute("/index.html", "it").path, "/it/");
});

test("internal links retain language, query and fragment; other URLs stay intact", () => {
  const origin = "https://example.test";
  assert.equal(localizeHref("/en/biochar/?source=test#details", "it", origin), "/it/metatons-carbon-removal-insights/biochar/?source=test#details");
  assert.equal(localizeHref("/contact-us/", "it", origin), "/it/contact-us/");
  for (const href of ["#content", "mailto:hello@example.test", "tel:+390000", "/live-assets/privacy.pdf", "https://other.example/philosophy/", "//other.example/"]) {
    assert.equal(localizeHref(href, "it", origin), href);
  }
});

test("preference survives blocked or invalid storage with browser and English fallback", () => {
  assert.equal(preferredLocale({ getItem: () => "en" }, ["it-IT"]), "en");
  assert.equal(preferredLocale({ getItem: () => "bad" }, ["it-CH"]), "it");
  assert.equal(preferredLocale({ getItem() { throw Error("blocked"); } }, ["it-IT"]), "it");
  assert.equal(preferredLocale(null, ["fr-FR", "it-IT"]), "it");
  assert.equal(preferredLocale(null, ["fr-FR"]), "en");
});

test("translation normalizes snapshot whitespace and falls back to English", () => {
  assert.equal(translate("  Request a\n Personalized Demo ", "it"), "Richiedi una demo personalizzata");
  assert.equal(translate("New content", "it"), "New content");
  assert.equal(translate("Monitoring:", "it"), "Monitoraggio:");
  assert.equal(translate("Palermo (Italia)", "en"), "Palermo (Italy)");
});
