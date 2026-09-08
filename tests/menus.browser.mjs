import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4173";
const engine = process.env.BROWSER || "chrome";
const outputDir = process.env.SCREENSHOT_DIR || "/tmp/17tons-menu-screenshots";
await mkdir(outputDir, { recursive: true });
const browser = engine === "webkit"
  ? await webkit.launch({ headless: true })
  : await chromium.launch({ headless: true, channel: "chrome" });

try {
  const tab = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  for (const locale of ["en", "it"]) {
    const response = await tab.goto(`${baseURL}/${locale}/`, { waitUntil: "networkidle" });
    assert.ok(response.ok(), `Preview responded with HTTP ${response.status()}`);
    for (const { group, path } of [
      { group: locale === "it" ? "Soluzioni" : "Solutions", path: "metatons-carbon-removal-insights/biochar/" },
      { group: locale === "it" ? "Soluzioni" : "Solutions", path: "metatons-carbon-removal-insights/arr/" },
      { group: locale === "it" ? "Soluzioni" : "Solutions", path: "metatons-carbon-removal-insights/land-based/" },
      { group: locale === "it" ? "Azienda" : "Company", path: "philosophy/" },
      { group: locale === "it" ? "Azienda" : "Company", path: "partners/" },
    ]) {
      const label = tab.locator(".elementor-location-header .e-n-menu-title-text").filter({ hasText: new RegExp(`^\\s*${group}\\s*$`), visible: true });
      const item = label.locator("xpath=ancestor::li[1]");
      await label.hover();
      const link = item.locator(`a[href="/${locale}/${path}"]`);
      await link.waitFor({ state: "visible" });
      const source = await label.boundingBox();
      const target = await link.boundingBox();
      const destination = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
      await tab.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
      await tab.mouse.move(destination.x, destination.y, { steps: 25 });
      await tab.screenshot({ path: `${outputDir}/${engine}-${locale}-${path.includes("insights") ? "solutions" : "company"}.png` });
      assert.ok(await link.isVisible(), `${engine}: ${group} closed while moving the pointer to ${path}`);
      await tab.mouse.click(destination.x, destination.y);
      await tab.waitForURL(`${baseURL}/${locale}/${path}`);
      assert.equal(await tab.locator("html").getAttribute("lang"), locale);
      console.log(`PASS ${engine} pointer navigation ${locale}/${path}`);
    }

    const title = tab.locator(".elementor-location-header .e-n-menu-title").filter({ has: tab.locator(".e-n-menu-title-text", { hasText: locale === "it" ? "Soluzioni" : "Solutions" }), visible: true });
    await tab.mouse.move(10, 300);
    const trigger = title.locator("button");
    await trigger.focus();
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    await tab.keyboard.press("Tab");
    await tab.keyboard.press("Escape");
    assert.equal(await trigger.getAttribute("aria-expanded"), "false", "Escape closes the menu after returning focus to the trigger");
    await tab.keyboard.press("Enter");
    assert.equal(await trigger.getAttribute("aria-expanded"), "true", "Enter reopens the menu");
    await tab.keyboard.press("Escape");
  }
  console.log(`PASS ${engine} desktop menus in both languages, mouse and keyboard`);
} finally {
  await browser.close();
}
