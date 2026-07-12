import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = fileURLToPath(new URL("../", import.meta.url));
const distDir = join(appDir, "dist");
const staticAssets = [
  "manifest.webmanifest",
  "assets/brand/sideset-mark.png",
  "icons/favicon-32.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
] as const;

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const appBuild = await Bun.build({
  entrypoints: [join(appDir, "index.html")],
  outdir: distDir,
  target: "browser",
  minify: true,
  splitting: true,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});
if (!appBuild.success) {
  for (const log of appBuild.logs) console.error(log);
  throw new Error("Application bundle failed");
}

for (const asset of staticAssets) {
  const destination = join(distDir, asset);
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(appDir, asset), destination);
}

const emittedAssets = appBuild.outputs.map((output) =>
  relative(distDir, output.path).split(sep).join("/"),
);
const cacheableAssets = [...new Set([...emittedAssets, ...staticAssets])].sort();
const hasher = new Bun.CryptoHasher("sha256");
for (const asset of cacheableAssets) {
  hasher.update(asset);
  hasher.update(new Uint8Array(await Bun.file(join(distDir, asset)).arrayBuffer()));
}
const cacheName = `keychain-shell-${hasher.digest("hex").slice(0, 16)}`;
const appShell = ["./", ...cacheableAssets.map((asset) => `./${asset}`)];

const workerBuild = await Bun.build({
  entrypoints: [join(appDir, "worker/sw.ts")],
  outdir: distDir,
  target: "browser",
  format: "esm",
  minify: true,
  naming: { entry: "[name].[ext]" },
  define: {
    APP_CACHE_NAME: JSON.stringify(cacheName),
    APP_SHELL: JSON.stringify(appShell),
  },
});
if (!workerBuild.success) {
  for (const log of workerBuild.logs) console.error(log);
  throw new Error("Service worker bundle failed");
}
if (!(await Bun.file(join(distDir, "sw.js")).exists())) {
  throw new Error("Service worker was not emitted at dist/sw.js");
}

console.log(`Built ${cacheableAssets.length} app-shell assets with cache ${cacheName}`);
