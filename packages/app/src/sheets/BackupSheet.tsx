import { passStrength, STRENGTH_COLORS, STRENGTH_LABELS } from "@keychain/core";
import { type FormEvent, type ReactElement, useEffect, useState } from "react";
import { CheckIcon, ShieldIcon } from "../icons.tsx";

export type BackupSaveResult =
  | { readonly ok: true; readonly contents: string; readonly filename: string }
  | { readonly ok: false; readonly message: string };

interface BackupDownload {
  readonly href: string;
  readonly filename: string;
}

export const BackupSheet = ({
  label,
  onSave,
  onToast,
  onDone,
}: {
  label: string;
  onSave: (password: string) => Promise<BackupSaveResult>;
  onToast: (msg: string) => void;
  onDone: () => void;
}): ReactElement => {
  const [step, setStep] = useState<"intro" | "saving" | "done">("intro");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [download, setDownload] = useState<BackupDownload | null>(null);
  const strength = passStrength(password);
  const strengthColor = STRENGTH_COLORS[Math.min(strength - 1, 2)] ?? "#B6A78E";

  useEffect(
    () => () => {
      if (download !== null) URL.revokeObjectURL(download.href);
    },
    [download],
  );

  const save = async (): Promise<void> => {
    if (strength < 2) {
      onToast("Use a stronger password");
      return;
    }
    setStep("saving");
    const result = await onSave(password);
    if (!result.ok) {
      setStep("intro");
      onToast(result.message);
      return;
    }
    setDownload({
      href: URL.createObjectURL(new Blob([result.contents], { type: "application/json" })),
      filename: result.filename,
    });
    setPassword("");
    setStep("done");
  };
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void save();
  };

  return (
    <form data-testid="backup-sheet" onSubmit={submit} style={{ animation: "riseIn .4s ease" }}>
      {(step === "intro" || step === "saving") && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
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
              boxShadow: "0 10px 22px -10px rgba(46,107,230,.5)",
            }}
          >
            <ShieldIcon size={40} width={1.8} />
          </div>
          <div className="sheet-title" style={{ marginTop: 18 }}>
            Save a local backup
          </div>
          <div className="sheet-lead" style={{ marginTop: 8, maxWidth: 300, lineHeight: 1.5 }}>
            Download an encrypted copy of {label}. You’ll need its password to restore it later.
          </div>
          <div style={{ width: "100%", marginTop: 22, textAlign: "left" }}>
            <label className="sec-label" htmlFor="backup-password" style={{ display: "block" }}>
              Backup password
            </label>
            <div style={{ position: "relative" }}>
              <input
                data-testid="backup-password"
                id="backup-password"
                className="input"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                maxLength={256}
                placeholder="At least 8 characters"
                style={{ padding: "16px 52px 16px 16px" }}
                value={password}
                disabled={step === "saving"}
                onInput={(event) => setPassword(event.currentTarget.value)}
              />
              <button
                type="button"
                data-testid="backup-password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
                disabled={step === "saving"}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 42,
                  height: 42,
                  border: 0,
                  background: "transparent",
                  fontSize: 19,
                  cursor: "pointer",
                  opacity: 0.55,
                }}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 3,
                    transition: "background .25s",
                    background: index < strength ? strengthColor : "#E4DBCC",
                  }}
                />
              ))}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: strength > 0 ? strengthColor : "#B6A78E",
                marginTop: 7,
              }}
            >
              {password
                ? STRENGTH_LABELS[strength]
                : "Use mixed-case letters and a number or symbol"}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--kc-warning-bg)",
              borderRadius: 14,
              padding: "13px 15px",
              marginTop: 18,
              width: "100%",
            }}
          >
            <span style={{ fontSize: 18 }}>💡</span>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--kc-warning-text)",
                textAlign: "left",
                lineHeight: 1.4,
              }}
            >
              This password never leaves your device and can’t be reset.
            </div>
          </div>
          <button
            type="submit"
            data-testid="backup-create"
            className="btn-dark press"
            disabled={step === "saving" || strength < 2}
            style={{
              marginTop: 20,
              border: 0,
              background: "#2E6BE6",
              opacity: step === "saving" || strength < 2 ? 0.45 : 1,
              ["--press" as string]: 0.97,
            }}
          >
            {step === "saving" ? "Encrypting…" : "Create backup file"}
          </button>
        </div>
      )}
      {step === "done" && (
        <div data-testid="backup-complete" className="done-pop">
          <div className="check-bubble">
            <CheckIcon size={44} width={3} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 20 }}>Backup prepared</div>
          <div className="sheet-lead" style={{ maxWidth: 275 }}>
            Your encrypted file is ready. Download it, then keep the file and its password somewhere
            safe.
          </div>
          {download !== null && (
            <a
              data-testid="backup-download"
              className="btn-dark press"
              href={download.href}
              download={download.filename}
              style={{
                marginTop: 24,
                textDecoration: "none",
                ["--press" as string]: 0.97,
              }}
            >
              Download backup file
            </a>
          )}
          <button
            type="button"
            data-testid="backup-done"
            className="press"
            onClick={onDone}
            style={{
              marginTop: 12,
              border: 0,
              background: "transparent",
              fontWeight: 800,
            }}
          >
            Done
          </button>
        </div>
      )}
    </form>
  );
};
