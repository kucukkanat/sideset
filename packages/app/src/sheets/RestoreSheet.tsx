import { type FormEvent, type ReactElement, useState } from "react";
import { MAX_BACKUP_BYTES } from "../backup.ts";
import { CheckIcon, ShieldIcon } from "../icons.tsx";

export type RestoreResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

export const RestoreSheet = ({
  onRestore,
  onDone,
}: {
  onRestore: (contents: string, password: string) => Promise<RestoreResult>;
  onDone: () => void;
}): ReactElement => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "restoring" | "done">("form");

  const restore = async (): Promise<void> => {
    if (file === null || password.length === 0) return;
    setError(null);
    setStep("restoring");
    try {
      const result = await onRestore(await file.text(), password);
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
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void restore();
  };

  if (step === "done") {
    return (
      <div data-testid="restore-complete" className="done-pop">
        <div className="check-bubble">
          <CheckIcon size={44} width={3} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 20 }}>Backup restored</div>
        <div className="sheet-lead" style={{ maxWidth: 275 }}>
          Your cards, contacts, appearance, and activity are back on this device.
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
      <div className="sheet-title" style={{ marginTop: 18 }}>
        Restore a backup
      </div>
      <div className="sheet-lead" style={{ maxWidth: 290 }}>
        Choose an encrypted Keychain backup and enter the password used to create it.
      </div>
      <div style={{ width: "100%", marginTop: 22, textAlign: "left" }}>
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
          marginTop: 22,
          border: 0,
          opacity: step === "restoring" || file === null || password.length === 0 ? 0.45 : 1,
          ["--press" as string]: 0.97,
        }}
      >
        {step === "restoring" ? "Restoring…" : "Restore backup"}
      </button>
    </form>
  );
};
