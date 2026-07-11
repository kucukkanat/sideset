import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "../src/App.tsx";

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<App />);
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// Smallest element whose text matches — tolerates decorative child spans/icons.
const maybeByText = (text: string): HTMLElement | undefined =>
  [...document.querySelectorAll<HTMLElement>("div,span,button,b")]
    .filter((d) => d.textContent?.trim() === text)
    .sort((a, b) => a.querySelectorAll("*").length - b.querySelectorAll("*").length)[0];
const byText = (text: string): HTMLElement => {
  const el = maybeByText(text);
  if (!el) throw new Error(`No element with text "${text}"`);
  return el;
};

const click = async (el: HTMLElement): Promise<void> => {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};
const clickText = async (text: string): Promise<void> => click(byText(text));

/** Set a controlled input's value the way a browser would, so React sees it. */
const type = async (el: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> => {
  const proto = Object.getPrototypeOf(el) as object;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const settle = async (ms: number): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

describe("home screen", () => {
  test("shows the wallet header, all cards and the active badge", () => {
    expect(maybeByText("Wallet")).toBeDefined();
    for (const name of ["Everyday", "Work", "Anon"]) expect(maybeByText(name)).toBeDefined();
    expect(maybeByText("ACTIVE")).toBeDefined();
    expect(maybeByText("Verified your X account")).toBeDefined();
  });

  test("tapping a flank card brings it to the front instead of opening it", async () => {
    await clickText("Work");
    // Work is now front but not active — no detail hero appeared.
    expect(maybeByText("Switch to this card")).toBeUndefined();
    // Tapping the front, non-active card activates it.
    await clickText("Work");
    expect(maybeByText("Work is now active")).toBeDefined();
  });

  test("tapping the front active card opens the card detail", async () => {
    await clickText("Everyday");
    expect(maybeByText("This card is active")).toBeDefined();
    await settle(700); // flip morph finishes and the overlay unmounts
    expect(maybeByText("Add a proof")).toBeDefined();
  });
});

describe("navigation", () => {
  test("bottom nav reaches every screen", async () => {
    await clickText("People");
    expect(maybeByText("Contacts")).toBeDefined();
    await clickText("Activity");
    expect(maybeByText("Everything that happened, in plain English")).toBeDefined();
    await clickText("Settings");
    expect(maybeByText("Keychain · Version 1.0")).toBeDefined();
    await clickText("Wallet");
    expect(maybeByText("Proof this is really you")).toBeDefined();
  });
});

describe("settings", () => {
  test("toggles flip and the profile row opens the active card", async () => {
    await clickText("Settings");
    const toggle = document.querySelector<HTMLElement>('[role="switch"]');
    if (!toggle) throw new Error("no toggle");
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    await click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await clickText("Active card · Tap to manage");
    expect(maybeByText("This card is active")).toBeDefined();
  });
});

describe("card detail", () => {
  beforeEach(async () => {
    await clickText("Settings");
    await clickText("Active card · Tap to manage");
  });

  test("removing a proof updates the list and toasts", async () => {
    const removeButtons = [...document.querySelectorAll<HTMLElement>("div")].filter(
      (d) => d.textContent === "Remove" && d.children.length === 0,
    );
    expect(removeButtons.length).toBe(4); // Everyday has 4 proofs
    const btn = removeButtons[0];
    if (!btn) throw new Error("no remove button");
    await click(btn);
    expect(maybeByText("X proof removed")).toBeDefined();
    expect(maybeByText("@finnriver")).toBeUndefined();
  });

  test("edit sheet saves name and bio", async () => {
    const edit = document.querySelector<HTMLElement>('[aria-label="Edit"]')?.parentElement;
    if (!edit) throw new Error("no edit button");
    await click(edit);
    const input = document.querySelector<HTMLInputElement>("input");
    if (!input) throw new Error("no name input");
    expect(input.value).toBe("Everyday");
    await type(input, "Main");
    await clickText("Save changes");
    expect(maybeByText("Saved")).toBeDefined();
    expect(maybeByText("Main")).toBeDefined();
  });

  test("backup flow enforces password strength then completes", async () => {
    await clickText("Back up");
    await clickText("Save to iCloud");
    expect(maybeByText("Make it a bit stronger")).toBeDefined();
    const input = document.querySelector<HTMLInputElement>('input[type="password"]');
    if (!input) throw new Error("no password input");
    await type(input, "CorrectHorse7!");
    expect(maybeByText("Very strong")).toBeDefined();
    await clickText("Save to iCloud");
    expect(maybeByText("Backup saved")).toBeDefined();
    await clickText("Done");
    expect(maybeByText("Protected ✓")).toBeDefined();
  });
});

describe("proof flow", () => {
  test("verifies a new provider on the active card", async () => {
    await clickText("Add proof");
    expect(maybeByText("Facebook")).toBeDefined();
    await clickText("Facebook");
    await settle(2000); // proving step runs 1.9s
    expect(maybeByText("Proof verified")).toBeDefined();
    await clickText("Done");
    expect(maybeByText("Verified on Facebook")).toBeDefined();
    // The active card now shows a Facebook tile on the home strip.
    expect(maybeByText("Finn River")).toBeUndefined();
    expect(maybeByText("X · GitHub +3")).toBeDefined();
  });
});

describe("create flow", () => {
  test("requires a name, then creates and activates the card", async () => {
    await clickText("New card");
    await clickText("Create card");
    expect(maybeByText("Give your card a name")).toBeDefined();
    const input = document.querySelector<HTMLInputElement>("input");
    if (!input) throw new Error("no input");
    await type(input, "Gaming");
    await clickText("Create card");
    expect(maybeByText("Setting things up…")).toBeDefined();
    await settle(2200);
    expect(maybeByText("You're all set!")).toBeDefined();
    await clickText("Done");
    expect(maybeByText("Card created & activated")).toBeDefined();
    expect(maybeByText("Gaming")).toBeDefined();
  });
});

describe("contacts", () => {
  test("opens a contact detail and copies the public key", async () => {
    await clickText("People");
    expect(maybeByText("Aria Wolfe")).toBeDefined();
    await clickText("Aria Wolfe");
    await settle(700);
    expect(maybeByText("npub1ar9…kf20q")).toBeDefined();
    await clickText("npub1ar9…kf20q");
    expect(maybeByText("Public key copied")).toBeDefined();
    // back to the contact wall
    const back = document.querySelector<HTMLElement>('[aria-label="Back"]')?.parentElement;
    if (!back) throw new Error("no back button");
    await click(back);
    await settle(700);
    expect(maybeByText("Milo Chen")).toBeDefined();
  });
});
