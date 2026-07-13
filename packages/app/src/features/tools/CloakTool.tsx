import { copyText } from "@shared/lib/clipboard.ts";
import {
  Copy,
  Eye,
  EyeOff,
  Info,
  LockKeyhole,
  ShieldAlert,
  ShieldOff,
  VenetianMask,
} from "lucide-react";
import { type ReactElement, useState } from "react";
import {
  hideWithCloak,
  MAX_CLOAK_COVER_LENGTH,
  MAX_CLOAK_SECRET_LENGTH,
  MAX_CLOAKED_MESSAGE_LENGTH,
  revealWithCloak,
} from "./cloak.ts";

type CloakMode = "hide" | "reveal";

const nextPaint = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

export const CloakTool = ({
  onToast,
}: {
  readonly onToast: (message: string) => void;
}): ReactElement => {
  const [mode, setMode] = useState<CloakMode>("hide");
  const [secret, setSecret] = useState("");
  const [cover, setCover] = useState("");
  const [cloaked, setCloaked] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [output, setOutput] = useState("");
  const [protectedOutput, setProtectedOutput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectMode = (next: CloakMode): void => {
    setMode(next);
    setPassword("");
    setShowPassword(false);
    setOutput("");
    setError(null);
  };

  const run = async (): Promise<void> => {
    setBusy(true);
    setOutput("");
    setError(null);
    await nextPaint();
    const result =
      mode === "hide"
        ? await hideWithCloak(secret, cover, password)
        : await revealWithCloak(cloaked, password);
    if (result.ok) {
      setOutput(result.value);
      setProtectedOutput(mode === "hide" && password.length > 0);
    } else {
      setError(result.error.message);
    }
    setBusy(false);
  };

  const copyOutput = async (): Promise<void> => {
    const result = await copyText(output);
    onToast(
      result.ok
        ? mode === "hide"
          ? "Cloaked message copied"
          : "Hidden message copied"
        : "Clipboard access isn’t available",
    );
  };

  return (
    <div data-testid="cloak-tool" className="cloak-shell">
      <section className="cloak-intro">
        <span className="cloak-intro-icon">
          <VenetianMask aria-hidden="true" size={25} />
        </span>
        <span>
          <strong>
            {mode === "hide" ? "Hide a message in plain sight" : "Reveal a hidden message"}
          </strong>
          <span>
            {mode === "hide"
              ? "Turn ordinary-looking text into a carrier for a private message."
              : "Paste the complete cloaked message to uncover what’s inside."}
          </span>
        </span>
      </section>

      <div className="tools-mode cloak-mode" role="group" aria-label="Cloak action">
        <button
          data-testid="cloak-mode-hide"
          type="button"
          className={mode === "hide" ? "active" : ""}
          aria-pressed={mode === "hide"}
          onClick={() => selectMode("hide")}
        >
          <EyeOff aria-hidden="true" size={17} /> Hide
        </button>
        <button
          data-testid="cloak-mode-reveal"
          type="button"
          className={mode === "reveal" ? "active" : ""}
          aria-pressed={mode === "reveal"}
          onClick={() => selectMode("reveal")}
        >
          <Eye aria-hidden="true" size={17} /> Reveal
        </button>
      </div>

      <div className="tools-card cloak-fields">
        {mode === "hide" ? (
          <>
            <label className="tools-field">
              <span>Secret message</span>
              <textarea
                className="input tools-textarea"
                data-testid="cloak-secret"
                value={secret}
                maxLength={MAX_CLOAK_SECRET_LENGTH}
                onChange={(event) => setSecret(event.currentTarget.value)}
                placeholder="Type the message you want to hide"
                rows={5}
              />
            </label>
            <label className="tools-field">
              <span>Visible message</span>
              <small>Everyone will see this. Use at least two words.</small>
              <textarea
                className="input tools-textarea cloak-cover"
                data-testid="cloak-cover"
                value={cover}
                maxLength={MAX_CLOAK_COVER_LENGTH}
                onChange={(event) => setCover(event.currentTarget.value)}
                placeholder="See you at the usual place"
                rows={3}
              />
            </label>
          </>
        ) : (
          <label className="tools-field">
            <span>Cloaked message</span>
            <small>Paste the whole message exactly as you received it.</small>
            <textarea
              className="input tools-textarea"
              data-testid="cloak-input"
              value={cloaked}
              maxLength={MAX_CLOAKED_MESSAGE_LENGTH}
              onChange={(event) => setCloaked(event.currentTarget.value)}
              placeholder="Paste the complete message here"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="none"
              rows={6}
            />
          </label>
        )}

        <label className="tools-field">
          <span>{mode === "hide" ? "Password (optional)" : "Password (if used)"}</span>
          <small>
            {mode === "hide"
              ? "For extra privacy. Use 8+ characters and share it separately."
              : "Enter the password the sender shared with you."}
          </small>
          <div className="cloak-password">
            <input
              className="input"
              data-testid="cloak-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              placeholder={
                mode === "hide" ? "Leave blank or use 8+ characters" : "Leave blank if none"
              }
              autoComplete="off"
            />
            <button
              data-testid="cloak-password-visibility"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" size={19} />
              ) : (
                <Eye aria-hidden="true" size={19} />
              )}
            </button>
          </div>
        </label>
      </div>

      {error !== null && (
        <div className="cloak-error" data-testid="cloak-error" role="alert">
          <ShieldAlert aria-hidden="true" size={18} /> {error}
        </div>
      )}

      <button
        data-testid="cloak-run"
        type="button"
        className="tools-primary press"
        disabled={busy}
        onClick={() => void run()}
      >
        {mode === "hide" ? (
          <EyeOff aria-hidden="true" size={19} />
        ) : (
          <Eye aria-hidden="true" size={19} />
        )}
        {busy ? "Working…" : mode === "hide" ? "Cloak message" : "Reveal message"}
      </button>

      {output.length > 0 && (
        <section className="tools-card cloak-result" data-testid="cloak-result">
          <div className="cloak-result-heading">
            <span className="cloak-result-icon">
              {mode === "hide" ? (
                <VenetianMask aria-hidden="true" size={20} />
              ) : (
                <Eye aria-hidden="true" size={20} />
              )}
            </span>
            <span>
              <strong>{mode === "hide" ? "Cloaked message ready" : "Hidden message found"}</strong>
              <span>
                {mode === "hide"
                  ? "It looks normal, but it includes invisible characters."
                  : "Here’s the message hidden inside."}
              </span>
            </span>
          </div>
          <label className="tools-field">
            <span>{mode === "hide" ? "Cloaked message" : "Hidden message"}</span>
            <textarea
              className="input tools-textarea"
              data-testid="cloak-output"
              readOnly
              value={output}
              spellCheck={false}
              rows={mode === "hide" ? 4 : 6}
            />
          </label>
          {mode === "hide" && (
            <div className={protectedOutput ? "cloak-protection protected" : "cloak-protection"}>
              {protectedOutput ? (
                <LockKeyhole aria-hidden="true" size={17} />
              ) : (
                <ShieldOff aria-hidden="true" size={17} />
              )}
              {protectedOutput
                ? "Password protected. Share the password separately."
                : "Hidden from casual view, but not password protected."}
            </div>
          )}
          <button
            className="tools-save press"
            data-testid="cloak-copy"
            type="button"
            onClick={() => void copyOutput()}
          >
            <Copy aria-hidden="true" size={17} />
            {mode === "hide" ? "Copy cloaked message" : "Copy hidden message"}
          </button>
        </section>
      )}

      <aside className="cloak-note">
        <Info aria-hidden="true" size={18} />
        <span>
          Invisible characters can be removed by some apps. Copy and send the result exactly as it
          is. Cloak hides from casual view, not determined inspection, and should not be used for
          recovery phrases or private keys.
        </span>
      </aside>
    </div>
  );
};
