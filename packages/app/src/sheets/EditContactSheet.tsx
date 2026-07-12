import { type Contact, type ContactChanges, EMOJI_CHOICES, paletteFor } from "@keychain/core";
import { type FormEvent, type ReactElement, useState } from "react";

export type EditContactResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

export const EditContactSheet = ({
  contact,
  onCancel,
  onSave,
}: {
  contact: Contact;
  onCancel: () => void;
  onSave: (changes: ContactChanges) => EditContactResult;
}): ReactElement => {
  const [name, setName] = useState(contact.name);
  const [handle, setHandle] = useState(contact.handle.replace(/^@/u, ""));
  const [avatar, setAvatar] = useState(contact.avatar);
  const [bio, setBio] = useState(contact.bio);
  const [error, setError] = useState<string | null>(null);
  const palette = paletteFor(contact.color);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedHandle = handle.trim().replace(/^@+/u, "");
    if (normalizedName.length === 0) {
      setError("Enter a name for this contact");
      return;
    }
    if (normalizedHandle.length === 0) {
      setError("Enter a handle for this contact");
      return;
    }
    const result = onSave({
      name: normalizedName,
      handle: `@${normalizedHandle}`,
      avatar,
      bio,
    });
    if (!result.ok) setError(result.message);
  };

  return (
    <form
      data-testid="edit-contact-sheet"
      onSubmit={submit}
      style={{ animation: "riseIn .3s ease" }}
    >
      <div style={{ textAlign: "center" }}>
        <div className="sheet-title">Edit contact</div>
        <div className="sheet-lead">Update how this person appears in your wallet.</div>
      </div>

      <div className="edit-contact-avatar" style={{ background: palette.grad }}>
        {avatar}
      </div>
      <div className="edit-contact-avatar-grid" role="group" aria-label="Choose an avatar">
        {EMOJI_CHOICES.map((emoji) => (
          <button
            key={emoji}
            data-testid={`edit-contact-avatar-${emoji}`}
            type="button"
            aria-label={`Use ${emoji} as avatar`}
            aria-pressed={avatar === emoji}
            onClick={() => setAvatar(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="edit-contact-fields">
        <label htmlFor="edit-contact-name">
          <span className="sec-label">Name</span>
          <input
            data-testid="edit-contact-name"
            id="edit-contact-name"
            className="input"
            maxLength={80}
            value={name}
            aria-invalid={error === "Enter a name for this contact"}
            onInput={(event) => {
              setName(event.currentTarget.value);
              setError(null);
            }}
          />
        </label>
        <label htmlFor="edit-contact-handle">
          <span className="sec-label">Handle</span>
          <span className="edit-contact-handle-input">
            <span aria-hidden="true">@</span>
            <input
              data-testid="edit-contact-handle"
              id="edit-contact-handle"
              maxLength={80}
              autoCapitalize="none"
              autoCorrect="off"
              value={handle}
              aria-invalid={error === "Enter a handle for this contact"}
              onInput={(event) => {
                setHandle(event.currentTarget.value);
                setError(null);
              }}
            />
          </span>
        </label>
        <label htmlFor="edit-contact-bio">
          <span className="sec-label">Notes or bio</span>
          <textarea
            data-testid="edit-contact-bio"
            id="edit-contact-bio"
            className="input"
            maxLength={280}
            rows={3}
            value={bio}
            onInput={(event) => {
              setBio(event.currentTarget.value);
              setError(null);
            }}
          />
        </label>
      </div>

      {contact.npub.length > 0 && (
        <div className="edit-contact-key-note">
          <strong>Public key</strong>
          <code>{contact.npub}</code>
          <span>Identity keys can’t be edited.</span>
        </div>
      )}

      {error !== null && (
        <div data-testid="edit-contact-error" className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="edit-contact-actions">
        <button
          data-testid="edit-contact-cancel"
          type="button"
          className="btn-light press"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button data-testid="edit-contact-save" type="submit" className="btn-dark press">
          Save changes
        </button>
      </div>
    </form>
  );
};
