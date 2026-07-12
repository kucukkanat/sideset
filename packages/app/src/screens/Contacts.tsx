import { type Contact, paletteFor, searchContacts } from "@keychain/core";
import { Check, Search, Trash2, UsersRound } from "lucide-react";
import {
  type MutableRefObject,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CardAvatar } from "../components/CardAvatar.tsx";
import { ChevronIcon, PlusIcon, SearchIcon, TrashIcon } from "../icons.tsx";

interface ContactsProps {
  contacts: readonly Contact[];
  cardEls: MutableRefObject<Record<string, HTMLButtonElement>>;
  savedScroll: MutableRefObject<number>;
  query: string;
  onQueryChange: (query: string) => void;
  onManagingChange: (managing: boolean) => void;
  onOpen: (id: string, el: HTMLElement | null) => void;
  onImport: () => void;
  onRemove: (contactIds: readonly string[]) => void;
}

const resultLabel = (count: number, total: number, filtering: boolean): string =>
  filtering ? `${count} of ${total} people` : `${total} ${total === 1 ? "person" : "people"}`;

export const Contacts = ({
  contacts,
  cardEls,
  savedScroll,
  query,
  onQueryChange,
  onManagingChange,
  onOpen,
  onImport,
  onRemove,
}: ContactsProps): ReactElement => {
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const manageButtonRef = useRef<HTMLButtonElement | null>(null);
  const bulkRemoveButtonRef = useRef<HTMLButtonElement | null>(null);
  const cancelRemovalButtonRef = useRef<HTMLButtonElement | null>(null);
  const visibleContacts = useMemo(() => searchContacts(contacts, query), [contacts, query]);
  const allVisibleSelected =
    visibleContacts.length > 0 && visibleContacts.every((contact) => selected.has(contact.id));
  const selectedCount = selected.size;

  useEffect(() => {
    if (scrollerRef.current !== null) scrollerRef.current.scrollTop = savedScroll.current;
  }, [savedScroll]);

  useEffect(() => {
    onManagingChange(managing);
  }, [managing, onManagingChange]);

  useEffect(() => () => onManagingChange(false), [onManagingChange]);

  useEffect(() => {
    if (!managing) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (confirmingRemoval) {
        setConfirmingRemoval(false);
        requestAnimationFrame(() => bulkRemoveButtonRef.current?.focus());
        return;
      }
      setSelected(new Set());
      setManaging(false);
      requestAnimationFrame(() => manageButtonRef.current?.focus());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmingRemoval, managing]);

  useEffect(() => {
    if (confirmingRemoval) requestAnimationFrame(() => cancelRemovalButtonRef.current?.focus());
  }, [confirmingRemoval]);

  const toggleContact = (contactId: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const toggleAllVisible = (): void => {
    setSelected((current) => {
      const next = new Set(current);
      for (const contact of visibleContacts) {
        if (allVisibleSelected) next.delete(contact.id);
        else next.add(contact.id);
      }
      return next;
    });
  };

  const finishManaging = (): void => {
    setManaging(false);
    setSelected(new Set());
    setConfirmingRemoval(false);
  };

  const confirmRemoval = (): void => {
    const contactIds = [...selected];
    if (contactIds.length === 0) return;
    onRemove(contactIds);
    finishManaging();
    requestAnimationFrame(() => manageButtonRef.current?.focus());
  };

  return (
    <div
      data-testid="screen-contacts"
      className="scr screen contacts-screen"
      ref={scrollerRef}
      onScroll={(event) => {
        savedScroll.current = event.currentTarget.scrollTop;
      }}
    >
      <div
        className="contacts-shell"
        aria-hidden={confirmingRemoval || undefined}
        inert={confirmingRemoval || undefined}
      >
        <header className="contacts-header">
          <div>
            <div className="hdr-sub">Your private address book</div>
            <h1 className="hdr-title">People</h1>
          </div>
          <div className="contacts-header-actions">
            {contacts.length > 0 && (
              <button
                ref={manageButtonRef}
                data-testid="contacts-manage"
                type="button"
                className="contact-toolbar-button press"
                aria-pressed={managing}
                aria-controls="contacts-list"
                onClick={() => {
                  if (managing) finishManaging();
                  else setManaging(true);
                }}
              >
                {managing ? "Done" : "Manage"}
              </button>
            )}
            {!managing && contacts.length > 0 && (
              <button
                data-testid="contacts-import-profile"
                type="button"
                className="contact-add-button press"
                onClick={onImport}
              >
                <span aria-hidden="true">
                  <PlusIcon size={18} width={2.5} />
                </span>
                Add
              </button>
            )}
          </div>
        </header>

        <div className="contacts-search-wrap">
          <span aria-hidden="true">
            <SearchIcon stroke="var(--kc-subtle)" />
          </span>
          <input
            data-testid="contacts-search"
            className="contacts-search"
            type="search"
            aria-label="Search contacts"
            placeholder="Search names, handles, accounts, or keys"
            disabled={managing}
            value={query}
            onInput={(event) => onQueryChange(event.currentTarget.value)}
          />
        </div>

        <div className="contacts-list-meta">
          <span>
            {resultLabel(visibleContacts.length, contacts.length, query.trim().length > 0)}
          </span>
          {managing && visibleContacts.length > 0 && (
            <button
              data-testid="contacts-select-all"
              type="button"
              className="contact-text-button press"
              onClick={toggleAllVisible}
            >
              {allVisibleSelected ? "Clear results" : `Select all ${visibleContacts.length}`}
            </button>
          )}
        </div>

        {contacts.length === 0 ? (
          <div data-testid="contacts-empty" className="contacts-empty">
            <div className="contacts-empty-icon">
              <UsersRound aria-hidden="true" size={42} />
            </div>
            <h2>No contacts yet</h2>
            <p>Add a profile link or public key to start your private address book.</p>
            <button
              data-testid="contacts-empty-add"
              type="button"
              className="btn-dark press"
              onClick={onImport}
            >
              Add your first contact
            </button>
          </div>
        ) : visibleContacts.length === 0 ? (
          <div data-testid="contacts-no-results" className="contacts-empty">
            <div className="contacts-empty-icon">
              <Search aria-hidden="true" size={42} />
            </div>
            <h2>No matching people</h2>
            <p>Try a name, handle, connected account, or public key.</p>
            <button
              data-testid="contacts-clear-search"
              type="button"
              className="contact-toolbar-button press"
              onClick={() => onQueryChange("")}
            >
              Clear search
            </button>
          </div>
        ) : (
          <ul id="contacts-list" data-testid="contacts-list" className="contacts-list">
            {visibleContacts.map((contact) => {
              const palette = paletteFor(contact.color);
              const selectedContact = selected.has(contact.id);
              const accountLabel =
                contact.proofs.length === 0
                  ? contact.npub.length > 0
                    ? "Saved by public key"
                    : "No connected accounts"
                  : `${contact.proofs.length} connected ${contact.proofs.length === 1 ? "account" : "accounts"}`;
              return (
                <li key={contact.id}>
                  {managing ? (
                    <label
                      className={`contact-row contact-row-selectable${selectedContact ? " is-selected" : ""}`}
                    >
                      <input
                        data-testid={`contact-select-${contact.id}`}
                        type="checkbox"
                        checked={selectedContact}
                        onChange={() => toggleContact(contact.id)}
                        aria-label={`Select ${contact.name}`}
                      />
                      <span
                        className="contact-row-avatar"
                        style={{ background: palette.grad }}
                        aria-hidden="true"
                      >
                        <CardAvatar
                          card={contact}
                          seed={contact.npub || contact.id}
                          style={{ width: "100%", height: "100%" }}
                        />
                      </span>
                      <span className="contact-row-copy">
                        <strong>{contact.name}</strong>
                        <span>{contact.handle}</span>
                        <small>{accountLabel}</small>
                      </span>
                      <span className="contact-selection-mark" aria-hidden="true">
                        {selectedContact ? (
                          <Check aria-hidden="true" size={14} strokeWidth={3} />
                        ) : null}
                      </span>
                    </label>
                  ) : (
                    <button
                      ref={(element) => {
                        if (element !== null) cardEls.current[contact.id] = element;
                      }}
                      data-testid={`contact-card-${contact.id}`}
                      type="button"
                      className="contact-row contact-row-open press"
                      onClick={(event) => onOpen(contact.id, event.currentTarget)}
                    >
                      <span
                        className="contact-row-avatar"
                        style={{ background: palette.grad }}
                        aria-hidden="true"
                      >
                        <CardAvatar
                          card={contact}
                          seed={contact.npub || contact.id}
                          style={{ width: "100%", height: "100%" }}
                        />
                      </span>
                      <span className="contact-row-copy">
                        <strong>{contact.name}</strong>
                        <span>{contact.handle}</span>
                        <small>{accountLabel}</small>
                      </span>
                      <span className="contact-row-aside">
                        <small>{contact.mutuals} mutual</small>
                        <ChevronIcon />
                      </span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {managing && (
        <div
          className="contacts-bulk-bar"
          aria-hidden={confirmingRemoval || undefined}
          inert={confirmingRemoval || undefined}
        >
          <div
            data-testid="contacts-selection-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <strong>{selectedCount}</strong>
            <span>{selectedCount === 1 ? " contact selected" : " contacts selected"}</span>
          </div>
          <button
            ref={bulkRemoveButtonRef}
            data-testid="contacts-bulk-remove"
            type="button"
            className="contact-remove-button press"
            disabled={selectedCount === 0}
            onClick={() => setConfirmingRemoval(true)}
          >
            <span aria-hidden="true">
              <TrashIcon />
            </span>
            Remove
          </button>
        </div>
      )}

      {confirmingRemoval && (
        <div className="contact-dialog-layer">
          <div
            data-testid="remove-contacts-dialog"
            className="contact-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="remove-contacts-title"
            aria-describedby="remove-contacts-description"
          >
            <div className="contact-confirm-icon">
              <Trash2 aria-hidden="true" size={38} />
            </div>
            <h2 id="remove-contacts-title">
              Remove {selectedCount} {selectedCount === 1 ? "contact" : "contacts"}?
            </h2>
            <p id="remove-contacts-description">
              This removes {selectedCount === 1 ? "this contact" : "these contacts"} from this
              device. This can’t be undone.
            </p>
            <div className="contact-confirm-actions">
              <button
                ref={cancelRemovalButtonRef}
                data-testid="remove-contacts-cancel"
                type="button"
                className="btn-light press"
                onClick={() => {
                  setConfirmingRemoval(false);
                  requestAnimationFrame(() => bulkRemoveButtonRef.current?.focus());
                }}
              >
                Cancel
              </button>
              <button
                data-testid="remove-contacts-confirm"
                type="button"
                className="contact-confirm-remove press"
                onClick={confirmRemoval}
              >
                Remove {selectedCount}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
