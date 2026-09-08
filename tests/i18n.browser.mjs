import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { pages } from "../src/generated/pages.js";
import { catalogs, normalizeMessage, translate, translatableAttributes } from "../src/i18n/index.js";
import { messages } from "../src/i18n/messages.js";
import { localizedPath } from "../src/i18n/routing.js";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4173";
const outputDir = process.env.SCREENSHOT_DIR || "/tmp/17tons-i18n-screenshots";
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ locale: "it-IT", viewport: { width: 1440, height: 1000 } });
const tab = await context.newPage();
const errors = [];
const overflows = [];
tab.on("pageerror", (error) => errors.push(error.message));

try {
  await tab.goto(baseURL);
  await tab.waitForURL("**/it/");
  const inventory = await tab.evaluate(({ pages, attributes }) => {
    return pages.map((page) => {
      const doc = new DOMParser().parseFromString(page.html, "text/html");
      const texts = new Set();
      const attrs = new Set();
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.parentElement.closest("script,style,svg")) continue;
        const text = node.textContent.replace(/\s+/g, " ").trim();
        if (text) texts.add(text);
      }
      for (const el of doc.querySelectorAll(attributes.map((attr) => `[${attr}]`).join(","))) {
        for (const attr of attributes) {
          const text = el.getAttribute(attr)?.replace(/\s+/g, " ").trim();
          if (text) attrs.add(text);
        }
      }
      return { slug: page.slug, texts: [...texts], attrs: [...attrs] };
    });
  }, { pages, attributes: translatableAttributes });

  const missing = [...new Set(inventory.flatMap((page) => [...page.texts, ...page.attrs]))]
    .filter((source) => !Object.hasOwn(catalogs.it, source));
  assert.deepEqual(missing, [], "Every snapshot message must have an explicit Italian translation, including unchanged brand names");

  for (const width of process.argv.includes("--interactions-only") ? [] : [1440, 390]) {
    await tab.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const locale of ["en", "it"]) {
      for (const page of pages) {
        await tab.goto(`${baseURL}${localizedPath(page, locale)}`, { waitUntil: "networkidle" });
        await tab.waitForFunction((locale) => document.documentElement.lang === locale, locale);
        assert.equal(await tab.title(), messages[locale].titles[page.slug]);
        assert.equal(await tab.locator('meta[name="description"]').getAttribute("content"), messages[locale].descriptions[page.slug]);
        assert.equal(await tab.locator('link[rel="canonical"]').getAttribute("href"), `${baseURL}${localizedPath(page, locale)}`);
        assert.equal(await tab.locator('link[rel="alternate"][hreflang]').count(), 3);
        const actual = await tab.locator(".react-page").evaluate((root) => {
          const texts = new Set();
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            if (walker.currentNode.parentElement.closest("script,style,svg")) continue;
            const text = walker.currentNode.textContent.replace(/\s+/g, " ").trim();
            if (text) texts.add(text);
          }
          return [...texts];
        });
        const source = inventory.find((item) => item.slug === page.slug);
        for (const text of source.texts) {
          assert.ok(actual.includes(normalizeMessage(translate(text, locale))), `${locale}/${page.slug}: missing rendered message ${text}`);
        }
        const badLinks = await tab.locator('.react-page a[href]').evaluateAll((anchors, locale) => anchors
          .map((anchor) => anchor.getAttribute("href"))
          .filter((href) => /^\/(?:metatons-carbon|biochar|arr|land-based|philosophy|partners|contact-us)/.test(href)), locale);
        assert.deepEqual(badLinks, [], "Internal navigation must retain locale");
        const overflow = await tab.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        if (overflow) {
          overflows.push({ locale, page: page.slug, width, elements: await tab.evaluate(() => [...document.querySelectorAll(".react-page *")].filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width && rect.right > innerWidth + 1 && getComputedStyle(el).visibility !== "hidden" && !el.closest(".uc_logo_marquee");
          }).map((el) => ({ class: el.className, right: Math.round(el.getBoundingClientRect().right), text: el.textContent.trim().slice(0, 80) })).slice(0, 10)) });
        }
        await tab.screenshot({ path: `${outputDir}/${locale}-${page.slug}-${width}.png` });
        console.log(`PASS ${locale}/${page.slug} at ${width}px`);
      }
    }
  }
  assert.deepEqual(overflows, [], "All pages must fit the viewport");

  await tab.setViewportSize({ width: 1440, height: 1000 });
  await tab.goto(`${baseURL}/it/biochar/?source=language-test#content`);
  await tab.waitForURL("**/it/metatons-carbon-removal-insights/biochar/?source=language-test#content");
  const switchToEnglish = tab.locator('a[data-locale="en"]:visible').first();
  await switchToEnglish.click();
  await tab.waitForURL("**/en/metatons-carbon-removal-insights/biochar/?source=language-test#content");
  await tab.reload();
  assert.equal(await tab.locator("html").getAttribute("lang"), "en");
  await tab.goBack();
  await tab.waitForFunction(() => document.documentElement.lang === "it");
  await tab.goForward();
  await tab.waitForFunction(() => document.documentElement.lang === "en");
  await tab.goto(baseURL);
  await tab.waitForURL("**/en/");
  await tab.locator('a[data-locale="it"]:visible').first().click();
  await tab.waitForURL("**/it/");
  await tab.locator('a[href="/it/contact-us/"]:visible').first().click();
  await tab.getByRole("dialog").waitFor();
  assert.equal(await tab.getByRole("dialog").getByRole("heading").textContent(), "Contattaci");
  await tab.getByRole("textbox", { name: "Nome", exact: true }).fill("Test");
  await tab.getByRole("textbox", { name: "Messaggio", exact: true }).fill("Verifica della lingua");
  assert.equal(await tab.getByRole("button", { name: "Invia il messaggio" }).count(), 1);
  await tab.screenshot({ path: `${outputDir}/it-contact-desktop.png` });
  await tab.keyboard.press("Escape");
  assert.equal(await tab.getByRole("dialog").count(), 0);

  await tab.setViewportSize({ width: 390, height: 844 });
  await tab.goto(`${baseURL}/it/`);
  await tab.getByRole("button", { name: "Apri o chiudi il menu", exact: true }).filter({ visible: true }).click();
  await tab.locator('a[data-locale="en"]:visible').first().waitFor();
  const mobilePanel = tab.locator(".elementor-location-header .e-n-menu-content.e-active:visible");
  const panelBounds = await mobilePanel.boundingBox();
  const languageBounds = await mobilePanel.locator(".site-language-switcher").boundingBox();
  assert.ok(languageBounds.x + languageBounds.width <= panelBounds.x + panelBounds.width, "Language links fit inside the mobile menu");
  await mobilePanel.locator("summary").filter({ hasText: "Soluzioni", visible: true }).click();
  await tab.screenshot({ path: `${outputDir}/it-menu-mobile.png` });
  await mobilePanel.locator('a[href="/it/metatons-carbon-removal-insights/biochar/"]:visible').click();
  await tab.waitForURL("**/it/metatons-carbon-removal-insights/biochar/");
  await tab.getByRole("button", { name: "Apri o chiudi il menu", exact: true }).filter({ visible: true }).click();
  await tab.locator('a[data-locale="en"]:visible').first().click();
  await tab.waitForURL("**/en/metatons-carbon-removal-insights/biochar/");

  await tab.goto(`${baseURL}/it/unknown-page/`);
  await tab.getByRole("heading", { name: "Pagina non trovata" }).waitFor();
  assert.equal(await tab.locator('meta[name="robots"]').getAttribute("content"), "noindex");
  await tab.getByRole("link", { name: "Torna alla home" }).click();
  await tab.waitForURL("**/it/");
  assert.equal(await tab.locator('meta[name="robots"]').count(), 0);

  const blocked = await browser.newContext({ locale: "it-IT" });
  await blocked.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new Error("Storage blocked"); } }));
  const blockedTab = await blocked.newPage();
  await blockedTab.goto(`${baseURL}/`);
  await blockedTab.waitForURL("**/it/");
  await blockedTab.goto(`${baseURL}/en/philosophy/`);
  await blockedTab.waitForFunction(() => document.documentElement.lang === "en");
  await blocked.close();
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(`PASS coverage, switching, links, history, reload, preference, contact, mobile menu, 404 and blocked storage. Screenshots: ${outputDir}`);
} finally {
  await browser.close();
}
