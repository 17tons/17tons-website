import { pages } from "../generated/pages.js";

export const locales = ["en", "it"];
export const localeNames = { en: "English", it: "Italiano" };
export const defaultLocale = "en";
export const storageKey = "17tons.locale";

const knownPaths = new Map();
for (const page of pages) {
  for (const path of [page.path, ...page.aliases]) {
    knownPaths.set(normalizePath(path), page);
  }
}

export function normalizePath(pathname) {
  const path = pathname.split(/[?#]/)[0] || "/";
  if (path === "/index.html") return "/";
  return path.endsWith("/") ? path : `${path}/`;
}

export function preferredLocale(storage, languages = []) {
  try {
    const saved = storage?.getItem(storageKey);
    if (locales.includes(saved)) return saved;
  } catch {
    // Locale URLs still work when browser storage is unavailable.
  }
  for (const language of languages) {
    const locale = language.toLowerCase().split("-")[0];
    if (locales.includes(locale)) return locale;
  }
  return defaultLocale;
}

export function localizedPath(page, locale) {
  return `/${locales.includes(locale) ? locale : defaultLocale}${page.path}`;
}

export function resolveRoute(pathname, preference = defaultLocale) {
  const normalized = normalizePath(pathname);
  const first = normalized.split("/")[1];
  const explicitLocale = locales.includes(first);
  const locale = explicitLocale ? first : locales.includes(preference) ? preference : defaultLocale;
  const basePath = explicitLocale ? normalizePath(normalized.slice(first.length + 1)) : normalized;
  const page = knownPaths.get(basePath);
  return { locale, page, basePath, path: page ? localizedPath(page, locale) : `/${locale}${basePath}` };
}

export function localizeHref(href, locale, origin) {
  if (!href || href.startsWith("#")) return href;
  try {
    const url = new URL(href, origin);
    if (url.origin !== origin) return href;
    const route = resolveRoute(url.pathname, locale);
    if (!route.page && route.basePath !== "/contact-us/") return href;
    const path = route.page ? localizedPath(route.page, locale) : `/${locale}/contact-us/`;
    return `${path}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}
