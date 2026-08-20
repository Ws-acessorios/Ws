import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");

const entries = await readdir(root, { withFileTypes: true });
for (const entry of entries) {
  if (entry.name === "dist" || entry.name === "node_modules" || entry.name.startsWith(".")) continue;

  const source = path.join(root, entry.name);
  const destination = path.join(dist, entry.name);

  if (entry.isDirectory() && ["assets"].includes(entry.name)) {
    await cp(source, destination, { recursive: true, force: true });
  } else if (entry.isFile() && (entry.name.endsWith(".html") || entry.name.endsWith(".css") || entry.name === "catalogo.json" || entry.name === "sitemap.xml" || entry.name === "robots.txt")) {
    await cp(source, destination, { force: true });
  }
}

const oldScript = path.join(dist, "script.js");
const nestedScript = path.join(dist, "src", "script.js");
try {
  await cp(nestedScript, oldScript, { force: true });
  await rm(path.join(dist, "src"), { recursive: true, force: true });
} catch {
  // O compilador pode emitir directamente para dist conforme o rootDir configurado.
}

const scriptVersion = "catalog-safe-7";
const styleVersion = "styles-safe-2";
const publishedEntries = await readdir(dist, { withFileTypes: true });
for (const entry of publishedEntries) {
  if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
  const pagePath = path.join(dist, entry.name);
  const page = await readFile(pagePath, "utf8");
  const updatedPage = page
    .replace(/script\.js\?v=[^"]+/g, `script.js?v=${scriptVersion}`)
    .replace(/styles\.css(?:\?v=[^"]+)?/g, `styles.css?v=${styleVersion}`)
    .replaceAll("WS Wattson Acessórios", "WS Acessórios")
    .replaceAll("WS Wattson", "WS Acessórios");
  if (updatedPage !== page) await writeFile(pagePath, updatedPage, "utf8");
}

console.log("Ficheiros estáticos copiados para dist/");
