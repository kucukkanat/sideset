import { type Card, passStrength, STRENGTH_LABELS } from "@keychain/core";
import {
  Archive,
  Check,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { type FormEvent, type ReactElement, useEffect, useState } from "react";
import brandMark from "../../assets/brand/sideset-mark.png" with { type: "file" };
import { CardAvatar } from "../components/CardAvatar.tsx";

export type BackupSaveResult =
  | { readonly ok: true; readonly contents: string; readonly filename: string }
  | { readonly ok: false; readonly message: string };

export interface BackupSelection {
  readonly cardIds: readonly string[];
  readonly settings: boolean;
  readonly contacts: boolean;
}

interface BackupDownload {
  readonly href: string;
  readonly filename: string;
}

const Toggle = ({ checked }: { checked: boolean }): ReactElement => (
  <span className="backup-toggle" aria-hidden="true" data-checked={checked}>
    <span />
  </span>
);

export const BackupSheet = ({
  cards,
  contactCount,
  onSave,
  onToast,
  onDone,
}: {
  cards: readonly Card[];
  contactCount: number;
  onSave: (password: string, selection: BackupSelection) => Promise<BackupSaveResult>;
  onToast: (msg: string) => void;
  onDone: () => void;
}): ReactElement => {
  const [step, setStep] = useState<"intro" | "saving" | "done">("intro");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [download, setDownload] = useState<BackupDownload | null>(null);
  const [cardIds, setCardIds] = useState<readonly string[]>(cards.map(({ id }) => id));
  const [settings, setSettings] = useState(true);
  const [contacts, setContacts] = useState(true);
  const strength = passStrength(password);
  const selectedCount = cardIds.length + Number(settings) + Number(contacts);

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
    const result = await onSave(password, { cardIds, settings, contacts });
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

  if (step === "done") {
    return (
      <div data-testid="backup-complete" className="backup-done">
        <div className="backup-done-orbit" aria-hidden="true">
          <span className="backup-done-check">
            <Check size={34} strokeWidth={3} />
          </span>
          <span className="backup-spark backup-spark-one" />
          <span className="backup-spark backup-spark-two" />
          <span className="backup-spark backup-spark-three" />
        </div>
        <div className="backup-done-kicker">
          <ShieldCheck size={14} /> Encrypted on this device
        </div>
        <div className="sheet-title">Backup prepared</div>
        <div className="sheet-lead backup-done-lead">
          One last step: download the file and keep it somewhere only you can access.
        </div>
        {download !== null && (
          <a
            data-testid="backup-download"
            className="backup-primary press"
            href={download.href}
            download={download.filename}
          >
            <Download size={19} strokeWidth={2.3} />
            Download backup file
          </a>
        )}
        <div className="backup-file-pill">
          <Archive size={17} />
          <span>{download?.filename}</span>
          <Check size={16} />
        </div>
        <button
          type="button"
          data-testid="backup-done"
          className="backup-secondary press"
          onClick={onDone}
        >
          Done
        </button>
      </div>
    );
  }

  const disabled = step === "saving";
  return (
    <form data-testid="backup-sheet" className="backup-flow" onSubmit={submit}>
      <header className="backup-hero">
        <div className="backup-brand-lockup">
          <img src={brandMark} alt="" />
          <span>SIDEST</span>
        </div>
        <div className="backup-hero-icon" aria-hidden="true">
          <ShieldCheck size={28} strokeWidth={1.9} />
        </div>
        <div>
          <div className="backup-eyebrow">PRIVATE BY DESIGN</div>
          <h2 className="sheet-title">Save a local backup</h2>
          <p className="sheet-lead">Bundle your wallet into one encrypted file you control.</p>
        </div>
      </header>

      <section className="backup-section" aria-labelledby="backup-include-title">
        <div className="backup-section-heading">
          <div>
            <span className="backup-step">1</span>
            <span id="backup-include-title">Choose what to protect</span>
          </div>
          <span>{selectedCount} selected</span>
        </div>
        <div className="backup-options">
          <div className="backup-option backup-identities">
            <div className="backup-option-icon">
              <WalletCards size={19} />
            </div>
            <div className="backup-option-copy">
              <strong>Identities</strong>
              <span>
                {cardIds.length} of {cards.length} included
              </span>
            </div>
            <ChevronRight size={18} className="backup-chevron" />
          </div>
          <div className="backup-avatar-row" role="group" aria-label="Choose identities">
            {cards.map((card) => {
              const checked = cardIds.includes(card.id);
              return (
                <label key={card.id} className="backup-avatar-choice" data-checked={checked}>
                  <input
                    data-testid={`backup-card-${card.id}`}
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() =>
                      setCardIds((selected) =>
                        selected.includes(card.id)
                          ? selected.filter((id) => id !== card.id)
                          : [...selected, card.id],
                      )
                    }
                  />
                  <span className="backup-avatar-wrap">
                    <CardAvatar card={card} style={{ width: 42, height: 42, fontSize: 22 }} />
                    <span className="backup-avatar-check">
                      <Check size={11} strokeWidth={3.5} />
                    </span>
                  </span>
                  <span>{card.name}</span>
                </label>
              );
            })}
          </div>
          <label className="backup-option">
            <input
              data-testid="backup-contacts"
              type="checkbox"
              checked={contacts}
              disabled={disabled}
              onChange={(event) => setContacts(event.currentTarget.checked)}
            />
            <div className="backup-option-icon">
              <UsersRound size={19} />
            </div>
            <div className="backup-option-copy">
              <strong>Contacts</strong>
              <span>{contactCount} people</span>
            </div>
            <Toggle checked={contacts} />
          </label>
          <label className="backup-option">
            <input
              data-testid="backup-settings"
              type="checkbox"
              checked={settings}
              disabled={disabled}
              onChange={(event) => setSettings(event.currentTarget.checked)}
            />
            <div className="backup-option-icon">
              <Settings2 size={19} />
            </div>
            <div className="backup-option-copy">
              <strong>Preferences</strong>
              <span>Theme &amp; app settings</span>
            </div>
            <Toggle checked={settings} />
          </label>
        </div>
      </section>

      <section className="backup-section" aria-labelledby="backup-password-title">
        <div className="backup-section-heading">
          <div>
            <span className="backup-step">2</span>
            <span id="backup-password-title">Lock your backup</span>
          </div>
        </div>
        <div className="backup-password-wrap" data-strength={strength}>
          <LockKeyhole size={19} className="backup-password-icon" />
          <input
            data-testid="backup-password"
            id="backup-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            maxLength={256}
            placeholder="Create a strong password"
            value={password}
            disabled={disabled}
            onInput={(event) => setPassword(event.currentTarget.value)}
          />
          <button
            type="button"
            data-testid="backup-password-toggle"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((visible) => !visible)}
            disabled={disabled}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <div className="backup-strength" data-strength={strength}>
          <div>
            {[1, 2, 3].map((level) => (
              <span key={level} data-active={strength >= level} />
            ))}
          </div>
          <strong>
            {password ? STRENGTH_LABELS[strength] : "8+ characters · mix letters & symbols"}
          </strong>
        </div>
        <div className="backup-privacy-note">
          <Sparkles size={17} />
          <span>
            <strong>Only you know this password.</strong> It never leaves this device and can’t be
            recovered.
          </span>
        </div>
      </section>

      <button
        type="submit"
        data-testid="backup-create"
        className="backup-primary press"
        disabled={disabled || strength < 2 || selectedCount === 0}
      >
        {disabled ? <span className="backup-spinner" /> : <LockKeyhole size={19} />}
        {disabled ? "Encrypting your wallet…" : "Create backup file"}
      </button>
      <p className="backup-local-caption">
        <ShieldCheck size={13} /> AES-256 encrypted · created entirely offline
      </p>
    </form>
  );
};
