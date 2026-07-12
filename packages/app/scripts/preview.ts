import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "4173");
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid preview port: ${process.env.PORT ?? ""}`);
}

const fileResponse = (file: Bun.BunFile, pathname: string): Response => {
  const headers = new Headers();
  if (pathname.endsWith(".webmanifest")) {
    headers.set("Content-Type", "application/manifest+json; charset=utf-8");
  }
  if (pathname === "/" || pathname.endsWith("/index.html") || pathname.endsWith("/sw.js")) {
    headers.set("Cache-Control", "no-cache");
  } else if (/-[a-z0-9]{8,}\.(?:css|js)$/.test(pathname)) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }
  return new Response(file, { headers });
};

const resolveRequest = (pathname: string): string | null => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (error: unknown) {
    console.warn("Rejected malformed preview URL", error);
    return null;
  }
  const relativePath = decoded.replace(/^\/+/, "") || "index.html";
  const candidate = resolve(distDir, relativePath);
  return candidate === distDir || candidate.startsWith(`${distDir}${sep}`) ? candidate : null;
};

const server = Bun.serve({
  hostname: host,
  port,
  async fetch(request): Promise<Response> {
    const url = new URL(request.url);
    const candidate = resolveRequest(url.pathname);
    if (!candidate) return new Response("Bad request", { status: 400 });

    const file = Bun.file(candidate);
    if (await file.exists()) return fileResponse(file, url.pathname);
    if (request.headers.get("accept")?.includes("text/html")) {
      return fileResponse(Bun.file(resolve(distDir, "index.html")), "/index.html");
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`Keychain preview: ${server.url}`);
