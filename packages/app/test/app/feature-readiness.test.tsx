import { afterEach, describe, expect, test } from "bun:test";
import { FeatureReadiness } from "@app/features/FeatureReadiness.tsx";
import { FeatureLibrary } from "@features/settings/FeatureLibrary.tsx";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(async () => {
  const mounted = root;
  if (mounted !== undefined) await act(async () => mounted.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("feature readiness recovery", () => {
  test("offers one controlled reload for a worker/page version mismatch", async () => {
    let reloads = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        createElement(FeatureReadiness, {
          title: "Tools",
          status: "update-required",
          onReload: () => {
            reloads += 1;
          },
        }),
      );
    });

    expect(container.querySelector('[data-testid="feature-readiness-retry"]')).toBeNull();
    const reload = container.querySelector<HTMLButtonElement>(
      '[data-testid="feature-readiness-reload"]',
    );
    expect(reload?.textContent).toContain("Reload to update");
    await act(async () => reload?.click());
    expect(reloads).toBe(1);
  });

  test("offers the same reload recovery from a disabled Feature Library row", async () => {
    let reloads = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        createElement(FeatureLibrary, {
          items: [
            {
              id: "tools",
              title: "Tools",
              summary: "Optional tools",
              enabled: false,
              pinned: false,
              dockPosition: null,
              dockEligible: true,
              readiness: "update-required",
              canMoveEarlier: false,
              canMoveLater: false,
            },
          ],
          dockLabels: ["Wallet", "Settings"],
          onBack: () => undefined,
          onEnable: () => undefined,
          onDisable: () => undefined,
          onPin: () => undefined,
          onUnpin: () => undefined,
          onMove: () => undefined,
          onOpen: () => undefined,
          onRetry: () => undefined,
          onReload: () => {
            reloads += 1;
          },
        }),
      );
    });

    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="feature-tools-toggle"]',
    );
    const reload = container.querySelector<HTMLButtonElement>(
      '[data-testid="feature-tools-reload"]',
    );
    expect(toggle?.disabled).toBe(true);
    expect(container.querySelector('[data-testid="feature-tools-retry"]')).toBeNull();
    await act(async () => reload?.click());
    expect(reloads).toBe(1);
  });
});
