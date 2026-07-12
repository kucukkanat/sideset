import { type Contact, PROVIDER_META, paletteFor, proofVerificationUrl } from "@keychain/core";
import { type ReactElement, type RefObject, useEffect, useRef, useState } from "react";
import { BackIcon, CopyIcon, EditIcon, ProviderIcon, ShareIcon, TrashIcon } from "../icons.tsx";

interface ContactDetailProps {
  contact: Contact;
  profileLink: string;
  heroRef: RefObject<HTMLDivElement | null>;
  heroHidden: boolean;
  onBack: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onCopyProfileLink: () => void;
  onCopyPublicKey: () => void;
  onShare: () => void;
  onRemovalDialogChange: (open: boolean) => void;
}

export const ContactDetail = ({
  contact,
  profileLink,
  heroRef,
  heroHidden,
  onBack,
  onEdit,
  onRemove,
  onCopyProfileLink,
  onCopyPublicKey,
  onShare,
  onRemovalDialogChange,
}: ContactDetailProps): ReactElement => {
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const removeButtonRef = useRef<HTMLButtonElement | null>(null);
  const cancelRemovalButtonRef = useRef<HTMLButtonElement | null>(null);
  const palette = paletteFor(contact.color);

  useEffect(() => {
    if (!confirmingRemoval) return;
    requestAnimationFrame(() => cancelRemovalButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setConfirmingRemoval(false);
      requestAnimationFrame(() => removeButtonRef.current?.focus());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmingRemoval]);

  useEffect(() => {
    onRemovalDialogChange(confirmingRemoval);
  }, [confirmingRemoval, onRemovalDialogChange]);

  useEffect(() => () => onRemovalDialogChange(false), [onRemovalDialogChange]);

  const cancelRemoval = (): void => {
    setConfirmingRemoval(false);
    requestAnimationFrame(() => removeButtonRef.current?.focus());
  };

  return (
    <div
      data-testid={`screen-contact-detail-${contact.id}`}
      className="scr screen contact-detail-screen"
      style={{ padding: "0 0 118px", animationDuration: ".3s" }}
    >
      <div
        ref={heroRef}
        className="detail-hero"
        aria-hidden={confirmingRemoval || undefined}
        inert={confirmingRemoval || undefined}
        style={{
          background: palette.grad,
          opacity: heroHidden ? 0 : 1,
          pointerEvents: heroHidden ? "none" : "auto",
        }}
      >
        <div className="hero-sheen" />
        <div className="contact-detail-hero-actions">
          <button
            data-testid="contact-detail-back"
            type="button"
            aria-label="Back to people"
            className="hero-btn press"
            style={{ border: 0, color: "inherit" }}
            onClick={onBack}
          >
            <BackIcon />
          </button>
          <button
            data-testid="contact-detail-edit"
            type="button"
            aria-label={`Edit ${contact.name}`}
            className="hero-btn press"
            style={{ border: 0, color: "inherit" }}
            onClick={onEdit}
          >
            <EditIcon />
          </button>
        </div>
        <div className="hero-id">
          <div className="hero-avatar">{contact.avatar}</div>
          <div className="hero-name">{contact.name}</div>
          <div className="hero-tag">{contact.handle}</div>
          <div className="hero-bio">{contact.bio || "No notes or bio yet."}</div>
        </div>
      </div>

      <div
        className="contact-detail-content"
        aria-hidden={confirmingRemoval || undefined}
        inert={confirmingRemoval || undefined}
      >
        <div className="contact-detail-stats" role="group" aria-label="Contact summary">
          <div>
            <strong>{contact.mutuals}</strong>
            <span>mutual contacts</span>
          </div>
          <div>
            <strong>{contact.proofs.length}</strong>
            <span>connected accounts</span>
          </div>
        </div>

        <div className="contact-detail-actions">
          <button
            data-testid="contact-detail-share-action"
            type="button"
            className="action-tile press"
            onClick={onShare}
          >
            <span className="ico" style={{ background: "#FFEDE7" }} aria-hidden="true">
              <ShareIcon />
            </span>
            <span className="lbl">Share contact</span>
          </button>
          <button
            ref={removeButtonRef}
            data-testid="contact-detail-remove"
            type="button"
            className="action-tile contact-detail-remove-action press"
            onClick={() => setConfirmingRemoval(true)}
          >
            <span className="ico" aria-hidden="true">
              <TrashIcon />
            </span>
            <span className="lbl">Remove contact</span>
          </button>
        </div>

        <section className="contact-detail-section" aria-labelledby="contact-profile-link-title">
          <div className="contact-detail-section-heading">
            <div>
              <h2 id="contact-profile-link-title">Profile link</h2>
              <p>Share the full contact profile.</p>
            </div>
          </div>
          <button
            data-testid="contact-detail-copy-link"
            type="button"
            aria-label={`Copy ${contact.name}'s profile link`}
            className="contact-copy-row press"
            onClick={onCopyProfileLink}
          >
            <span className="contact-copy-icon" aria-hidden="true">
              🔗
            </span>
            <span className="contact-copy-body">
              <strong>{profileLink}</strong>
              <small>Tap to copy</small>
            </span>
            <CopyIcon />
          </button>
        </section>

        {contact.npub.length > 0 && (
          <section className="contact-detail-section" aria-labelledby="contact-public-key-title">
            <div className="contact-detail-section-heading">
              <div>
                <h2 id="contact-public-key-title">Public key</h2>
                <p>The permanent identity for this contact.</p>
              </div>
            </div>
            <button
              data-testid="contact-detail-copy-public-key"
              type="button"
              aria-label={`Copy ${contact.name}'s public key`}
              className="contact-copy-row press"
              onClick={onCopyPublicKey}
            >
              <span className="contact-copy-icon" aria-hidden="true">
                🔑
              </span>
              <span className="contact-copy-body">
                <code>{contact.npub}</code>
                <small>Tap to copy</small>
              </span>
              <CopyIcon />
            </button>
          </section>
        )}

        {contact.proofs.length > 0 && (
          <section
            data-testid="contact-detail-accounts"
            className="contact-detail-section"
            aria-labelledby="contact-accounts-title"
          >
            <div className="contact-detail-section-heading">
              <div>
                <h2 id="contact-accounts-title">Connected accounts</h2>
                <p>Open a platform to check each account yourself.</p>
              </div>
            </div>
            <div className="panel">
              {contact.proofs.map((proof) => {
                const meta = PROVIDER_META[proof.provider];
                return (
                  <div
                    data-testid={`contact-account-${proof.provider}`}
                    key={proof.provider}
                    className="row"
                    style={{ padding: "13px 16px" }}
                  >
                    <div className="row-icon" style={{ background: meta.bg }}>
                      <ProviderIcon provider={proof.provider} />
                    </div>
                    <div className="row-body">
                      <div className="row-title ellip">{proof.username}</div>
                      <div className="row-sub">Connected via {meta.name}</div>
                    </div>
                    <a
                      data-testid={`contact-account-${proof.provider}-verify`}
                      className="contact-proof-verify press"
                      href={proofVerificationUrl(proof)}
                      target={proof.provider === "email" ? undefined : "_blank"}
                      rel={proof.provider === "email" ? undefined : "noopener noreferrer"}
                      aria-label={`Verify ${proof.username} on ${meta.name}`}
                    >
                      Verify <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {confirmingRemoval && (
        <div className="contact-dialog-layer">
          <div
            data-testid="remove-contact-dialog"
            className="contact-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="remove-contact-title"
            aria-describedby="remove-contact-description"
          >
            <div className="contact-confirm-icon">🗑️</div>
            <h2 id="remove-contact-title">Remove {contact.name}?</h2>
            <p id="remove-contact-description">
              This removes the contact from this device. This can’t be undone.
            </p>
            <div className="contact-confirm-actions">
              <button
                ref={cancelRemovalButtonRef}
                data-testid="remove-contact-cancel"
                type="button"
                className="btn-light press"
                onClick={cancelRemoval}
              >
                Cancel
              </button>
              <button
                data-testid="remove-contact-confirm"
                type="button"
                className="contact-confirm-remove press"
                onClick={onRemove}
              >
                Remove contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
