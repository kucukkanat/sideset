import { afterEach, describe, expect, test } from "bun:test";
import { useWalletRouter, type WalletRouter, WalletRouterProvider } from "@app/router.tsx";
import {
  canonicalizeHashRoute,
  DEFAULT_ROUTE,
  formatHashRoute,
  parseHashRoute,
  type Route,
  routeWithoutOverlay,
} from "@app/routing/index.ts";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

const CASES: readonly { readonly route: Route; readonly hash: string }[] = [
  { route: { page: "wallet" }, hash: "#/wallet" },
  { route: { page: "wallet", cardId: "c2" }, hash: "#/wallet?card=c2" },
  {
    route: { page: "wallet", cardId: "card / two", sheet: "create" },
    hash: "#/wallet?card=card+%2F+two&sheet=create",
  },
  {
    route: { page: "wallet", cardId: "c3", sheet: "connect" },
    hash: "#/wallet?card=c3&sheet=connect",
  },
  { route: { page: "card", cardId: "c1" }, hash: "#/cards/c1" },
  {
    route: { page: "card", cardId: "card / λ", sheet: "share" },
    hash: "#/cards/card%20%2F%20%CE%BB?sheet=share",
  },
  { route: { page: "card", cardId: "c3", sheet: "connect" }, hash: "#/cards/c3?sheet=connect" },
  { route: { page: "people" }, hash: "#/people" },
  { route: { page: "people", sheet: "add" }, hash: "#/people?sheet=add" },
  {
    route: { page: "people", sheet: "add", profile: "eyJpZCI6ImFiYyJ9" },
    hash: "#/people?sheet=add&profile=eyJpZCI6ImFiYyJ9",
  },
  {
    route: { page: "person", contactId: "person / λ" },
    hash: "#/people/person%20%2F%20%CE%BB",
  },
  {
    route: { page: "person", contactId: "person / λ", sheet: "edit" },
    hash: "#/people/person%20%2F%20%CE%BB?sheet=edit",
  },
  {
    route: { page: "person", contactId: "person / λ", sheet: "share" },
    hash: "#/people/person%20%2F%20%CE%BB?sheet=share",
  },
  { route: { page: "activity" }, hash: "#/activity" },
  { route: { page: "tools", operation: "encrypt" }, hash: "#/tools/encrypt" },
  { route: { page: "tools", operation: "decrypt" }, hash: "#/tools/decrypt" },
  { route: { page: "tools", operation: "sign" }, hash: "#/tools/sign" },
  { route: { page: "tools", operation: "verify" }, hash: "#/tools/verify" },
  { route: { page: "tools", operation: "cloak" }, hash: "#/tools/cloak" },
  { route: { page: "features" }, hash: "#/settings/features" },
  { route: { page: "settings" }, hash: "#/settings" },
  { route: { page: "settings", sheet: "restore" }, hash: "#/settings?sheet=restore" },
];

describe("hash route parsing and formatting", () => {
  test("round-trips every route and uses stable query ordering", () => {
    for (const { route, hash } of CASES) {
      expect(formatHashRoute(route)).toBe(hash);
      expect(parseHashRoute(hash)).toEqual(route);
    }
  });

  test("canonicalizes reordered and unknown parameters", () => {
    expect(canonicalizeHashRoute("#/wallet?sheet=create&unused=x&card=c2")).toBe(
      "#/wallet?card=c2&sheet=create",
    );
    expect(canonicalizeHashRoute("#/people?profile=abc")).toBe("#/people");
    expect(canonicalizeHashRoute("#/cards/c1?profile=abc")).toBe("#/cards/c1");
    expect(canonicalizeHashRoute("#/tools")).toBe("#/tools/encrypt");
  });

  test("rejects malformed routes and invalid sheet combinations", () => {
    const invalid = [
      "",
      "#wallet",
      "#/unknown",
      "#/cards/",
      "#/cards/c1/",
      "#/cards/%E0%A4%A",
      "#/wallet?card=%E0%A4%A",
      "#/wallet?card=c1&card=c2",
      "#/wallet?sheet=edit",
      "#/cards/c1?sheet=create",
      "#/cards/c1?sheet=backup",
      "#/people?sheet=edit",
      "#/people?sheet=add&profile=not+padded",
      "#/people?sheet=add&profile=a&profile=b",
      "#/people/p1?sheet=add",
      "#/people/p1?sheet=remove",
      "#/activity?sheet=help",
      "#/tools/unknown",
      "#/tools/encrypt/extra",
      "#/tools/encrypt?sheet=help",
      "#/settings?sheet=create",
    ] as const;

    for (const hash of invalid) {
      expect(parseHashRoute(hash)).toEqual(DEFAULT_ROUTE);
      expect(canonicalizeHashRoute(hash)).toBe("#/wallet");
    }
  });

  test("rejects invalid constructed IDs and share payloads", () => {
    expect(() => formatHashRoute({ page: "card", cardId: "" })).toThrow();
    expect(() => formatHashRoute({ page: "wallet", cardId: "" })).toThrow();
    expect(() => formatHashRoute({ page: "person", contactId: "" })).toThrow();
    expect(() => formatHashRoute({ page: "people", sheet: "add", profile: "not valid" })).toThrow();
  });

  test("returns the page beneath route-backed overlays", () => {
    expect(routeWithoutOverlay({ page: "wallet", cardId: "c2", sheet: "create" })).toEqual({
      page: "wallet",
      cardId: "c2",
    });
    expect(routeWithoutOverlay({ page: "card", cardId: "c1", sheet: "edit" })).toEqual({
      page: "card",
      cardId: "c1",
    });
    expect(routeWithoutOverlay({ page: "people", sheet: "add", profile: "e30" })).toEqual({
      page: "people",
    });
    expect(routeWithoutOverlay({ page: "settings", sheet: "help" })).toEqual({
      page: "settings",
    });
    expect(routeWithoutOverlay({ page: "person", contactId: "p1", sheet: "edit" })).toEqual({
      page: "person",
      contactId: "p1",
    });
    expect(routeWithoutOverlay({ page: "activity" })).toBeNull();
    expect(routeWithoutOverlay({ page: "tools", operation: "encrypt" })).toBeNull();
    expect(routeWithoutOverlay({ page: "features" })).toBeNull();
  });
});

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let currentRouter: WalletRouter | undefined;

const Probe = (): ReactElement => {
  const router = useWalletRouter();
  currentRouter = router;
  return createElement("output", null, formatHashRoute(router.route));
};

const router = (): WalletRouter => {
  if (currentRouter === undefined) throw new Error("Router probe is not mounted");
  return currentRouter;
};

const mount = async (hash: string): Promise<void> => {
  window.history.replaceState(null, "", hash);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(createElement(WalletRouterProvider, null, createElement(Probe)));
    await waitForHistory();
  });
};

const waitForHistory = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

afterEach(async () => {
  const mountedRoot = root;
  if (mountedRoot !== undefined) {
    await act(async () => {
      mountedRoot.unmount();
    });
  }
  container?.remove();
  root = undefined;
  container = undefined;
  currentRouter = undefined;
});

describe("React Router adapter", () => {
  test("canonicalizes an invalid initial URL without adding history", async () => {
    await mount("#/cards/%E0%A4%A");
    expect(window.location.hash).toBe("#/wallet");
    expect(router().route).toEqual(DEFAULT_ROUTE);
  });

  test("pushes and replaces typed routes", async () => {
    await mount("#/wallet");
    await act(async () => {
      router().push({ page: "wallet" });
      await waitForHistory();
    });
    expect(window.location.hash).toBe("#/wallet");

    await act(async () => {
      router().push({ page: "people" });
      await waitForHistory();
    });
    expect(window.location.hash).toBe("#/people");
    expect(router().route).toEqual({ page: "people" });

    await act(async () => {
      router().replace({ page: "settings", sheet: "appearance" });
      await waitForHistory();
    });
    expect(window.location.hash).toBe("#/settings?sheet=appearance");
    expect(router().route).toEqual({ page: "settings", sheet: "appearance" });
  });

  test("closes a direct-loaded overlay with its parent fallback", async () => {
    await mount("#/cards/c1?sheet=edit");
    await act(async () => {
      router().closeOverlay();
      await waitForHistory();
    });
    expect(window.location.hash).toBe("#/cards/c1");
    expect(router().route).toEqual({ page: "card", cardId: "c1" });

    await act(async () => {
      router().replace({ page: "person", contactId: "p1", sheet: "edit" });
      await waitForHistory();
    });
    await act(async () => {
      router().closeOverlay();
      await waitForHistory();
    });
    expect(window.location.hash).toBe("#/people/p1");
    expect(router().route).toEqual({ page: "person", contactId: "p1" });
  });

  test("uses browser history for pushed routes and responds to back", async () => {
    await mount("#/wallet");
    await act(async () => {
      router().push({ page: "people" });
      await waitForHistory();
    });
    await act(async () => {
      router().back({ page: "wallet" });
      await waitForHistory();
    });
    expect(window.location.hash).toBe("#/wallet");
    expect(router().route).toEqual({ page: "wallet" });
  });

  test("responds to external hash changes", async () => {
    await mount("#/wallet");
    await act(async () => {
      window.location.hash = "#/people/p1";
      window.dispatchEvent(new PopStateEvent("popstate"));
      await waitForHistory();
    });
    expect(router().route).toEqual({ page: "person", contactId: "p1" });
  });
});
