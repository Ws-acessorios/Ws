import { build } from "esbuild";
import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

await mkdir(path.join(root, "dist"), { recursive: true });

await build({
  entryPoints: [path.join(root, "src/script.ts")],
  outfile: path.join(root, "dist/script.js"),
  bundle: true,
  format: "iife",
  target: "es2020",
  sourcemap: true,
  minify: false,
});

const entries = await readdir(root, { withFileTypes: true });
for (const entry of entries) {
  if (entry.name === "dist" || entry.name === "node_modules" || entry.name.startsWith(".")) continue;
  const source = path.join(root, entry.name);
  const destination = path.join(root, "dist", entry.name);
  if (entry.isDirectory()) {
    await cp(source, destination, { recursive: true, force: true });
  } else if (entry.name.endsWith(".html") || entry.name.endsWith(".css")) {
    await cp(source, destination, { force: true });
  }
}

console.log("Build TypeScript concluído em dist/");
