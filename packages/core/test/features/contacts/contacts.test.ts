import { describe, expect, test } from "bun:test";
import { removeContacts, SEED_CONTACTS, searchContacts, updateContact } from "@keychain/core";

describe("contact management", () => {
  test("searches local profile, public-key, and connected-account fields", () => {
    expect(searchContacts(SEED_CONTACTS, "  ")).toBe(SEED_CONTACTS);
    expect(searchContacts(SEED_CONTACTS, "MILO").map((contact) => contact.id)).toEqual(["p2"]);
    expect(searchContacts(SEED_CONTACTS, "aria@art.co").map((contact) => contact.id)).toEqual([
      "p1",
    ]);
    expect(searchContacts(SEED_CONTACTS, "npub1sn3").map((contact) => contact.id)).toEqual(["p3"]);
    expect(searchContacts(SEED_CONTACTS, "missing")).toEqual([]);
  });

  test("updates only editable fields on the requested contact", () => {
    const updated = updateContact(SEED_CONTACTS, "p2", {
      name: "Milo Updated",
      handle: "@milo-updated",
      avatar: "🦉",
      bio: "Updated locally",
    });

    expect(updated).not.toBe(SEED_CONTACTS);
    expect(updated.find((contact) => contact.id === "p2")).toMatchObject({
      name: "Milo Updated",
      handle: "@milo-updated",
      avatar: "🦉",
      bio: "Updated locally",
      npub: SEED_CONTACTS[1]?.npub,
      proofs: SEED_CONTACTS[1]?.proofs,
    });
    expect(updated.find((contact) => contact.id === "p1")).toBe(SEED_CONTACTS[0]);
  });

  test("removes a deduplicated set of contacts without mutating the source", () => {
    expect(removeContacts(SEED_CONTACTS, [])).toBe(SEED_CONTACTS);
    const remaining = removeContacts(SEED_CONTACTS, ["p1", "p3", "p1", "missing"]);
    expect(remaining.map((contact) => contact.id)).toEqual(["p2", "p4", "p5"]);
    expect(SEED_CONTACTS).toHaveLength(5);
  });
});
