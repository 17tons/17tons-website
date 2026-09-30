// Verifies the contact dialog against the real build with /api/contact intercepted: the static
// preview server does not execute serverless functions, so the endpoint is answered by the test.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4173";
const outputDir = process.env.SCREENSHOT_DIR || "/tmp/17tons-contact-screenshots";
await mkdir(outputDir, { recursive: true });

const labels = {
  en: { name: "Name", email: "E-mail", message: "Message", send: "Send Your Message" },
  it: { name: "Nome", email: "E-mail", message: "Messaggio", send: "Invia il messaggio" },
};

const browser = await chromium.launch({ headless: true, channel: "chrome" });

async function openDialog(page, locale) {
  await page.goto(`${baseURL}/${locale}/`, { waitUntil: "load" });
  await page.locator(`a[href="/${locale}/contact-us/"]:visible`).first().click();
  await page.getByRole("dialog").waitFor();
  // The snapshot page carries its own Elementor form, so every field is addressed inside the dialog.
  return page.getByRole("dialog");
}

async function fillAndSubmit(dialog, locale, values) {
  await dialog.getByRole("textbox", { name: labels[locale].name, exact: true }).fill(values.name);
  await dialog.getByRole("textbox", { name: labels[locale].email, exact: true }).fill(values.email);
  await dialog.getByRole("textbox", { name: labels[locale].message, exact: true }).fill(values.message);
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: labels[locale].send, exact: true }).click();
}

try {
  const values = { name: "Susanna Di Vincenzo", email: "susanna@example.com", message: "Verifica dell'invio dal modulo." };

  // A delivered message: the dialog posts the fields and reports success.
  {
    const context = await browser.newContext({ locale: "it-IT", viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    let posted = null;
    await context.route("**/api/contact", async (route) => {
      posted = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });

    const dialog = await openDialog(page, "it");
    assert.equal(await dialog.getByRole("button", { name: labels.it.send, exact: true }).count(), 1);
    assert.equal(posted, null, "opening the dialog must not submit anything");

    const honeypot = dialog.locator(".contact-honeypot");
    assert.equal(await honeypot.count(), 1, "the honeypot field is missing");
    const box = await honeypot.boundingBox();
    assert.ok(box === null || box.x + box.width <= 0, "the honeypot is visible to a visitor");

    await fillAndSubmit(dialog, "it", values);
    await page.locator(".contact-sent").waitFor({ timeout: 8000 });

    assert.equal(posted.name, values.name);
    assert.equal(posted.email, values.email);
    assert.equal(posted.message, values.message);
    assert.equal(posted.locale, "it");
    assert.equal(posted.website, "", "the honeypot must travel empty");
    assert.equal(typeof posted.recaptchaToken, "string");
    assert.equal(await page.locator(".contact-form").count(), 0, "the form should give way to the confirmation");
    assert.equal(await page.locator(".contact-error").count(), 0);
    assert.deepEqual(errors, [], "no browser runtime errors");
    await page.screenshot({ path: `${outputDir}/it-contact-sent.png` });
    await context.close();
  }

  // A failed delivery: the visitor keeps what they wrote and is told to write to us instead.
  {
    const context = await browser.newContext({ locale: "en-GB", viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await context.route("**/api/contact", (route) =>
      route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false, code: "send_failed" }) }));

    const dialog = await openDialog(page, "en");
    await fillAndSubmit(dialog, "en", values);
    const error = dialog.locator(".contact-error");
    await error.waitFor({ timeout: 8000 });

    assert.match(await error.textContent(), /info@17tons\.earth/);
    assert.equal(await dialog.locator(".contact-sent").count(), 0);
    assert.equal(await dialog.getByRole("textbox", { name: labels.en.message, exact: true }).inputValue(), values.message);
    assert.equal(await dialog.getByRole("button", { name: labels.en.send, exact: true }).count(), 1, "the button must return to its own label");
    await page.screenshot({ path: `${outputDir}/en-contact-error.png` });
    await context.close();
  }

  // The consent checkbox still gates submission, and the dialog still closes on Escape afterwards.
  {
    const context = await browser.newContext({ locale: "it-IT", viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    let posted = null;
    await context.route("**/api/contact", async (route) => {
      posted = route.request().postData();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });

    const dialog = await openDialog(page, "it");
    await dialog.getByRole("textbox", { name: labels.it.name, exact: true }).fill(values.name);
    await dialog.getByRole("textbox", { name: labels.it.email, exact: true }).fill(values.email);
    await dialog.getByRole("textbox", { name: labels.it.message, exact: true }).fill(values.message);
    await dialog.getByRole("button", { name: labels.it.send, exact: true }).click();
    await page.waitForTimeout(500);
    assert.equal(posted, null, "the consent checkbox must block the submission");

    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await context.close();
  }
} finally {
  await browser.close();
}

console.log("contact dialog checks passed; screenshots in", outputDir);
