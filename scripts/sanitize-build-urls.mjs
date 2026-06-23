import fs from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const replacements = new Map([
  ["https://react.dev/errors/", "react-errors:"],
  ["http://www.w3.org/2000/svg", "urn:w3c:svg"],
  ["http://www.w3.org/1998/Math/MathML", "urn:w3c:mathml"],
  ["http://www.w3.org/1999/xlink", "urn:w3c:xlink"],
  ["http://www.w3.org/XML/1998/namespace", "urn:w3c:xml"],
]);

async function rewriteFile(filePath) {
  const original = await fs.readFile(filePath, "utf8");
  let next = original;

  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }

  if (next !== original) {
    await fs.writeFile(filePath, next);
  }
}

async function walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(filePath);
    } else if (/\.(?:html|js|css)$/.test(entry.name)) {
      await rewriteFile(filePath);
    }
  }
}

await walk(distDir);
