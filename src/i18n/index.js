import en from "./locales/en.js";
import it from "./locales/it.js";
import { messages } from "./messages.js";
import { locales, localeNames, localizedPath, localizeHref } from "./routing.js";

export const catalogs = { en, it };
export const translatableAttributes = ["alt", "title", "aria-label", "placeholder"];
export const normalizeMessage = (text) => text.replace(/\s+/g, " ").trim();

export function translate(source, locale) {
  const key = normalizeMessage(source);
  return catalogs[locale]?.[key] ?? en[key] ?? key;
}

export function localizePage(page, locale, origin, suffix = "") {
  const doc = new DOMParser().parseFromString(page.html, "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest("script, style, svg")) continue;
    if (!normalizeMessage(node.textContent)) continue;
    node.textContent = node.textContent.replace(/\S[\s\S]*\S|\S/, () => translate(node.textContent, locale));
  }

  for (const el of doc.querySelectorAll(translatableAttributes.map((attr) => `[${attr}]`).join(","))) {
    for (const attr of translatableAttributes) {
      const source = el.getAttribute(attr);
      if (!source) continue;
      el.setAttribute(attr, messages[locale].attributes?.[normalizeMessage(source)] ?? translate(source, locale));
    }
  }

  for (const anchor of doc.querySelectorAll("a[href]")) {
    anchor.setAttribute("href", localizeHref(anchor.getAttribute("href"), locale, origin));
  }

  for (const anchor of doc.querySelectorAll("a.elementor-social-icon-linkedin")) {
    anchor.href = "https://www.linkedin.com/company/17tons/";
    anchor.rel = "noopener noreferrer";
  }

  for (const summary of doc.querySelectorAll(".e-n-menu summary")) {
    summary.removeAttribute("tabindex");
    summary.removeAttribute("aria-expanded");
  }

  for (const title of doc.querySelectorAll(".e-n-menu-title")) {
    if (title.querySelector(".e-n-menu-title-text")?.textContent.trim()) continue;
    const container = title.querySelector(".e-n-menu-title-container");
    if (!container) continue;
    const button = doc.createElement("button");
    button.type = "button";
    button.className = `${container.className} site-mobile-menu-trigger`;
    button.innerHTML = container.innerHTML;
    button.setAttribute("aria-label", translate("Menu Toggle", locale));
    button.setAttribute("aria-expanded", "false");
    const controls = title.querySelector("[aria-controls]")?.getAttribute("aria-controls");
    if (controls) button.setAttribute("aria-controls", controls);
    container.replaceWith(button);
  }

  for (const switcher of doc.querySelectorAll(".wpml-ls")) {
    switcher.className = "site-language-switcher";
    switcher.setAttribute("role", "navigation");
    switcher.setAttribute("aria-label", messages[locale].language);
    switcher.replaceChildren();
    for (const target of locales) {
      const anchor = doc.createElement("a");
      anchor.href = `${localizedPath(page, target)}${suffix}`;
      anchor.lang = target;
      anchor.hreflang = target;
      anchor.dataset.locale = target;
      anchor.textContent = target.toUpperCase();
      anchor.setAttribute("aria-label", `${messages[locale].readIn} ${localeNames[target]}`);
      if (locale === target) anchor.setAttribute("aria-current", "true");
      switcher.appendChild(anchor);
    }
  }
  return doc.body.innerHTML;
}

export function updateMetadata(page, locale, origin) {
  const copy = messages[locale];
  document.title = page ? copy.titles[page.slug] : `${copy.notFoundTitle} • 17tons`;
  document.documentElement.lang = locale;
  document.documentElement.dir = "ltr";
  document.querySelector('meta[name="description"]').content = page ? copy.descriptions[page.slug] : copy.notFoundDescription;
  document.querySelectorAll('[data-i18n-meta]').forEach((el) => el.remove());
  if (!page) {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    robots.dataset.i18nMeta = "";
    document.head.appendChild(robots);
    return;
  }
  for (const target of [locale, ...locales, "x-default"]) {
    const link = document.createElement("link");
    link.dataset.i18nMeta = "";
    link.rel = document.querySelector('link[data-i18n-meta][rel="canonical"]') ? "alternate" : "canonical";
    if (link.rel === "alternate") link.hreflang = target;
    link.href = `${origin}${target === "x-default" ? page.path : localizedPath(page, target)}`;
    document.head.appendChild(link);
  }
}
