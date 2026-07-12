import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "../src/App.tsx";
import { generateIdentityKeyPair } from "../src/accountVerification.ts";
import { createEncryptedBackup } from "../src/backup.ts";
import {
  decodeSharedProfile,
  encodeSharedProfile,
  sharedProfileTokenFromInput,
} from "../src/sharedProfile.ts";
import {
  createInitialWalletState,
  loadWalletState,
  saveWalletState,
  walletSnapshot,
} from "../src/storage.ts";

let container: HTMLDivElement | undefined;
let root: Root | undefined;

const tick = async (milliseconds = 0): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const unmount = async (): Promise<void> => {
  const mountedRoot = root;
  if (mountedRoot !== undefined) {
    await act(async () => {
      mountedRoot.unmount();
    });
  }
  container?.remove();
  root = undefined;
  container = undefined;
};

const mount = async (hash = "#/wallet"): Promise<void> => {
  await unmount();
  window.history.replaceState(null, "", hash);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<App />);
    await tick();
  });
  await act(async () => {
    await tick();
  });
};

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "#/wallet");
  document.documentElement.removeAttribute("data-theme");
});

afterEach(async () => {
  await unmount();
  localStorage.clear();
  window.history.replaceState(null, "", "#/wallet");
  document.documentElement.removeAttribute("data-theme");
});

const candidates = (): readonly HTMLElement[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>("button,[role='button'],div,span,label,h1,h2,p,b"),
  );

const maybeByText = (text: string): HTMLElement | undefined =>
  candidates()
    .filter((element) => element.textContent?.trim() === text)
    .sort(
      (left, right) => left.querySelectorAll("*").length - right.querySelectorAll("*").length,
    )[0];

const byText = (text: string): HTMLElement => {
  const element = maybeByText(text);
  if (element === undefined) throw new Error(`No element with text "${text}"`);
  return element;
};

const buttonContaining = (text: string): HTMLButtonElement => {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (element) => element.textContent?.includes(text),
  );
  if (button === undefined) throw new Error(`No button containing "${text}"`);
  return button;
};

const buttonByLabel = (label: string): HTMLButtonElement => {
  const button = document.querySelector<HTMLButtonElement>(
    `button[aria-label=${JSON.stringify(label)}]`,
  );
  if (button === null) throw new Error(`No button labelled "${label}"`);
  return button;
};

const click = async (element: HTMLElement): Promise<void> => {
  await act(async () => {
    element.click();
    await tick();
  });
};

const clickText = async (text: string): Promise<void> => click(byText(text));

const pointerDown = async (element: HTMLElement): Promise<void> => {
  await act(async () => {
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await tick();
  });
};

const type = async (
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): Promise<void> => {
  const prototype = Object.getPrototypeOf(element) as object;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
  await act(async () => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();
  });
};

const upload = async (element: HTMLInputElement, file: File): Promise<void> => {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  element.files = transfer.files;
  await act(async () => {
    element.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
  });
};

const waitFor = async (predicate: () => boolean, message: string): Promise<void> => {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await act(async () => {
      await tick(10);
    });
  }
  throw new Error(message);
};

const bodyText = (): string => document.body.textContent ?? "";

const maybeByTestId = (testId: string): HTMLElement | undefined =>
  document.querySelector<HTMLElement>(`[data-testid=${JSON.stringify(testId)}]`) ?? undefined;

const byTestId = (testId: string): HTMLElement => {
  const element = maybeByTestId(testId);
  if (element === undefined) throw new Error(`No element with test id "${testId}"`);
  return element;
};

const expectInteractiveElementsToHaveTestIds = (): void => {
  const controls = Array.from(
    document.querySelectorAll<HTMLElement>(
      "button,input,textarea,a,[role='button'],[role='radio']",
    ),
  );
  expect(controls.length).toBeGreaterThan(0);
  expect(controls.every((element) => (element.dataset.testid?.length ?? 0) > 0)).toBe(true);
};

describe("honest client-only wallet", () => {
  test("shows honest initial copy without protocol or payment jargon", async () => {
    await mount();

    expect(maybeByText("Wallet")).toBeDefined();
    expect(maybeByText("Connected accounts")).toBeDefined();
    expect(maybeByText("Accounts shown on this card")).toBeDefined();
    expect(maybeByText("Connected X account")).toBeDefined();
    expect(maybeByText("Connect account")).toBeDefined();
    expect(maybeByText("Coming soon")).toBeUndefined();
    expect(bodyText()).not.toMatch(
      /\bnostr\b|\brelay\b|\bproofs?\b|provably|public key|\bnpub\w*|\bsats\b/iu,
    );
  });

  test("exposes stable test IDs for every interactive element", async () => {
    for (const route of [
      "#/wallet",
      "#/people",
      "#/activity",
      "#/settings",
      "#/cards/c1",
      "#/people/p1",
      "#/people/p1?sheet=edit",
      "#/people?sheet=add",
      "#/settings?sheet=appearance",
      "#/settings?sheet=backup",
      "#/settings?sheet=restore",
      "#/settings?sheet=help",
      "#/cards/c1?sheet=share",
      "#/cards/c1?sheet=edit",
      "#/wallet?card=c1&sheet=create",
      "#/wallet?card=c1&sheet=connect",
      "#/cards/c1?sheet=connect",
    ]) {
      await mount(route);
      expectInteractiveElementsToHaveTestIds();
    }
  });

  test("bottom navigation updates the hash route", async () => {
    await mount();

    await clickText("People");
    expect(window.location.hash).toBe("#/people");
    expect(maybeByText("People")).toBeDefined();

    await clickText("Activity");
    expect(window.location.hash).toBe("#/activity");
    expect(maybeByText("Everything that happened, in plain English")).toBeDefined();

    await clickText("Settings");
    expect(window.location.hash).toBe("#/settings");
    expect(maybeByText("Keychain · Version 1.0")).toBeDefined();

    await clickText("Wallet");
    expect(window.location.hash).toBe("#/wallet");
  });

  test("connect account exposes GitHub verification and keeps other services unavailable", async () => {
    await mount("#/wallet?card=c3&sheet=connect");

    expect(maybeByText("Connect an account")).toBeDefined();
    expect(maybeByText("GitHub")).toBeDefined();
    expect((byTestId("connect-provider-github") as HTMLButtonElement).disabled).toBe(false);
    expect((byTestId("connect-provider-twitter") as HTMLButtonElement).disabled).toBe(true);

    await click(byTestId("connect-provider-github"));
    expect(maybeByText("Confirm your GitHub profile")).toBeDefined();
    await type(byTestId("connect-github-username") as HTMLInputElement, "octocat");
    await click(byTestId("connect-github-create-code"));
    expect(byTestId("connect-github-code").textContent).toMatch(/kc1\.[A-Za-z0-9_-]+\./u);
    expect(byTestId("connect-github-settings").getAttribute("href")).toBe(
      "https://github.com/settings/profile",
    );
  });

  test("opens a wallet card through navigation and supports a direct detail link", async () => {
    await mount();

    await clickText("Everyday");
    expect(window.location.hash).toBe("#/cards/c1");
    expect(maybeByText("This card is active")).toBeDefined();
    expect(maybeByText("Connected accounts")).toBeDefined();

    await mount("#/cards/c2");
    expect(window.location.hash).toBe("#/cards/c2");
    expect(maybeByText("Work")).toBeDefined();
    expect(maybeByText("Switch to this card")).toBeDefined();
  });

  test("copies a card's public key from its details", async () => {
    const initial = createInitialWalletState();
    const card = initial.cards[0];
    if (card === undefined) throw new Error("Initial wallet has no card");
    const identity = await generateIdentityKeyPair();
    expect(
      saveWalletState({
        ...initial,
        cards: [{ ...card, identity }, ...initial.cards.slice(1)],
      }),
    ).toEqual({ ok: true });

    await mount(`#/cards/${card.id}`);

    const copyPublicKey = byTestId("card-detail-copy-public-key");
    expect(copyPublicKey.textContent).toContain(identity.publicKey);
    await click(copyPublicKey);

    expect(await navigator.clipboard.readText()).toBe(identity.publicKey);
    expect(maybeByText("Public key copied")).toBeDefined();
  });

  test("runs and cleans the reverse flip after returning from card detail", async () => {
    await mount();

    await click(byTestId("home-card-c1"));
    await act(async () => {
      await tick(900);
    });
    await click(byTestId("card-detail-back"));

    expect(window.location.hash).toBe("#/wallet");
    expect(byTestId("home-card-c1").style.visibility).toBe("hidden");
    await waitFor(
      () => byTestId("flip-card").style.transform === "rotateY(0deg)",
      "Reverse flip did not reach the wallet card",
    );
    expect(byTestId("flip-card").style.transition).not.toBe("none");
    await act(async () => {
      await tick(900);
    });
    expect(maybeByTestId("screen-home")).toBeDefined();
    expect(maybeByTestId("flip-overlay")).toBeUndefined();
    expect(byTestId("home-card-c1").style.visibility).toBe("visible");
  });

  test("persists card edits and disconnected accounts across remounts", async () => {
    await mount("#/cards/c1");

    await click(buttonByLabel("Edit Everyday"));
    expect(window.location.hash).toBe("#/cards/c1?sheet=edit");
    const name = document.querySelector<HTMLInputElement>("input");
    const bio = document.querySelector<HTMLTextAreaElement>("textarea");
    if (name === null || bio === null) throw new Error("Missing edit fields");
    await type(name, "Main");
    await type(bio, "A locally saved profile");
    await clickText("Save changes");

    expect(window.location.hash).toBe("#/cards/c1");
    expect(maybeByText("Changes saved")).toBeDefined();
    expect(maybeByText("Main")).toBeDefined();

    const disconnect = buttonContaining("Disconnect");
    await click(disconnect);
    expect(maybeByText("X disconnected")).toBeDefined();
    expect(maybeByText("@finnriver")).toBeUndefined();

    const saved = loadWalletState();
    expect(saved.ok).toBe(true);
    expect(saved.state.cards.find((card) => card.id === "c1")?.name).toBe("Main");
    expect(saved.state.cards.find((card) => card.id === "c1")?.proofs).not.toContainEqual({
      provider: "twitter",
      username: "@finnriver",
    });

    await mount("#/cards/c1");
    expect(maybeByText("Main")).toBeDefined();
    expect(maybeByText("A locally saved profile")).toBeDefined();
    expect(maybeByText("@finnriver")).toBeUndefined();
  });

  test("creates and selects a persisted card in the URL", async () => {
    await mount();

    await clickText("New card");
    expect(window.location.hash).toBe("#/wallet?card=c1&sheet=create");
    const name = document.querySelector<HTMLInputElement>("input");
    if (name === null) throw new Error("Missing card name field");
    await type(name, "Gaming");
    await clickText("Create card");
    expect(maybeByText("Setting things up…")).toBeDefined();
    await act(async () => {
      await tick(700);
    });
    await clickText("Done");

    expect(window.location.hash).toMatch(/^#\/wallet\?card=[0-9a-f-]+$/u);
    expect(maybeByText("Card created and activated")).toBeDefined();
    expect(maybeByText("Gaming")).toBeDefined();
    expect(loadWalletState().state.cards.some((card) => card.name === "Gaming")).toBe(true);

    const selectedHash = window.location.hash;
    await mount(selectedHash);
    expect(window.location.hash).toBe(selectedHash);
    expect(maybeByText("Gaming")).toBeDefined();
  });

  test("opens the local account connector while keeping settings capabilities honest", async () => {
    await mount();

    const connectButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button"),
    ).filter((button) => button.textContent?.includes("Connect account"));
    expect(connectButtons.length).toBeGreaterThan(0);
    const connectButton = connectButtons[0];
    if (connectButton === undefined) throw new Error("Missing connect account button");
    await click(connectButton);
    expect(window.location.hash).toBe("#/wallet?card=c1&sheet=connect");
    await click(byTestId("sheet-backdrop"));
    expect(window.location.hash).toBe("#/wallet");

    await clickText("Settings");
    for (const label of ["Approve with Face ID", "Sync with iCloud", "Notifications"] as const) {
      const button = buttonContaining(label);
      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain("Coming soon");
      await click(button);
      expect(window.location.hash).toBe("#/settings");
    }
  });

  test("persists and applies the selected appearance", async () => {
    await mount("#/settings");

    await clickText("Appearance");
    expect(window.location.hash).toBe("#/settings?sheet=appearance");
    const dark = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button[role='radio']"),
    ).find((button) => button.textContent?.includes("Dark"));
    if (dark === undefined) throw new Error("Missing dark appearance option");
    await click(dark);

    expect(dark.getAttribute("aria-checked")).toBe("true");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(loadWalletState().state.theme).toBe("dark");

    await mount("#/settings");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(maybeByText("Dark")).toBeDefined();
  });

  test("renders direct contact routes with profile and key management", async () => {
    await mount("#/people/p1");

    expect(window.location.hash).toBe("#/people/p1");
    expect(maybeByText("Aria Wolfe")).toBeDefined();
    expect(maybeByText("Profile link")).toBeDefined();
    expect(maybeByText("Public key")).toBeDefined();
    expect(maybeByText("Connected accounts")).toBeDefined();
    expect(maybeByTestId("contact-detail-edit")).toBeDefined();
    expect(maybeByTestId("contact-detail-remove")).toBeDefined();
    const githubVerification = byTestId("contact-account-github-verify");
    expect(githubVerification).toBeInstanceOf(HTMLAnchorElement);
    expect(githubVerification.getAttribute("href")).toBe("https://github.com/ariawolfe");
    expect(githubVerification.getAttribute("target")).toBe("_blank");
    expect(githubVerification.getAttribute("rel")).toBe("noopener noreferrer");
    const emailVerification = byTestId("contact-account-email-verify");
    expect(emailVerification.getAttribute("href")).toBe("mailto:aria%40art.co");
    expect(emailVerification.hasAttribute("target")).toBe(false);
    await click(byTestId("contact-detail-copy-public-key"));
    expect(await navigator.clipboard.readText()).toBe("npub1ar9…kf20q");
    expect(maybeByText("Public key copied")).toBeDefined();
    expect(bodyText()).not.toMatch(/\bnostr\b|\brelay\b/iu);
  });

  test("searches contacts and preserves the query across detail navigation", async () => {
    await mount("#/people");

    const search = byTestId("contacts-search") as HTMLInputElement;
    await type(search, "MILO");
    expect(maybeByTestId("contact-card-p2")).toBeDefined();
    expect(maybeByTestId("contact-card-p1")).toBeUndefined();

    await click(byTestId("contact-card-p2"));
    expect(window.location.hash).toBe("#/people/p2");
    await click(byTestId("contact-detail-back"));
    expect(window.location.hash).toBe("#/people");
    expect((byTestId("contacts-search") as HTMLInputElement).value).toBe("MILO");
    expect(maybeByTestId("contact-card-p2")).toBeDefined();
    expect(maybeByTestId("contact-card-p1")).toBeUndefined();

    await type(byTestId("contacts-search") as HTMLInputElement, "no such person");
    expect(maybeByTestId("contacts-no-results")).toBeDefined();
    await click(byTestId("contacts-clear-search"));
    expect(maybeByTestId("contact-card-p1")).toBeDefined();
  });

  test("edits a contact while preserving immutable identity fields", async () => {
    const before = createInitialWalletState().contacts.find((person) => person.id === "p1");
    if (before === undefined) throw new Error("Missing seeded contact");
    await mount("#/people/p1");

    await click(byTestId("contact-detail-edit"));
    expect(window.location.hash).toBe("#/people/p1?sheet=edit");
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await tick();
    });
    expect(window.location.hash).toBe("#/people/p1");
    await click(byTestId("contact-detail-edit"));
    await type(byTestId("edit-contact-name") as HTMLInputElement, " ");
    await click(byTestId("edit-contact-save"));
    expect(maybeByText("Enter a name for this contact")).toBeDefined();
    await type(byTestId("edit-contact-name") as HTMLInputElement, "Aria Local");
    await type(byTestId("edit-contact-handle") as HTMLInputElement, "@");
    await click(byTestId("edit-contact-save"));
    expect(maybeByText("Enter a handle for this contact")).toBeDefined();
    await type(byTestId("edit-contact-handle") as HTMLInputElement, "aria-local");
    await type(byTestId("edit-contact-bio") as HTMLTextAreaElement, "A private local note");
    await click(byTestId("edit-contact-avatar-🦉"));
    await click(byTestId("edit-contact-save"));

    expect(window.location.hash).toBe("#/people/p1");
    expect(maybeByText("Contact updated")).toBeDefined();
    const updated = loadWalletState().state.contacts.find((person) => person.id === "p1");
    expect(updated).toMatchObject({
      name: "Aria Local",
      handle: "@aria-local",
      avatar: "🦉",
      bio: "A private local note",
      npub: before.npub,
      proofs: before.proofs,
    });

    await mount("#/people/p1?sheet=edit");
    await type(byTestId("edit-contact-handle") as HTMLInputElement, "milo");
    await click(byTestId("edit-contact-save"));
    expect(maybeByText("Another contact already uses this handle")).toBeDefined();
    expect(window.location.hash).toBe("#/people/p1?sheet=edit");
    expect(loadWalletState().state.contacts.find((person) => person.id === "p1")?.handle).toBe(
      "@aria-local",
    );
  });

  test("cancels and confirms individual contact removal", async () => {
    await mount("#/people/p1");

    await click(byTestId("contact-detail-remove"));
    expect(maybeByText("Remove Aria Wolfe?")).toBeDefined();
    expectInteractiveElementsToHaveTestIds();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await tick();
    });
    expect(maybeByTestId("remove-contact-dialog")).toBeUndefined();
    await click(byTestId("contact-detail-remove"));
    await click(byTestId("remove-contact-cancel"));
    expect(maybeByTestId("remove-contact-dialog")).toBeUndefined();
    expect(loadWalletState().state.contacts.some((person) => person.id === "p1")).toBe(true);

    await click(byTestId("contact-detail-remove"));
    await click(byTestId("remove-contact-confirm"));
    expect(window.location.hash).toBe("#/people");
    expect(loadWalletState().state.contacts.some((person) => person.id === "p1")).toBe(false);
    expect(loadWalletState().state.activity[0]?.title).toBe("Removed Aria Wolfe");

    await mount("#/people/p1");
    expect(window.location.hash).toBe("#/people");
    expect(maybeByTestId("contact-card-p1")).toBeUndefined();
  });

  test("selects and removes contacts in one confirmed bulk action", async () => {
    await mount("#/people");

    await click(byTestId("contacts-manage"));
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await tick();
    });
    expect(maybeByTestId("contacts-selection-status")).toBeUndefined();
    await click(byTestId("contacts-manage"));
    await click(byTestId("contact-select-p1"));
    await click(byTestId("contact-select-p3"));
    expect(maybeByText("2 contacts selected")).toBeDefined();
    expectInteractiveElementsToHaveTestIds();
    await click(byTestId("contacts-bulk-remove"));
    expect(maybeByText("Remove 2 contacts?")).toBeDefined();
    expectInteractiveElementsToHaveTestIds();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await tick();
    });
    expect(maybeByTestId("remove-contacts-dialog")).toBeUndefined();
    expect(maybeByText("2 contacts selected")).toBeDefined();
    await click(byTestId("contacts-bulk-remove"));
    await click(byTestId("remove-contacts-cancel"));
    expect(maybeByTestId("remove-contacts-dialog")).toBeUndefined();
    expect(maybeByText("2 contacts selected")).toBeDefined();

    await click(byTestId("contacts-bulk-remove"));
    await click(byTestId("remove-contacts-confirm"));
    const saved = loadWalletState();
    expect(saved.state.contacts.map((person) => person.id)).toEqual(["p2", "p4", "p5"]);
    expect(saved.state.activity[0]?.title).toBe("Removed 2 contacts");
    expect(maybeByTestId("contacts-selection-status")).toBeUndefined();

    await mount("#/people");
    expect(maybeByTestId("contact-card-p1")).toBeUndefined();
    expect(maybeByTestId("contact-card-p3")).toBeUndefined();
    expect(maybeByTestId("contact-card-p2")).toBeDefined();
  });

  test("select all is scoped to search results and renders a true empty state", async () => {
    await mount("#/people");
    await type(byTestId("contacts-search") as HTMLInputElement, "Milo");
    await click(byTestId("contacts-manage"));
    await click(byTestId("contacts-select-all"));
    expect(maybeByText("1 contact selected")).toBeDefined();
    expect((byTestId("contact-select-p2") as HTMLInputElement).checked).toBe(true);

    const initial = createInitialWalletState();
    expect(saveWalletState({ ...initial, contacts: [] })).toEqual({ ok: true });
    await mount("#/people");
    expect(maybeByTestId("contacts-empty")).toBeDefined();
    expect(maybeByTestId("contacts-empty-add")).toBeDefined();
  });

  test("shares a card as a scannable, copyable, valid profile link", async () => {
    await mount("#/cards/c1");

    await clickText("Share");
    expect(window.location.hash).toBe("#/cards/c1?sheet=share");
    expect(maybeByText("Share Everyday")).toBeDefined();

    const qr = document.querySelector<SVGElement>('svg[aria-label="Scannable profile code"]');
    expect(qr).not.toBeNull();
    expect(qr?.querySelector("path")?.getAttribute("d")?.length).toBeGreaterThan(1_000);

    await click(buttonContaining("Copy link"));
    await waitFor(() => maybeByText("Copied ✓") !== undefined, "Copy confirmation did not appear");

    const copied = await navigator.clipboard.readText();
    const copiedUrl = new URL(copied);
    expect(copiedUrl.search).toBe("");
    expect(copiedUrl.hash).toMatch(/^#\/people\?sheet=add&profile=[A-Za-z0-9_-]+$/u);
    const token = sharedProfileTokenFromInput(copied, window.location.href);
    if (token === null) throw new Error("Copied link did not contain a profile token");
    const decoded = decodeSharedProfile(token);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error("Copied profile token was invalid");
    expect(decoded.profile).toMatchObject({
      name: "Everyday",
      handle: "finnriver",
      avatar: "🦊",
    });

    await pointerDown(buttonByLabel("Close"));
    expect(window.location.hash).toBe("#/cards/c1");
  });

  test("creates a real encrypted backup through the settings UI", async () => {
    await mount("#/settings");

    await clickText("Export a backup");
    expect(window.location.hash).toBe("#/settings?sheet=backup");
    expect(maybeByText("Save a local backup")).toBeDefined();

    const password = document.querySelector<HTMLInputElement>("#backup-password");
    if (password === null) throw new Error("Missing backup password field");
    const create = buttonContaining("Create backup file");
    expect(create.disabled).toBe(true);
    await type(password, "Correct Horse 7! 🔐");
    expect(create.disabled).toBe(false);
    await click(create);
    await waitFor(() => maybeByText("Backup prepared") !== undefined, "Backup was not prepared");

    const download = document.querySelector<HTMLAnchorElement>("a[download]");
    expect(download).not.toBeNull();
    expect(download?.href).toStartWith("blob:");
    expect(download?.download).toMatch(/^keychain-backup-\d{4}-\d{2}-\d{2}\.json$/u);
    expect(
      loadWalletState().state.activity.some(
        (item) => item.title === "Prepared an encrypted backup" && item.sub === "Ready to download",
      ),
    ).toBe(true);

    await clickText("Done");
    expect(window.location.hash).toBe("#/settings");
    expect(maybeByText("Encrypted backup prepared")).toBeDefined();
  });

  test("rejects a wrong password then restores a real encrypted backup through the UI", async () => {
    const initial = createInitialWalletState();
    const first = initial.cards[0];
    if (first === undefined) throw new Error("Initial wallet has no card");
    const restoredState = {
      ...initial,
      cards: [{ ...first, name: "Restored Main" }, ...initial.cards.slice(1)],
      theme: "dark" as const,
    };
    const password = "Restore This 9!";
    const contents = await createEncryptedBackup(walletSnapshot(restoredState), password);
    const file = new File([contents], "keychain-backup.json", { type: "application/json" });

    await mount("#/settings");
    await clickText("Restore a backup");
    expect(window.location.hash).toBe("#/settings?sheet=restore");

    const fileInput = document.querySelector<HTMLInputElement>("#backup-file");
    const passwordInput = document.querySelector<HTMLInputElement>("#restore-password");
    if (fileInput === null || passwordInput === null) throw new Error("Missing restore fields");
    await upload(fileInput, file);
    await type(passwordInput, "Wrong password");
    await click(buttonContaining("Restore backup"));
    await waitFor(
      () => bodyText().includes("Wrong password, or the backup is damaged"),
      "Wrong-password error did not appear",
    );
    expect(window.location.hash).toBe("#/settings?sheet=restore");

    await type(passwordInput, password);
    await click(buttonContaining("Restore backup"));
    await waitFor(() => maybeByText("Backup restored") !== undefined, "Backup was not restored");

    const saved = loadWalletState();
    expect(saved.ok).toBe(true);
    expect(saved.state.cards[0]?.name).toBe("Restored Main");
    expect(saved.state.theme).toBe("dark");
    expect(saved.state.activity[0]?.title).toBe("Restored a local backup");
    expect(document.documentElement.dataset.theme).toBe("dark");

    await clickText("Done");
    expect(window.location.hash).toBe("#/settings");
    expect(maybeByText("Backup restored")).toBeDefined();
  });

  test("opens and closes local help through its route without technical jargon", async () => {
    await mount("#/settings");

    await clickText("Help & support");
    expect(window.location.hash).toBe("#/settings?sheet=help");
    expect(maybeByText("What is a card?")).toBeDefined();
    expect(maybeByText("Where is my information saved?")).toBeDefined();
    expect(maybeByText("How do I add someone?")).toBeDefined();
    expect(bodyText()).not.toMatch(/public key|\bnpub\w*|\bnostr\b|\brelay\b/iu);

    await pointerDown(buttonByLabel("Close"));
    expect(window.location.hash).toBe("#/settings");
  });

  test("imports a real encoded profile from an add-contact route", async () => {
    const profile = {
      id: "nova-profile",
      name: "Nova Lane",
      handle: "nova",
      avatar: "⭐",
      color: 2,
      bio: "Making small, useful things.",
      proofs: [{ provider: "github", username: "novalane" }] as const,
    };
    const encoded = encodeSharedProfile(profile);
    await mount(`#/people?sheet=add&profile=${encoded}`);

    expect(maybeByText("Nova Lane")).toBeDefined();
    await clickText("Add contact");

    expect(window.location.hash).toMatch(/^#\/people\/p-[a-z0-9]+$/u);
    expect(maybeByText("Nova Lane added")).toBeDefined();
    expect(maybeByText("Profile link")).toBeDefined();
    expect(loadWalletState().state.contacts.some((contact) => contact.name === "Nova Lane")).toBe(
      true,
    );
    expect(
      loadWalletState().state.contacts.find((contact) => contact.name === "Nova Lane")?.proofs,
    ).toEqual([]);

    const importedRoute = window.location.hash;
    await mount(importedRoute);
    expect(maybeByText("Nova Lane")).toBeDefined();
    expect(maybeByText("Connected accounts")).toBeUndefined();
  });

  test("adds a contact by public key and rejects the same key twice", async () => {
    const identity = await generateIdentityKeyPair();
    const initialContactCount = createInitialWalletState().contacts.length;
    await mount("#/people?sheet=add");

    expect(maybeByText("Profile link or public key")).toBeDefined();
    await type(
      byTestId("add-contact-profile-link") as HTMLInputElement,
      `  ${identity.publicKey}  `,
    );
    const name = byTestId("add-contact-public-key-name") as HTMLInputElement;
    expect((byTestId("add-contact-preview") as HTMLButtonElement).disabled).toBe(true);
    await type(name, "Ada Key");
    await click(byTestId("add-contact-preview"));
    expect(maybeByText("Ada Key")).toBeDefined();
    await click(byTestId("add-contact-save"));

    expect(window.location.hash).toMatch(/^#\/people\/p-[a-z0-9]+$/u);
    const saved = loadWalletState();
    const contact = saved.state.contacts.find((person) => person.npub === identity.publicKey);
    expect(saved.state.contacts).toHaveLength(initialContactCount + 1);
    expect(contact).toMatchObject({ name: "Ada Key", proofs: [], npub: identity.publicKey });
    const contactRoute = window.location.hash;
    await mount(contactRoute);
    expect(maybeByText("Ada Key")).toBeDefined();

    await mount("#/people?sheet=add");
    await type(byTestId("add-contact-profile-link") as HTMLInputElement, identity.publicKey);
    await type(byTestId("add-contact-public-key-name") as HTMLInputElement, "Duplicate");
    await click(byTestId("add-contact-preview"));
    await click(byTestId("add-contact-save"));

    expect(window.location.hash).toBe("#/people?sheet=add");
    expect(maybeByText("This contact is already in your list")).toBeDefined();
    expect(loadWalletState().state.contacts).toHaveLength(initialContactCount + 1);
  });

  test("rejects an invalid public key without adding a contact", async () => {
    const initialContactCount = createInitialWalletState().contacts.length;
    await mount("#/people?sheet=add");

    await type(byTestId("add-contact-profile-link") as HTMLInputElement, "not-a-public-key");
    await click(byTestId("add-contact-preview"));

    expect(maybeByText("Paste a valid profile link or public key")).toBeDefined();
    expect(window.location.hash).toBe("#/people?sheet=add");
    expect(loadWalletState().state.contacts).toHaveLength(initialContactCount);
  });

  test("rejects a public key already held by a legacy contact record", async () => {
    const identity = await generateIdentityKeyPair();
    const initial = createInitialWalletState();
    const existing = initial.contacts[0];
    if (existing === undefined) throw new Error("Initial wallet has no contacts");
    expect(
      saveWalletState({
        ...initial,
        contacts: [
          {
            ...existing,
            id: "legacy-key-contact",
            handle: "@legacy-key",
            npub: identity.publicKey,
          },
          ...initial.contacts.slice(1),
        ],
      }),
    ).toEqual({ ok: true });
    await mount("#/people?sheet=add");

    await type(byTestId("add-contact-profile-link") as HTMLInputElement, identity.publicKey);
    await type(byTestId("add-contact-public-key-name") as HTMLInputElement, "Duplicate");
    await click(byTestId("add-contact-preview"));
    await click(byTestId("add-contact-save"));

    expect(maybeByText("This contact is already in your list")).toBeDefined();
    expect(loadWalletState().state.contacts).toHaveLength(initial.contacts.length);
  });

  test("canonicalizes routes whose local record IDs do not exist", async () => {
    await mount("#/cards/not-a-card");
    expect(window.location.hash).toBe("#/wallet");
    expect(maybeByText("Wallet")).toBeDefined();

    await mount("#/people/not-a-contact");
    expect(window.location.hash).toBe("#/people");
    expect(maybeByText("People")).toBeDefined();

    await mount("#/people/not-a-contact?sheet=edit");
    expect(window.location.hash).toBe("#/people");

    await mount("#/wallet?card=not-a-card");
    expect(window.location.hash).toBe("#/wallet");
  });

  test("does not overwrite state created by a newer app schema", async () => {
    const newerState = JSON.stringify({ version: 2, opaque: "keep-me" });
    localStorage.setItem("keychain.wallet.v1", newerState);

    await mount();

    expect(localStorage.getItem("keychain.wallet.v1")).toBe(newerState);
    expect(maybeByText("Saved data needs a newer app; changes won’t be saved")).toBeDefined();
  });
});
