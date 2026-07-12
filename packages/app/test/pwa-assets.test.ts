import { describe, expect, test } from "bun:test";

const readObject = async (url: URL): Promise<Record<string, unknown>> => {
  const value: unknown = JSON.parse(await Bun.file(url).text());
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${url.pathname} must contain a JSON object`);
  }
  return value as Record<string, unknown>;
};

const pngDimensions = async (url: URL): Promise<readonly [number, number]> => {
  const buffer = await Bun.file(url).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10] as const;
  expect([...bytes.slice(0, signature.length)]).toEqual([...signature]);
  const view = new DataView(buffer);
  return [view.getUint32(16), view.getUint32(20)];
};

const pngColorType = async (url: URL): Promise<number> => {
  const buffer = await Bun.file(url).arrayBuffer();
  return new DataView(buffer).getUint8(25);
};

describe("PWA assets", () => {
  test("declares an installable, hash-routed manifest with correctly sized icons", async () => {
    const manifest = await readObject(new URL("../manifest.webmanifest", import.meta.url));
    expect(manifest.display).toBe("standalone");
    expect(manifest.name).toBe("Sideset");
    expect(manifest.start_url).toBe("./#/wallet");
    expect(manifest.scope).toBe("./");

    if (!Array.isArray(manifest.icons)) throw new Error("Manifest icons must be an array");
    const icons: readonly unknown[] = manifest.icons;
    const expected = new Map([
      ["./icons/icon-192.png", 192],
      ["./icons/icon-512.png", 512],
      ["./icons/icon-maskable-512.png", 512],
    ]);
    const seen = new Set<string>();
    for (const icon of icons) {
      if (typeof icon !== "object" || icon === null || !("src" in icon)) {
        throw new Error("Manifest icon must declare src");
      }
      const src = icon.src;
      if (typeof src !== "string") throw new Error("Manifest icon src must be a string");
      if (seen.has(src)) throw new Error(`Duplicate manifest icon: ${src}`);
      seen.add(src);
      const size = expected.get(src);
      if (size === undefined) throw new Error(`Unexpected manifest icon: ${src}`);
      if (src.includes("maskable") && (!("purpose" in icon) || icon.purpose !== "maskable")) {
        throw new Error("Maskable icon must declare its purpose");
      }
      const path = src.startsWith("./") ? src.slice(2) : src;
      expect(await pngDimensions(new URL(`../${path}`, import.meta.url))).toEqual([size, size]);
    }
    expect(icons).toHaveLength(expected.size);
    expect(seen).toEqual(new Set(expected.keys()));
  });

  test("loads install metadata without a runtime font dependency", async () => {
    const html = await Bun.file(new URL("../index.html", import.meta.url)).text();
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('href="./icons/favicon-32.png"');
    expect(html).toContain("<title>Sideset</title>");
    expect(html).toContain('name="theme-color"');
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("fonts.gstatic.com");
  });

  test("keeps standalone content clear of the iOS status bar", async () => {
    const styles = await Bun.file(new URL("../src/styles.css", import.meta.url)).text();
    expect(styles).toContain("--kc-top-inset: calc(env(safe-area-inset-top) + 8px)");
    expect(styles).toContain("--space-6: 24px");
    expect(styles.match(/calc\(var\(--space-6\) \+ var\(--kc-top-inset\)\)/gu)).toHaveLength(3);
  });

  test("ships transparent light, dark, mark, and favicon PNGs", async () => {
    const assets = [
      "../assets/brand/sideset-logo-light.png",
      "../assets/brand/sideset-logo-dark.png",
      "../assets/brand/sideset-mark.png",
      "../icons/favicon-32.png",
    ] as const;
    for (const asset of assets) {
      expect(await pngColorType(new URL(asset, import.meta.url))).toBe(6);
    }
    expect(await pngDimensions(new URL("../icons/favicon-32.png", import.meta.url))).toEqual([
      32, 32,
    ]);
  });
});
