// Copy Pyodide's runtime assets out of node_modules and into public/pyodide
// so Vite serves them as static files. This is what makes Pyodide a *real*
// dependency (visible in package.json + lockfile) rather than a CDN <script>.

import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(root, "node_modules/pyodide");
const dest = resolve(root, "public/pyodide");

const KEEP_EXT = new Set([
  ".js", ".mjs", ".wasm", ".data", ".zip", ".json", ".whl", ".tar",
]);

async function main() {
  await mkdir(dest, { recursive: true });

  const entries = await readdir(src);
  let copied = 0;
  let bytes = 0;

  for (const name of entries) {
    if (name.startsWith(".")) continue;
    const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
    if (!KEEP_EXT.has(ext)) continue;

    const from = join(src, name);
    const to = join(dest, name);
    const s = await stat(from);
    if (!s.isFile()) continue;

    await cp(from, to, { force: true });
    copied += 1;
    bytes += s.size;
  }

  console.log(
    `[pyodide] copied ${copied} file${copied === 1 ? "" : "s"} ` +
      `(${(bytes / 1024 / 1024).toFixed(1)} MB) to public/pyodide/`,
  );
}

main().catch((err) => {
  console.error("[pyodide] copy failed:", err);
  process.exit(1);
});
