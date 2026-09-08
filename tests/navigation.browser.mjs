import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4174";
const engine = process.env.BROWSER || "chrome";
const graphWidths = process.argv.includes("--breakpoints-only") ? [] : process.argv.includes("--mobile-only") ? [390] : [1440, 390];
const breakpointWidths = process.argv.includes("--links-only") ? [] : [768, 1024, 1025, 1280, 1920];
const outputDir = process.env.SCREENSHOT_DIR || "/tmp/17tons-navigation-screenshots";
const pages = [
  { slug: "home", path: "" },
  { slug: "biochar", path: "metatons-carbon-removal-insights/biochar/", group: "solutions" },
  { slug: "arr", path: "metatons-carbon-removal-insights/arr/", group: "solutions" },
  { slug: "land-based", path: "metatons-carbon-removal-insights/land-based/", group: "solutions" },
  { slug: "philosophy", path: "philosophy/", group: "company" },
  { slug: "partners", path: "partners/", group: "company" },
];
const labels = {
  en: { solutions: "Solutions", company: "Company", closeContact: "Close contact form" },
  it: { solutions: "Soluzioni", company: "Azienda", closeContact: "Chiudi il modulo di contatto" },
};
const failures = [];
const errors = [];
let navigations = 0;
await mkdir(outputDir, { recursive: true });
const browser = engine === "webkit"
  ? await webkit.launch({ headless: true })
  : await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.route("https://www.linkedin.com/**", (route) => route.fulfill({ contentType: "text/html", body: "External navigation destination verified" }));
const tab = await context.newPage();
tab.setDefaultTimeout(8000);
tab.setDefaultNavigationTimeout(60000);
tab.on("pageerror", (error) => errors.push(error.message));
const header = tab.locator(".elementor-location-header");
const mobileTrigger = header.locator(".site-mobile-menu-trigger:visible");
const activePanel = header.locator(".e-n-menu-content.e-active:visible");
const pageURL = (page, locale) => `${baseURL}/${locale}/${page.path}`;

async function load(page, locale) {
  const response = await tab.goto(pageURL(page, locale), { waitUntil: "load" });
  assert.ok(response.ok(), `HTTP ${response.status()}`);
  await header.waitFor();
  await tab.evaluate(() => document.fonts.ready);
}

async function openMobile() {
  if (await mobileTrigger.getAttribute("aria-expanded") !== "true") await mobileTrigger.click();
  await activePanel.waitFor();
  const panelBounds = await activePanel.boundingBox();
  const inPanel = activePanel.locator(".site-language-switcher");
  const switcher = await inPanel.count() ? inPanel : header.locator(".site-language-switcher:visible");
  const languageBounds = await switcher.boundingBox();
  if (await inPanel.count()) {
    assert.ok(languageBounds.x >= panelBounds.x && languageBounds.x + languageBounds.width <= panelBounds.x + panelBounds.width, "The language selector must fit inside the panel");
  } else {
    assert.ok(languageBounds.x >= 0 && languageBounds.x + languageBounds.width <= tab.viewportSize().width, "The tablet header language selector must fit the viewport");
  }
}

async function openDesktop(group, locale) {
  await tab.mouse.move(5, 400);
  const label = header.locator(".e-n-menu-title-text").filter({ hasText: new RegExp(`^\\s*${labels[locale][group]}\\s*$`), visible: true });
  await label.hover();
  const item = label.locator("xpath=ancestor::li[1]");
  await item.locator(".e-n-menu-content").waitFor({ state: "visible" });
  return { label, item };
}

async function menuLink(target, locale, mobile) {
  const href = `/${locale}/${target.path}`;
  if (mobile) {
    await openMobile();
    if (target.group) {
      const summary = activePanel.locator("summary").filter({ hasText: labels[locale][target.group], visible: true });
      if (!await summary.evaluate((el) => el.parentElement.open)) await summary.click();
    }
    const link = activePanel.locator(`a[href="${href}"]:not([data-locale]):visible`);
    await link.scrollIntoViewIfNeeded();
    return link;
  }
  const { label, item } = await openDesktop(target.group, locale);
  const link = item.locator(`a[href="${href}"]`);
  const origin = await label.boundingBox();
  const targetBounds = await link.boundingBox();
  assert.ok(targetBounds, "Submenu link must be visible");
  await tab.mouse.move(origin.x + origin.width / 2, origin.y + origin.height / 2);
  await tab.mouse.move(targetBounds.x + targetBounds.width / 2, targetBounds.y + targetBounds.height / 2, { steps: 25 });
  assert.ok(await link.isVisible(), "The dropdown must stay open while crossing from its label to the link");
  assert.ok(await link.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return [0.15, 0.5, 0.85].every((fraction) => el.contains(document.elementFromPoint(rect.x + rect.width * fraction, rect.y + rect.height / 2)));
  }), "No page content may cover the submenu link");
  return link;
}

async function verifyKeyboard(locale, mobile) {
  if (mobile) {
    await mobileTrigger.focus();
    await tab.keyboard.press("Space");
    await activePanel.waitFor();
    const summaries = activePanel.locator("summary");
    await summaries.first().focus();
    await tab.keyboard.press("ArrowDown");
    assert.ok(await summaries.last().evaluate((el) => el === document.activeElement));
    await tab.keyboard.press("Home");
    assert.ok(await summaries.first().evaluate((el) => el === document.activeElement));
    const open = await summaries.first().evaluate((el) => el.parentElement.open);
    await tab.keyboard.press("Enter");
    assert.equal(await summaries.first().evaluate((el) => el.parentElement.open), !open);
    await tab.keyboard.press("Escape");
    assert.equal(await mobileTrigger.getAttribute("aria-expanded"), "false");
    return;
  }
  for (const group of ["solutions", "company"]) {
    await tab.mouse.move(5, 400);
    const title = header.locator(".e-n-menu-title").filter({ has: tab.locator(".e-n-menu-title-text", { hasText: labels[locale][group] }), visible: true });
    const trigger = title.locator("button");
    await trigger.focus();
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    await tab.keyboard.press("Tab");
    assert.ok(await tab.evaluate(() => document.activeElement.matches(".e-n-menu-content a")), "Tab must reach the submenu links");
    await tab.keyboard.press("Escape");
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    await tab.keyboard.press("Enter");
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    await tab.keyboard.press("Escape");
  }
}

try {
  for (const width of graphWidths) {
    const mobile = width <= 1024;
    await tab.setViewportSize({ width, height: mobile ? 844 : 1000 });
    for (const locale of ["en", "it"]) {
      for (const source of pages) {
        const name = `${engine}-${width}-${locale}-${source.slug}`;
        try {
          await load(source, locale);
          for (const target of pages.filter((page) => mobile || page.group)) {
            const link = await menuLink(target, locale, mobile);
            if (source.slug === "partners" && target.slug === "biochar") await tab.screenshot({ path: `${outputDir}/${name}-menu.png` });
            const box = await link.boundingBox();
            await tab.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            await tab.waitForURL(pageURL(target, locale));
            assert.equal(await activePanel.count(), 0, "Selecting a menu link closes the dropdown, even on the current page");
            navigations += 1;
            if (source.path !== target.path) {
              await tab.goBack();
              await tab.waitForURL(pageURL(source, locale));
            }
          }

          for (const closeMethod of ["escape", "button"]) {
            if (mobile) await openMobile();
            const retainedHeader = await header.elementHandle();
            await header.locator(`a[href="/${locale}/contact-us/"]:visible`).click();
            await tab.getByRole("dialog").waitFor();
            if (closeMethod === "escape") await tab.keyboard.press("Escape");
            else await tab.getByRole("button", { name: labels[locale].closeContact, exact: true }).click();
            assert.equal(await tab.getByRole("dialog").count(), 0);
            assert.ok(await retainedHeader.evaluate((el) => el.isConnected), "Opening and closing contact must not replace the header or discard its listeners");
            await retainedHeader.dispose();
            for (const target of [pages[1], pages[4]]) await menuLink(target, locale, mobile);
            if (mobile) await mobileTrigger.click();
            else await tab.mouse.move(5, 400);
          }

          await verifyKeyboard(locale, mobile);

          if (mobile) await openMobile();
          const external = header.locator("a.elementor-social-icon-linkedin:visible");
          assert.equal(await external.getAttribute("href"), "https://www.linkedin.com/company/17tons/");
          assert.equal(await external.getAttribute("target"), "_blank");
          const popupPromise = context.waitForEvent("page");
          await external.click();
          const popup = await popupPromise;
          await popup.waitForURL("https://www.linkedin.com/company/17tons/");
          await popup.close();

          for (const nextLocale of [locale === "en" ? "it" : "en", locale]) {
            if (mobile) await openMobile();
            await header.locator(`a[data-locale="${nextLocale}"]:visible`).click();
            await tab.waitForURL(pageURL(source, nextLocale));
            await tab.waitForFunction((expected) => document.documentElement.lang === expected, nextLocale);
          }
          await header.locator(`a[href="/${locale}/"]:has(img):visible`).click();
          await tab.waitForURL(pageURL(pages[0], locale));
          console.log(`PASS ${name}: every link, current page, history, contact twice, keyboard, LinkedIn, languages, logo`);
        } catch (error) {
          failures.push({ case: name, error: error.message });
          await tab.screenshot({ path: `${outputDir}/${name}-failure.png` });
          console.error(`FAIL ${name}: ${error.message}`);
        }
      }
    }
  }

  for (const width of breakpointWidths) {
    await tab.setViewportSize({ width, height: 1000 });
    for (const locale of ["en", "it"]) {
      for (const source of pages) {
        const name = `${engine}-breakpoint-${width}-${locale}-${source.slug}`;
        try {
          await load(source, locale);
          for (const target of pages.filter((page) => page.group)) await menuLink(target, locale, width <= 1024);
          assert.ok(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Navigation must not overflow the viewport");
        } catch (error) {
          failures.push({ case: name, error: error.message });
          await tab.screenshot({ path: `${outputDir}/${name}-failure.png` });
          console.error(`FAIL ${name}: ${error.message}`);
        }
      }
    }
    console.log(`Checked ${engine} breakpoint ${width}px on all pages and both languages`);
  }
  assert.deepEqual(errors, [], "No browser runtime errors");
  assert.deepEqual(failures, [], "All navigation scenarios must pass");
  console.log(`PASS ${engine}: ${navigations} actual menu navigations, all six source pages, both languages; graph widths: ${graphWidths.join(", ") || "skipped"}; breakpoint widths: ${breakpointWidths.join(", ") || "skipped"}`);
} finally {
  await browser.close();
}
