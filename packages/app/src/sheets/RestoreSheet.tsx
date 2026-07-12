import { type FormEvent, type ReactElement, useState } from "react";
import { MAX_BACKUP_BYTES } from "../backup.ts";
import { CheckIcon, ShieldIcon } from "../icons.tsx";
import type { BackupSelection } from "./BackupSheet.tsx";

export type RestoreResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

export type RestorePreviewResult =
  | {
      readonly ok: true;
      readonly cards: readonly { readonly id: string; readonly name: string }[];
      readonly settings: boolean;
      readonly contacts: boolean;
      readonly contactCount: number;
    }
  | { readonly ok: false; readonly message: string };

export const RestoreSheet = ({
  onRestore,
  onPreview,
  onDone,
}: {
  onPreview: (contents: string, password: string) => Promise<RestorePreviewResult>;
  onRestore: (
    contents: string,
    password: string,
    selection: BackupSelection,
  ) => Promise<RestoreResult>;
  onDone: () => void;
}): ReactElement => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "select" | "restoring" | "done">("form");
  const [contents, setContents] = useState("");
  const [preview, setPreview] = useState<Extract<
    RestorePreviewResult,
    { readonly ok: true }
  > | null>(null);
  const [selection, setSelection] = useState<BackupSelection>({
    cardIds: [],
    settings: false,
    contacts: false,
  });

  const restore = async (): Promise<void> => {
    if (file === null || password.length === 0) return;
    setError(null);
    setStep("restoring");
    try {
      const result = await onRestore(contents, password, selection);
      if (!result.ok) {
        setError(result.message);
        setStep("form");
        return;
      }
      setPassword("");
      setStep("done");
    } catch {
      setError("The backup file could not be read");
      setStep("form");
    }
  };
  const inspect = async (): Promise<void> => {
    if (file === null || password.length === 0) return;
    setError(null);
    setStep("restoring");
    try {
      const nextContents = await file.text();
      const result = await onPreview(nextContents, password);
      if (!result.ok) {
        setError(result.message);
        setStep("form");
        return;
      }
      setContents(nextContents);
      setPreview(result);
      setSelection({
        cardIds: result.cards.map(({ id }) => id),
        settings: result.settings,
        contacts: result.contacts,
      });
      setStep("select");
    } catch {
      setError("The backup file could not be read");
      setStep("form");
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (step === "select") void restore();
    else void inspect();
  };

  if (step === "done") {
    return (
      <div data-testid="restore-complete" className="done-pop">
        <div className="check-bubble">
          <CheckIcon size={44} width={3} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 20 }}>Backup restored</div>
        <div className="sheet-lead" style={{ maxWidth: 275 }}>
          The selected backup data was merged into this device.
        </div>
        <button
          type="button"
          data-testid="restore-done"
          className="btn-dark press"
          onClick={onDone}
          style={{ marginTop: 24, border: 0, ["--press" as string]: 0.97 }}
        >
          Done
        </button>
      </div>
    );
  }

  if (step === "select" && preview !== null) {
    const empty = selection.cardIds.length === 0 && !selection.settings && !selection.contacts;
    return (
      <form data-testid="restore-selection" onSubmit={submit}>
        <div className="sheet-title">Choose what to import</div>
        <div className="sheet-lead">Selected data will merge with what is already in the app.</div>
        <fieldset style={{ border: 0, padding: 0, marginTop: 20 }}>
          <legend className="sec-label">Identities</legend>
          {preview.cards.map((card) => (
            <label key={card.id} style={{ display: "flex", gap: 12, padding: "8px 0" }}>
              <input
                data-testid={`restore-card-${card.id}`}
                type="checkbox"
                checked={selection.cardIds.includes(card.id)}
                onChange={() =>
                  setSelection((current) => ({
                    ...current,
                    cardIds: current.cardIds.includes(card.id)
                      ? current.cardIds.filter((id) => id !== card.id)
                      : [...current.cardIds, card.id],
                  }))
                }
              />
              {card.name}
            </label>
          ))}
          {preview.settings && (
            <label style={{ display: "flex", gap: 12, padding: "8px 0" }}>
              <input
                data-testid="restore-settings"
                type="checkbox"
                checked={selection.settings}
                onChange={(event) =>
                  setSelection((current) => ({ ...current, settings: event.currentTarget.checked }))
                }
              />
              Settings
            </label>
          )}
          {preview.contacts && (
            <label style={{ display: "flex", gap: 12, padding: "8px 0" }}>
              <input
                data-testid="restore-contacts"
                type="checkbox"
                checked={selection.contacts}
                onChange={(event) =>
                  setSelection((current) => ({ ...current, contacts: event.currentTarget.checked }))
                }
              />
              All contacts ({preview.contactCount})
            </label>
          )}
        </fieldset>
        <button
          data-testid="restore-import"
          className="btn-dark press"
          type="submit"
          disabled={empty}
          style={{ marginTop: 20, border: 0, opacity: empty ? 0.45 : 1 }}
        >
          Import selected
        </button>
      </form>
    );
  }

  return (
    <form
      data-testid="restore-sheet"
      onSubmit={submit}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        animation: "riseIn .4s ease",
      }}
    >
      <div
        style={{
          width: 76,
          height: 76,
          borderRadius: 24,
          background: "#E8F0FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ShieldIcon size={40} width={1.8} />
      </div>
      <div className="sheet-title" style={{ marginTop: 16 }}>
        Restore a backup
      </div>
      <div className="sheet-lead" style={{ maxWidth: 290 }}>
        Choose an encrypted Keychain backup and enter the password used to create it.
      </div>
      <div style={{ width: "100%", marginTop: 20, textAlign: "left" }}>
        <label className="sec-label" htmlFor="backup-file" style={{ display: "block" }}>
          Backup file
        </label>
        <input
          data-testid="restore-file"
          id="backup-file"
          className="input"
          type="file"
          accept="application/json,.json"
          disabled={step === "restoring"}
          onChange={(event) => {
            const selected = event.currentTarget.files?.[0] ?? null;
            if (selected !== null && selected.size > MAX_BACKUP_BYTES) {
              setFile(null);
              setError("That backup is too large to open");
              return;
            }
            setError(null);
            setFile(selected);
          }}
          style={{ padding: 12, fontSize: 13 }}
        />
      </div>
      <div style={{ width: "100%", marginTop: 16, textAlign: "left" }}>
        <label className="sec-label" htmlFor="restore-password" style={{ display: "block" }}>
          Backup password
        </label>
        <input
          data-testid="restore-password"
          id="restore-password"
          className="input"
          type="password"
          autoComplete="current-password"
          maxLength={256}
          value={password}
          disabled={step === "restoring"}
          onInput={(event) => setPassword(event.currentTarget.value)}
        />
      </div>
      {error !== null && (
        <div
          data-testid="restore-error"
          role="alert"
          data-theme-text="error"
          style={{
            color: "var(--kc-error)",
            fontSize: 12.5,
            fontWeight: 700,
            marginTop: 12,
          }}
        >
          {error}
        </div>
      )}
      <button
        type="submit"
        data-testid="restore-submit"
        className="btn-dark press"
        disabled={step === "restoring" || file === null || password.length === 0}
        style={{
          marginTop: 20,
          border: 0,
          opacity: step === "restoring" || file === null || password.length === 0 ? 0.45 : 1,
          ["--press" as string]: 0.97,
        }}
      >
        {step === "restoring" ? "Opening…" : "Continue"}
      </button>
    </form>
  );
};
