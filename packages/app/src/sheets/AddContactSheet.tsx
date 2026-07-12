import type { Proof } from "@keychain/core";
import { paletteFor } from "@keychain/core";
import {
  type FormEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CardAvatar } from "../components/CardAvatar.tsx";
import {
  decodeSharedProfile,
  parseEd25519PublicKey,
  type SharedProfile,
  sharedProfileFromPublicKey,
  sharedProfileTokenFromInput,
  verifySharedProfile,
} from "../sharedProfile.ts";

export type AddContactResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

export const AddContactSheet = ({
  encodedProfile,
  baseUrl,
  onAdd,
}: {
  encodedProfile?: string;
  baseUrl: string;
  onAdd: (
    profile: SharedProfile,
    verifiedProofs: readonly Proof[],
  ) => AddContactResult | Promise<AddContactResult>;
}): ReactElement => {
  const initial = useMemo(
    () => (encodedProfile === undefined ? null : decodeSharedProfile(encodedProfile)),
    [encodedProfile],
  );
  const [input, setInput] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profile, setProfile] = useState<SharedProfile | null>(null);
  const [verifiedProofs, setVerifiedProofs] = useState<readonly Proof[]>([]);
  const [verifying, setVerifying] = useState(initial?.ok === true);
  const [error, setError] = useState<string | null>(
    initial !== null && !initial.ok ? "This profile link isn’t valid" : null,
  );

  const acceptProfile = useCallback(async (nextProfile: SharedProfile): Promise<void> => {
    setVerifying(true);
    const verification = await verifySharedProfile(nextProfile);
    if (!verification.ok) {
      setError("This profile’s account check could not be confirmed");
      setVerifying(false);
      return;
    }
    setError(null);
    setVerifiedProofs(verification.proofs);
    setProfile(nextProfile);
    setVerifying(false);
  }, []);

  useEffect(() => {
    if (initial?.ok === true) void acceptProfile(initial.profile);
  }, [acceptProfile, initial]);

  const directPublicKey = parseEd25519PublicKey(input);
  const previewDisabled =
    input.trim().length === 0 ||
    verifying ||
    (directPublicKey !== null && displayName.trim().length === 0);

  const preview = async (): Promise<void> => {
    if (directPublicKey !== null) {
      const directProfile = sharedProfileFromPublicKey(directPublicKey, displayName);
      if (directProfile === null) {
        setError("Give this contact a name");
        return;
      }
      await acceptProfile(directProfile);
      return;
    }
    const token = sharedProfileTokenFromInput(input, baseUrl);
    if (token === null) {
      setError("Paste a valid profile link or public key");
      return;
    }
    const decoded = decodeSharedProfile(token);
    if (!decoded.ok) {
      setError("This profile link isn’t valid");
      return;
    }
    await acceptProfile(decoded.profile);
  };

  const add = async (): Promise<void> => {
    if (profile === null) return;
    const result = await onAdd(profile, verifiedProofs);
    if (!result.ok) setError(result.message);
  };
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void (profile === null ? preview() : add());
  };

  return (
    <form
      data-testid="add-contact-sheet"
      onSubmit={submit}
      style={{ animation: "riseIn .4s ease" }}
    >
      <div style={{ textAlign: "center" }}>
        <div className="sheet-title">Add a contact</div>
        <div className="sheet-lead" style={{ maxWidth: 290, marginInline: "auto" }}>
          Paste a profile link or public key. Review the details before saving them on this device.
        </div>
      </div>
      {profile === null ? (
        <>
          <div style={{ marginTop: 20 }}>
            <label className="sec-label" htmlFor="profile-link" style={{ display: "block" }}>
              Profile link or public key
            </label>
            <input
              data-testid="add-contact-profile-link"
              id="profile-link"
              className="input"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              maxLength={16_000}
              placeholder="Paste a shared link or public key"
              value={input}
              onInput={(event) => {
                setInput(event.currentTarget.value);
                setError(null);
              }}
            />
          </div>
          {directPublicKey !== null && (
            <div style={{ marginTop: 12 }}>
              <label className="sec-label" htmlFor="public-key-display-name">
                Display name
              </label>
              <input
                data-testid="add-contact-public-key-name"
                id="public-key-display-name"
                className="input"
                maxLength={80}
                placeholder="Name this contact"
                value={displayName}
                onInput={(event) => {
                  setDisplayName(event.currentTarget.value);
                  setError(null);
                }}
                style={{ marginTop: 8 }}
              />
              <div className="sheet-note" style={{ marginTop: 8 }}>
                Public keys do not include profile details, so this name is saved only on your
                device.
              </div>
            </div>
          )}
          {error !== null && (
            <div
              role="alert"
              data-theme-text="error"
              style={{
                color: "var(--kc-error)",
                fontSize: 12.5,
                fontWeight: 700,
                marginTop: 10,
              }}
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            data-testid="add-contact-preview"
            className="btn-dark press"
            onClick={(event) => {
              event.preventDefault();
              void preview();
            }}
            disabled={previewDisabled}
            style={{
              border: 0,
              marginTop: 20,
              opacity: previewDisabled ? 0.45 : 1,
              ["--press" as string]: 0.97,
            }}
          >
            Preview contact
          </button>
        </>
      ) : (
        <>
          {verifying && (
            <div
              data-testid="add-contact-verifying"
              className="sheet-note"
              style={{ marginTop: 16 }}
            >
              Checking the profile details…
            </div>
          )}
          <div
            data-testid="add-contact-preview-card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: 20,
              padding: 16,
              borderRadius: 20,
              background: "var(--kc-surface)",
              boxShadow: "0 4px 14px -8px rgba(80,50,20,.2)",
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 18,
                background: paletteFor(profile.color).grad,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 29,
                flex: "0 0 auto",
              }}
            >
              <CardAvatar
                card={{ id: profile.publicKey ?? profile.sourceId, avatar: profile.avatar }}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{profile.name}</div>
              <div
                data-theme-text="muted"
                style={{
                  color: "var(--kc-subtle)",
                  fontSize: 13,
                  fontWeight: 600,
                  marginTop: 2,
                }}
              >
                @{profile.handle.replace(/^@/u, "")}
              </div>
              {profile.bio.length > 0 && (
                <div
                  style={{
                    color: "var(--kc-muted)",
                    fontSize: 12,
                    lineHeight: 1.4,
                    marginTop: 7,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {profile.bio}
                </div>
              )}
            </div>
          </div>
          {error !== null && (
            <div
              role="alert"
              data-theme-text="error"
              style={{
                color: "var(--kc-error)",
                fontSize: 12.5,
                fontWeight: 700,
                marginTop: 10,
              }}
            >
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button
              type="button"
              data-testid="add-contact-use-another"
              className="press"
              onClick={() => {
                setProfile(null);
                setError(null);
                setInput("");
                setDisplayName("");
              }}
              style={{
                flex: 1,
                border: 0,
                borderRadius: 16,
                padding: 16,
                background: "var(--kc-surface-raised)",
                color: "var(--kc-text)",
                fontWeight: 800,
                ["--press" as string]: 0.96,
              }}
            >
              Use another
            </button>
            <button
              type="submit"
              data-testid="add-contact-save"
              className="btn-dark press"
              onClick={(event) => {
                event.preventDefault();
                void add();
              }}
              disabled={verifying}
              style={{ flex: 1, border: 0, ["--press" as string]: 0.96 }}
            >
              Add contact
            </button>
          </div>
        </>
      )}
    </form>
  );
};
