import type { Contact } from "./types.ts";

export type ContactChanges = Pick<Contact, "name" | "handle" | "avatar" | "bio">;

export const searchContacts = (contacts: readonly Contact[], query: string): readonly Contact[] => {
  const term = query.trim().toLowerCase();
  if (term.length === 0) return contacts;
  return contacts.filter((contact) =>
    [
      contact.name,
      contact.handle,
      contact.bio,
      contact.npub,
      ...contact.proofs.map((p) => p.username),
    ]
      .join("\n")
      .toLowerCase()
      .includes(term),
  );
};

export const updateContact = (
  contacts: readonly Contact[],
  contactId: string,
  changes: ContactChanges,
): readonly Contact[] =>
  contacts.map((contact) => (contact.id === contactId ? { ...contact, ...changes } : contact));

export const removeContacts = (
  contacts: readonly Contact[],
  contactIds: readonly string[],
): readonly Contact[] => {
  if (contactIds.length === 0) return contacts;
  const removed = new Set(contactIds);
  return contacts.filter((contact) => !removed.has(contact.id));
};
