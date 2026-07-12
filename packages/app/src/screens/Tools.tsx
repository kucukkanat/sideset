import type { Card, Contact } from "@keychain/core";
import {
  BadgeCheck,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  LockKeyhole,
  type LucideIcon,
  Signature,
  UnlockKeyhole,
  Upload,
  VenetianMask,
  XCircle,
} from "lucide-react";
import { type ChangeEvent, type ReactElement, useMemo, useState } from "react";
import { CloakTool } from "../components/CloakTool.tsx";
import type { ToolOperation } from "../routing.ts";
import { copyText } from "../sharing.ts";
import {
  bytesText,
  decryptFromRecipient,
  decryptWithPassphrase,
  encryptForRecipient,
  encryptWithPassphrase,
  type SignedTextVerification,
  signText,
  textBytes,
  verifySignedText,
} from "../tools.ts";

const OPERATION_ICONS: Readonly<Record<ToolOperation, LucideIcon>> = {
  encrypt: LockKeyhole,
  decrypt: UnlockKeyhole,
  sign: Signature,
  verify: BadgeCheck,
  cloak: VenetianMask,
};

const NOSTR_PUBLIC_KEY = /^[0-9a-f]{64}$/;

interface RecipientOption {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly avatar: string;
  readonly publicKey: string;
  readonly kind: "Contact" | "Your card";
}

const recipientOptions = (
  cards: readonly Card[],
  contacts: readonly Contact[],
  query: string,
): readonly RecipientOption[] => {
  const options: readonly RecipientOption[] = [
    ...contacts
      .filter((contact) => NOSTR_PUBLIC_KEY.test(contact.npub))
      .map((contact) => ({
        id: `contact-${contact.id}`,
        name: contact.name,
        handle: contact.handle,
        avatar: contact.avatar,
        publicKey: contact.npub,
        kind: "Contact" as const,
      })),
    ...cards.flatMap((card) =>
      card.identity === undefined
        ? []
        : [
            {
              id: `card-${card.id}`,
              name: card.name,
              handle: card.handle,
              avatar: card.avatar,
              publicKey: card.identity.publicKey,
              kind: "Your card" as const,
            },
          ],
    ),
  ];
  const term = query.trim().toLowerCase();
  if (term.length === 0) return options;
  return options.filter(({ name, handle, publicKey }) =>
    `${name}\n${handle}\n${publicKey}`.toLowerCase().includes(term),
  );
};

export const Tools = ({
  active,
  cards,
  contacts,
  operation,
  onOperation,
  onToast,
}: {
  readonly active: Card;
  readonly cards: readonly Card[];
  readonly contacts: readonly Contact[];
  readonly operation: ToolOperation;
  readonly onOperation: (operation: ToolOperation) => void;
  readonly onToast: (message: string) => void;
}): ReactElement => {
  const [source, setSource] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [output, setOutput] = useState("");
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null);
  const [verification, setVerification] = useState<SignedTextVerification | null>(null);
  const [symmetric, setSymmetric] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [recipientFocused, setRecipientFocused] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const identity = active.identity;
  const recipients = useMemo(
    () => recipientOptions(cards, contacts, recipient),
    [cards, contacts, recipient],
  );

  const input = async (): Promise<Uint8Array> =>
    file === null ? textBytes(source) : new Uint8Array(await file.arrayBuffer());
  const run = async (): Promise<void> => {
    if (identity === undefined) return onToast("The active identity is not ready");
    try {
      setOutputBytes(null);
      setVerification(null);
      const data = await input();
      if (operation === "encrypt")
        setOutput(
          symmetric
            ? await encryptWithPassphrase(data, passphrase)
            : encryptForRecipient(data, identity, recipient.trim()),
        );
      if (operation === "decrypt") {
        const envelope = file === null ? source : bytesText(data);
        const plain = symmetric
          ? await decryptWithPassphrase(envelope, passphrase)
          : decryptFromRecipient(envelope, identity);
        setOutputBytes(plain);
        try {
          setOutput(bytesText(plain));
        } catch {
          setOutput("Decrypted file ready to save");
        }
      }
      if (operation === "sign") setOutput(await signText(source, active));
      if (operation === "verify") {
        const result = await verifySignedText(source);
        setVerification(result);
        setOutput("");
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : "The operation failed");
    }
  };

  const download = (): void => {
    const blob = new Blob([outputBytes === null ? output : new Uint8Array(outputBytes)], {
      type: outputBytes === null ? "text/plain;charset=utf-8" : "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      outputBytes === null ? `${file?.name ?? "keychain"}.txt` : (file?.name ?? "decrypted-file");
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyOutput = async (): Promise<void> => {
    const result = await copyText(output);
    onToast(result.ok ? "Output copied" : "Clipboard access isn’t available");
  };
  const OperationIcon = OPERATION_ICONS[operation];

  return (
    <div data-testid="screen-tools" className="scr screen">
      <div style={{ padding: "8px 24px 18px" }}>
        <div className="hdr-title" style={{ marginTop: 0 }}>
          Tools
        </div>
        <div className="hdr-sub">
          Encrypt, decrypt, cloak, sign, and verify—right on this device
        </div>
      </div>
      <div style={{ padding: "0 24px 120px", display: "grid", gap: 16 }}>
        <div className="tools-segments" role="group" aria-label="Tool operation">
          {(["encrypt", "decrypt", "sign", "verify", "cloak"] as const).map((item) => {
            const Icon = OPERATION_ICONS[item];
            return (
              <button
                type="button"
                data-testid={`tools-operation-${item}`}
                key={item}
                onClick={() => {
                  onOperation(item);
                  setOutput("");
                  setVerification(null);
                  setFile(null);
                }}
                className={operation === item ? "tools-segment active" : "tools-segment"}
                aria-pressed={operation === item}
              >
                <Icon aria-hidden="true" size={17} />
                {item}
              </button>
            );
          })}
        </div>
        {operation === "cloak" && <CloakTool onToast={onToast} />}
        {(operation === "encrypt" || operation === "decrypt") && (
          <div className="tools-card">
            <div className="tools-field-label">Encryption method</div>
            <div className="tools-mode" role="group" aria-label="Encryption method">
              <button
                data-testid="tools-recipient-mode"
                type="button"
                className={!symmetric ? "active" : ""}
                onClick={() => setSymmetric(false)}
              >
                Recipient
              </button>
              <button
                data-testid="tools-passphrase-mode"
                type="button"
                className={symmetric ? "active" : ""}
                onClick={() => setSymmetric(true)}
              >
                Passphrase
              </button>
            </div>
            {symmetric ? (
              <label className="tools-field">
                <span>Passphrase</span>
                <input
                  className="input"
                  data-testid="tools-passphrase"
                  type="password"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.currentTarget.value)}
                  placeholder="At least 8 characters"
                />
              </label>
            ) : operation === "encrypt" ? (
              <div className="tools-field tools-recipient-field">
                <label htmlFor="tools-recipient">Recipient public key</label>
                <input
                  id="tools-recipient"
                  className="input tools-mono"
                  data-testid="tools-recipient"
                  value={recipient}
                  onChange={(event) => {
                    setRecipient(event.currentTarget.value);
                    setRecipientFocused(true);
                  }}
                  onFocus={() => setRecipientFocused(true)}
                  onBlur={() => setRecipientFocused(false)}
                  placeholder="64-character hex key"
                  spellCheck={false}
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={recipientFocused && recipients.length > 0}
                  aria-controls="tools-recipient-options"
                />
                {recipientFocused && recipients.length > 0 && (
                  <div
                    id="tools-recipient-options"
                    data-testid="tools-recipient-options"
                    className="tools-recipient-options"
                    role="listbox"
                  >
                    {recipients.map((option) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={recipient === option.publicKey}
                        data-testid={`tools-recipient-option-${option.id}`}
                        className="tools-recipient-option"
                        key={option.id}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setRecipient(option.publicKey);
                          setRecipientFocused(false);
                        }}
                      >
                        <span className="tools-recipient-avatar" aria-hidden="true">
                          {option.avatar}
                        </span>
                        <span className="tools-recipient-details">
                          <strong>{option.name}</strong>
                          <small>{option.handle}</small>
                        </span>
                        <span className="tools-recipient-kind">{option.kind}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
        {operation !== "cloak" && (
          <div className="tools-card">
            <label className="tools-field">
              <span>
                {operation === "decrypt"
                  ? "Encrypted content"
                  : operation === "verify"
                    ? "Signed document"
                    : operation === "sign"
                      ? "Text to sign"
                      : "Text content"}
              </span>
              <textarea
                className="input tools-textarea"
                data-testid="tools-input"
                value={source}
                onChange={(event) => {
                  setSource(event.currentTarget.value);
                  setFile(null);
                }}
                placeholder={
                  operation === "decrypt"
                    ? "Paste encrypted envelope"
                    : operation === "verify"
                      ? "Paste signed document"
                      : "Enter text"
                }
                rows={6}
              />
            </label>
            {(operation === "encrypt" || operation === "decrypt") && (
              <>
                <div className="tools-divider">
                  <span>or</span>
                </div>
                <label data-testid="tools-file-label" className="tools-file press">
                  <Upload aria-hidden="true" className="tools-file-icon" size={20} />
                  <span>{file?.name ?? "Choose a file"}</span>
                  <input
                    data-testid="tools-file"
                    type="file"
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setFile(event.currentTarget.files?.[0] ?? null)
                    }
                    className="tools-file-input"
                  />
                </label>
              </>
            )}
          </div>
        )}
        {operation !== "cloak" && (
          <button
            data-testid="tools-run"
            type="button"
            className="press"
            onClick={() => void run()}
            style={{
              border: 0,
              borderRadius: 16,
              padding: 15,
              background: "#E8502A",
              color: "#fff",
              font: "inherit",
              fontWeight: 800,
              textTransform: "capitalize",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <OperationIcon aria-hidden="true" size={19} />
            {operation}
          </button>
        )}
        {operation === "verify" &&
          verification !== null &&
          (verification.ok ? (
            <div className="tools-verification" data-testid="tools-verification">
              <div
                className={
                  verification.valid
                    ? "tools-verification-status valid"
                    : "tools-verification-status invalid"
                }
              >
                {verification.valid ? (
                  <>
                    <CheckCircle2 aria-hidden="true" size={18} /> Signature verified
                  </>
                ) : (
                  <>
                    <XCircle aria-hidden="true" size={18} /> Invalid signature
                  </>
                )}
              </div>
              <div className="tools-signer">
                <div className="tools-signer-avatar">
                  {verification.profile.avatar || <KeyRound aria-hidden="true" size={22} />}
                </div>
                <div>
                  <div className="tools-signer-name">
                    {verification.profile.username ?? verification.profile.handle}
                  </div>
                  <div className="tools-signer-handle">{verification.profile.handle}</div>
                </div>
              </div>
              {verification.profile.bio.length > 0 && (
                <div className="tools-signer-bio">{verification.profile.bio}</div>
              )}
              <div className="tools-signed-text">
                <div className="tools-field-label">Signed text</div>
                <div data-testid="tools-verified-text">{verification.text}</div>
              </div>
              <div className="tools-signer-key tools-mono">{verification.profile.publicKey}</div>
            </div>
          ) : (
            <div
              className="tools-verification-status invalid"
              data-testid="tools-verification-invalid"
            >
              <XCircle aria-hidden="true" size={18} /> Invalid signed document
            </div>
          ))}
        {operation !== "cloak" && output.length > 0 && (
          <>
            <label className="tools-field">
              <span>Output</span>
              <textarea
                className="input tools-textarea tools-mono"
                data-testid="tools-output"
                readOnly
                value={output}
                rows={8}
              />
            </label>
            <div className="tools-output-actions">
              {(operation === "encrypt" || operation === "sign") && (
                <button
                  className="tools-save press"
                  data-testid="tools-copy"
                  type="button"
                  onClick={() => void copyOutput()}
                >
                  <Copy aria-hidden="true" size={17} /> Copy output
                </button>
              )}
              <button
                className="tools-save press"
                data-testid="tools-download"
                type="button"
                onClick={download}
              >
                <Download aria-hidden="true" size={17} /> Save output
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
