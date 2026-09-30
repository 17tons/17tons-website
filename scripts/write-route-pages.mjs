// GitHub Pages serves files and has no rewrites, so every route the app knows gets its own copy of
// index.html and answers a direct link with 200; 404.html lets the app render unknown routes.
import fs from "node:fs/promises";
import path from "node:path";
import { pages } from "../src/generated/pages.js";
import { locales } from "../src/i18n/routing.js";

const distDir = path.resolve("dist");
const index = await fs.readFile(path.join(distDir, "index.html"));

const routes = new Set(["/contact-us/"]);
for (const page of pages) {
  for (const base of [page.path, ...page.aliases]) {
    routes.add(base);
    for (const locale of locales) routes.add(`/${locale}${base}`);
  }
}
for (const locale of locales) routes.add(`/${locale}/contact-us/`);
routes.delete("/");

for (const route of routes) {
  const dir = path.join(distDir, route);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "index.html"), index);
}
await fs.writeFile(path.join(distDir, "404.html"), index);

console.log(`route pages: ${routes.size}, plus 404.html`);
